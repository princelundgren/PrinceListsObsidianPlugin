import { getLinkpath, MarkdownRenderChild, Notice, Platform, setIcon, type App, type Component, type TFile } from 'obsidian';
import { guardedWrite, type WriteResult } from '../core/action-write';
import { blockLink } from '../core/block-source';
import { visibleSections } from '../core/display';
import { toggleItem } from '../core/edit-items';
import { ListEditing } from '../core/editing';
import type { OwnEdit } from '../core/follow';
import { toggleLine } from '../core/item-line';
import { joinLines, splitLines } from '../core/lines';
import { itemAt, parseList } from '../core/parse';
import { serialQueue } from '../core/queue';
import { WriteEchoes } from '../core/write-echoes';
import { contentStartLine, isListText } from '../obsidian/marker';
import { blockDragHost, enableBlockDrag } from './block-drag';
import { addBlockItem, addBlockItemBelow, BLOCK_FIELD_CLASS, BLOCK_TRASH_CLASS, closeBlockField, deleteBlockItem, noticeLostField, openBlockField, showBlockItemMenu, type BlockField } from './block-fields';
import { targetOf } from './dom';
import type { RowDragHost } from './drag-host';
import { handleLinkClick, handleLinkMenu } from './notes';
import { buildHeading, buildRow, CHECKBOX_CLASS, ITEM_CLASS, ITEMS_CLASS, lineOf, type RowHost } from './render-list';
import { CHANGED_ELSEWHERE_NOTICE, SAVE_FAILED_NOTICE, tryEdit } from './write';

const NEW_ITEM_CLASS = 'princelists-block-new-item';

// A list drawn inside another note by a `princelists` code block (spec, "A list inside another note").
// It shows the list's headings and items, not its list note, notes or content the plugin leaves alone.
export class ListBlock extends MarkdownRenderChild implements RowHost {
	readonly dragsRows = true;
	readonly dragsHeadings = false;
	readonly editing = new ListEditing(contentStartLine);
	readonly enqueue = serialQueue((error) => console.error(error));
	readonly rowsEl: HTMLElement;
	file: TFile | null = null;
	field: BlockField | null = null;
	swallowNextClick = false;
	dragging = false;
	outsideChanges = 0;
	private readonly rootEl: HTMLElement;
	private readonly link: string | null;
	private readonly blocks = new Map<HTMLElement, Component>();
	private echoes = new WriteEchoes();
	// The path drawn last: a rename that keeps the link's file still redraws its name and link.
	private shownPath: string | null | undefined;
	private drawnText: string | null = null;

	constructor(
		readonly app: App,
		containerEl: HTMLElement,
		source: string,
		private readonly notePath: string,
	) {
		super(containerEl);
		this.link = blockLink(source);
		this.rootEl = containerEl.createDiv({ cls: 'princelists-block' });
		this.rowsEl = createDiv();
	}

	onload(): void {
		const { metadataCache, vault } = this.app;
		this.registerEvent(metadataCache.on('changed', (file, data) => this.fileChanged(file, data)));
		this.registerEvent(vault.on('create', () => void this.resolve()));
		this.registerEvent(vault.on('rename', () => void this.resolve()));
		this.registerEvent(vault.on('delete', () => void this.resolve()));
		this.registerDomEvent(this.rootEl, 'click', (evt) => this.onClick(evt));
		this.registerDomEvent(this.rootEl, 'keydown', (evt) => this.onKeyDown(evt));
		this.registerDomEvent(this.rootEl, 'focusout', (evt) => this.onFocusOut(evt));
		// A press elsewhere in the block keeps the field's focus, and the click closes the field instead:
		// closing it on the blur redraws the rows before the click reaches the one pressed.
		this.registerDomEvent(this.rootEl, 'mousedown', (evt) => {
			if (this.field && targetOf(evt) !== this.field.el) evt.preventDefault();
		});
		// The trash button doesn't take focus, so the field stays open until the click deletes.
		this.registerDomEvent(this.rootEl, 'pointerdown', (evt) => {
			if (targetOf(evt)?.closest(`.${BLOCK_TRASH_CLASS}`)) evt.preventDefault();
		});
		if (Platform.isDesktop) this.registerDomEvent(this.rootEl, 'contextmenu', (evt) => this.onContextMenu(evt));
		enableBlockDrag(this);
		void this.resolve();
	}

	onunload(): void {
		this.removeBlocks();
	}

	// guardedWrite with nothing of its own to save: the block's text changes only by its own writes and
	// the file's.
	async write(next: string, expected: string, edit: OwnEdit): Promise<WriteResult> {
		const { file, editing } = this;
		if (!file) return 'refused';
		const outcome = await guardedWrite(
			{
				get text() {
					return editing.text;
				},
				save: async () => {},
				process: (fn) => this.app.vault.process(file, fn),
				sameFile: () => this.file === file,
				took: (text) => {
					this.echoes.wrote(text);
					editing.applyOwn(text, edit);
				},
				reread: async () => {
					const text = await this.app.vault.read(file);
					if (this.file === file) this.takeOutsideChange(text);
				},
			},
			next,
			expected,
		).catch((error: unknown) => {
			console.error(error);
			new Notice(SAVE_FAILED_NOTICE);
			return 'failed' as const;
		});
		if (outcome === 'failed') return outcome;
		if (outcome !== 'written') new Notice(CHANGED_ELSEWHERE_NOTICE);
		return outcome === 'written' ? outcome : 'refused';
	}

	dragHost(): RowDragHost {
		return blockDragHost(this);
	}

	// Rows aren't drawn while a field is open or a drag holds one, so once the text has changed under
	// them their line attributes are out of date.
	rowsMatchText(): boolean {
		return this.editing.text === this.drawnText;
	}

	// The line of the row holding `target`, or null while the rows are out of date.
	private rowLine(target: Element): number | null {
		const rowEl = target.closest(`.${ITEM_CLASS}`);
		return rowEl && this.rowsMatchText() ? lineOf(rowEl) : null;
	}

	// After a field closes, whose title went back in its place, or a drag ends: the rows are drawn
	// again only if the text changed since they were, and never under a drag.
	drawIfChanged(): void {
		if (!this.dragging && this.editing.text !== this.drawnText) this.draw();
	}

	draw(): void {
		this.drawnText = this.editing.text;
		this.removeBlocks();
		this.rootEl.empty();
		const { file } = this;
		const message = this.message();
		if (!file || message !== null) {
			this.rootEl.createDiv({ cls: 'princelists-block-message', text: message ?? '' });
			return;
		}
		this.rootEl.createEl('a', { cls: 'internal-link', text: file.basename, attr: { 'data-href': file.path, href: file.path } });
		this.rowsEl.empty();
		this.rootEl.append(this.rowsEl);
		const lines = splitLines(this.editing.text);
		const model = parseList(lines, contentStartLine(this.editing.text));
		const sections = visibleSections(lines, model, new Date(), { showArchived: false, query: '', keepLine: null, collapsed: new Set() });
		for (const section of sections) {
			if (section.heading) this.rowsEl.append(buildHeading(this, file.path, section.heading, this.blocks));
			let list: HTMLUListElement | null = null;
			for (const row of section.rows) {
				if (row.kind === 'untouched') continue;
				list ??= this.rowsEl.createEl('ul', { cls: ITEMS_CLASS });
				list.append(buildRow(this, file.path, row, this.blocks));
			}
		}
		const button = this.rootEl.createEl('button', { cls: NEW_ITEM_CLASS });
		setIcon(button.createSpan({ cls: 'princelists-block-new-item-icon' }), 'plus');
		button.createSpan({ text: 'New item' });
	}

	// The gray line in place of the rows, or null when there are rows to draw.
	private message(): string | null {
		if (this.link === null) return 'This block needs a link to a list, such as [[Groceries]].';
		if (!this.file) return `[[${this.link}]] doesn't lead to a note.`;
		if (this.file.path === this.notePath) return `[[${this.link}]] is this note, so it can't show here.`;
		return isListText(this.editing.text) ? null : `[[${this.link}]] isn't a list.`;
	}

	// Which file the link leads to, read again when the vault adds, renames or removes a file.
	private async resolve(): Promise<void> {
		const file = this.link === null ? null : this.app.metadataCache.getFirstLinkpathDest(getLinkpath(this.link), this.notePath);
		if (file === this.file && (file?.path ?? null) === this.shownPath) return;
		this.file = file;
		this.shownPath = file?.path ?? null;
		if (this.field) noticeLostField(this.field.el.win, this.field.el.value);
		this.field = null;
		this.echoes = new WriteEchoes();
		this.editing.reset();
		this.outsideChanges++;
		const text = file && file.extension === 'md' && file.path !== this.notePath ? await this.app.vault.cachedRead(file) : '';
		if (this.file !== file) return;
		this.editing.text = text;
		this.draw();
	}

	private fileChanged(file: TFile, data: string): void {
		if (file !== this.file || file.path === this.notePath) return;
		if (this.echoes.isEcho(data) || data === this.editing.text) return;
		this.takeOutsideChange(data);
	}

	// An open field stays as it is **(call)**: it saves to its line as the change moved it, and the block
	// draws the change when it closes.
	private takeOutsideChange(text: string): void {
		this.outsideChanges++;
		this.editing.outsideChange(text);
		if (!this.field) this.draw();
	}

	private onClick(evt: MouseEvent): void {
		const target = targetOf(evt);
		if (!target) return;
		if (this.field && !target.closest(`.${BLOCK_FIELD_CLASS}`)) closeBlockField(this, true);
		if (handleLinkClick(this.app, this.file?.path ?? this.notePath, evt, target)) return;
		if (target.closest(`.${NEW_ITEM_CLASS}`)) {
			addBlockItem(this, 'first');
			return;
		}
		// The field's own line: rows aren't drawn again while it's open, so theirs may be out of date.
		const fieldLine = this.field?.line.line;
		if (target.closest(`.${BLOCK_TRASH_CLASS}`)) {
			if (fieldLine !== null && fieldLine !== undefined) deleteBlockItem(this, fieldLine);
			return;
		}
		const line = this.rowLine(target);
		if (line === null) return;
		if (target.closest(`.${CHECKBOX_CLASS}`)) {
			// The box shows the file: the redraw after the write ticks it.
			evt.preventDefault();
			this.queueTick(line);
		} else if (target.closest('.princelists-item-title')) {
			openBlockField(this, line, null);
		}
	}

	private onKeyDown(evt: KeyboardEvent): void {
		if (!this.field || evt.target !== this.field.el || evt.isComposing) return;
		if (evt.key === 'Escape') {
			evt.preventDefault();
			closeBlockField(this, false);
		} else if (evt.key === 'Enter') {
			evt.preventDefault();
			if (evt.shiftKey) addBlockItemBelow(this);
			else closeBlockField(this, true);
		}
	}

	private onFocusOut(evt: FocusEvent): void {
		if (this.field && evt.target === this.field.el) closeBlockField(this, true);
	}

	// On the Mac only: the iPhone has the field's trash button.
	private onContextMenu(evt: MouseEvent): void {
		const target = targetOf(evt);
		if (!target || handleLinkMenu(this.app, this.file?.path ?? this.notePath, evt, target)) return;
		const line = this.rowLine(target);
		if (line === null) return;
		evt.preventDefault();
		showBlockItemMenu(this, evt, line);
	}

	// As a tick in the list view: it waits on the block's queue, and its line follows the block's own
	// writes meanwhile.
	private queueTick(line: number): void {
		const file = this.file;
		const pending = this.editing.track(line);
		const seen = this.outsideChanges;
		void this.enqueue(async () => {
			try {
				if (this.file !== file) return;
				if (this.outsideChanges !== seen) {
					new Notice(CHANGED_ELSEWHERE_NOTICE);
					return;
				}
				const titleLine = pending.line;
				const text = this.editing.text;
				const lines = splitLines(text);
				const item = titleLine === null ? null : itemAt(parseList(lines, contentStartLine(text)), titleLine);
				if (titleLine === null || !item) return;
				const now = new Date();
				const edited = tryEdit(() => toggleItem(lines, item, now));
				if (!edited) return;
				await this.write(joinLines(edited), text, { start: titleLine, delta: 0, kind: 'change', retitle: (title) => toggleLine(title, now) });
				if (!this.field) this.draw();
			} finally {
				this.editing.untrack(pending);
			}
		});
	}

	private removeBlocks(): void {
		for (const block of this.blocks.values()) this.removeChild(block);
		this.blocks.clear();
	}
}
