import { getLinkpath, MarkdownRenderChild, Notice, Platform, setIcon, type App, type Component, type TFile } from 'obsidian';
import { guardedWrite, type WriteResult } from '../core/action-write';
import { isArchived } from '../core/archive';
import { blockLink } from '../core/block-source';
import { planComeBacks } from '../core/come-back';
import { visibleSections, type SectionRows } from '../core/display';
import { ListEditing } from '../core/editing';
import { NO_LINES_MOVED, type OwnEdit } from '../core/follow';
import { splitLines } from '../core/lines';
import { parseList } from '../core/parse';
import { serialQueue } from '../core/queue';
import { NO_LIT_TAGS } from '../core/tags';
import { dayOf } from '../core/when';
import { WriteEchoes } from '../core/write-echoes';
import type { ArchiveDelay } from '../obsidian/archive-delay';
import { contentStartLine, isListText } from '../obsidian/marker';
import { blockDragHost, enableBlockDrag } from './block-drag';
import { NEW_ITEM_CLASS, registerBlockEvents } from './block-events';
import { noticeLostField, type BlockField } from './block-fields';
import type { RowDragHost } from './drag-host';
import { LIST_BLOCK_CLASS } from './own-rows';
import { buildHeading, buildRow, ITEMS_CLASS, type RowHost } from './render-list';
import { CHANGED_ELSEWHERE_NOTICE, SAVE_FAILED_NOTICE } from './write';

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
	// What the rows showed when drawn, or null when the block drew a message instead.
	private drawnRows: string | null = null;
	// The archive delay changed under an open field or a drag, so the rows are drawn when that ends.
	private delayChangedSinceDraw = false;

	constructor(
		readonly app: App,
		containerEl: HTMLElement,
		source: string,
		private readonly notePath: string,
		private readonly archiveDelay: ArchiveDelay,
	) {
		super(containerEl);
		this.link = blockLink(source);
		this.rootEl = containerEl.createDiv({ cls: LIST_BLOCK_CLASS });
		this.rootEl.toggleClass('princelists-is-mobile', Platform.isMobile);
		this.rowsEl = createDiv({ cls: 'princelists-block-rows' });
	}

	onload(): void {
		const { metadataCache, vault, workspace } = this.app;
		this.registerEvent(metadataCache.on('changed', (file, data) => this.fileChanged(file, data)));
		this.registerEvent(workspace.on('active-leaf-change', (leaf) => {
			if (leaf?.view.containerEl.contains(this.rootEl)) this.bringBack();
		}));
		this.registerEvent(vault.on('create', () => void this.resolve()));
		this.registerEvent(vault.on('rename', () => void this.resolve()));
		this.registerEvent(vault.on('delete', () => void this.resolve()));
		this.registerEvent(this.archiveDelay.onChange(() => {
			if (this.field || this.dragging) this.delayChangedSinceDraw = true;
			else this.drawIfRowsChanged();
		}));
		registerBlockEvents(this, this.rootEl, this.notePath);
		enableBlockDrag(this);
		void this.resolve().then(() => this.bringBack());
	}

	onunload(): void {
		this.removeBlocks();
	}

	// guardedWrite with nothing of its own to save: the block's text changes only by its own writes and
	// the file's. A refusal shows `refusedNotice`, or nothing when it is null.
	async write(next: string, expected: string, edit: OwnEdit, refusedNotice: string | null = CHANGED_ELSEWHERE_NOTICE): Promise<WriteResult> {
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
		if (outcome !== 'written' && refusedNotice !== null) new Notice(refusedNotice);
		return outcome === 'written' ? outcome : 'refused';
	}

	// Writes the due repeating items the block shows back open, archived ones left out (spec, "Coming
	// back"): only when its note opens or gets focus, never when the list changes, and not while it is
	// out of sight or a field or a drag is open. A list another view wrote first refuses it with no notice.
	bringBack(): void {
		const { file } = this;
		if (!file || !this.rootEl.isShown() || this.field || this.dragging || this.message() !== null) return;
		void this.enqueue(async () => {
			if (this.file !== file || this.field || this.dragging || this.message() !== null) return;
			const text = this.editing.text;
			const now = new Date();
			const planned = planComeBacks(text, contentStartLine(text), now, (line) => !isArchived(line, now, this.archiveDelay.ms));
			if (planned && (await this.write(planned.next, text, NO_LINES_MOVED, null)) === 'written' && !this.field) this.draw();
		});
	}

	dragHost(): RowDragHost {
		return blockDragHost(this);
	}

	// Rows aren't drawn while a field is open or a drag holds one, so once the text has changed under
	// them their line attributes are out of date.
	rowsMatchText(): boolean {
		return this.editing.text === this.drawnText;
	}

	// After a field closes, whose title went back in its place, or a drag ends: the rows are drawn
	// again only if the text or the archive delay changed since they were, and never under a drag.
	drawIfChanged(): void {
		if (!this.dragging && (this.editing.text !== this.drawnText || this.delayChangedSinceDraw)) this.draw();
	}

	draw(): void {
		this.drawWith(null);
	}

	// `sections`, when given, are shownSections() of the current text.
	private drawWith(sections: SectionRows[] | null): void {
		this.drawnText = this.editing.text;
		this.delayChangedSinceDraw = false;
		this.drawnRows = null;
		// A drag whose row this detaches may never end here: a drop outside the block, or Escape,
		// sends rowsEl nothing.
		this.dragging = false;
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
		const shown = sections ?? this.shownSections();
		this.drawnRows = rowsKey(file, shown);
		for (const section of shown) {
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

	private shownSections(): SectionRows[] {
		const lines = splitLines(this.editing.text);
		const model = parseList(lines, contentStartLine(this.editing.text));
		return visibleSections(lines, model, new Date(), { showArchived: false, starredOnly: false, lit: NO_LIT_TAGS, archiveDelayMs: this.archiveDelay.ms, find: null, keepLine: null, collapsed: new Set() });
	}

	// A change from outside often leaves every row as drawn, such as a list view's save of an item's notes.
	private drawIfRowsChanged(): void {
		const { file, drawnRows } = this;
		if (!file || drawnRows === null || this.message() !== null) {
			this.draw();
			return;
		}
		const sections = this.shownSections();
		if (rowsKey(file, sections) === drawnRows) this.drawnText = this.editing.text;
		else this.drawWith(sections);
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
		if (this.field) noticeLostField(this.field);
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
		if (!this.field) this.drawIfRowsChanged();
	}

	private removeBlocks(): void {
		for (const block of this.blocks.values()) this.removeChild(block);
		this.blocks.clear();
	}
}

// The link's file, today, which a row's day is shown against, and every heading and item row the block
// draws, with the lines their LINE_ATTRs must keep true.
function rowsKey(file: TFile, sections: SectionRows[]): string {
	const drawn = sections.map(({ heading, rows }) => [heading, rows.filter((row) => row.kind === 'item')]);
	return JSON.stringify([file.path, dayOf(new Date()), drawn]);
}
