import { type Component, type Menu, Notice, Platform, setTooltip, TextFileView, type TFile, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { SCHEDULE_ICON, VIEW_TYPE_LIST, VIEW_TYPE_MARKDOWN } from '../constants';
import { CollapsedHeadings } from '../core/collapsed';
import { ListEditing, type Typed } from '../core/editing';
import { followLine, type OwnEdit } from '../core/follow';
import { splitLines, type Line } from '../core/lines';
import { parseList, type ListModel } from '../core/parse';
import { serialQueue } from '../core/queue';
import { contentStartLine, isListText } from '../obsidian/marker';
import { openSchedule } from '../obsidian/open-schedule';
import { openAsMarkdown } from '../obsidian/switch';
import { buildNewItemButton, newItem } from './add-button';
import { cardLost, dismissCard, type Card } from './card';
import { fitHeight } from './dom';
import { listDragHost } from './drag-host';
import { enableMouseDrag } from './drag-mouse';
import { enableTouchDrag } from './drag-touch';
import { registerFieldEvents } from './events';
import { registerListKeys } from './keys';
import type { ListNoteSession, ListTitleSession } from './fields';
import type { HeadingField } from './heading-field';
import { redraw } from './redraw';
import { LINE_ATTR, lineOf, setLine } from './render-list';
import { UNSAFE_EDIT_NOTICE } from './write';

// canAcceptExtension stays at its default of false: true would open every note clicked from a
// list pane in the list view.
export class PrinceListView extends TextFileView {
	// The exact file text, apart from the inherited `data`, with every keystroke applied to it for
	// getViewData and Obsidian's merge, and the line-based state that follows it.
	readonly editing = new ListEditing(contentStartLine);
	// Off each time a list opens: clear() turns it off, and it stays out of getState and local
	// storage, so nothing restores it (spec, "Done and archived").
	showArchived = false;
	card: Card | null = null;
	listTitle: ListTitleSession | null = null;
	listNote: ListNoteSession | null = null;
	// Not `titleEl`: ItemView has an undocumented `titleEl`, the pane header's title, which Obsidian
	// sets text on while it loads the view, so a field of that name broke opening a list.
	listTitleEl: HTMLTextAreaElement | null = null;
	listNoteEl: HTMLElement | null = null;
	/** The list note's drawn pieces. */
	listNoteNotes: Component | null = null;
	headingField: HeadingField | null = null;
	/** Cmd+F's query, or null while its field is closed. Like showArchived, nothing restores it. */
	filter: string | null = null;
	readonly collapsed = new CollapsedHeadings(this.editing);
	readonly dragsRows = true;
	readonly dragsHeadings = true;
	filterEl: HTMLInputElement | null = null;
	newItemButton: HTMLButtonElement | null = null;
	newItemAction: HTMLElement | null = null;
	private archivedButton: HTMLElement | null = null;
	/** The rendered titles, headings and list note, by the element they belong to. */
	readonly blocks = new Map<HTMLElement, Component>();
	// One-off writes wait for the one before to land, then edit the text as it left it, so two quick
	// taps on one box tick and untick it, and taps on two rows both land.
	readonly enqueue = serialQueue((error) => console.error(error));
	/** How many outside changes the view has taken, so a queued tap can tell one landed. */
	outsideChanges = 0;
	/** Whether the last redraw left out rows inside the list note being typed. */
	rowsHeldBack = false;
	/** Set once the view closes, so a tap still queued then does nothing. */
	viewClosed = false;
	/**
	 * Set by a hold canceled on a row or heading, or a row lifted to drag, so the click that ends it
	 * opens nothing.
	 */
	swallowNextClick = false;
	// The list scrolls here, not in contentEl, so nothing relies on Obsidian's stylesheet scrolling
	// `.view-content`. Not `scrollEl`: that may be a name Obsidian's views use at runtime.
	readonly listScrollEl: HTMLElement;
	/** What the view draws, at Obsidian's readable line width, as a Markdown view's sizer. */
	readonly listSizerEl: HTMLElement;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.contentEl.addClass('princelists-content');
		this.listScrollEl = this.contentEl.createDiv({ cls: 'princelists-scroll' });
		this.listSizerEl = this.listScrollEl.createDiv({ cls: 'princelists-sizer' });
		// Here, so the scope is in place before the view first takes focus.
		registerListKeys(this);
	}

	get text(): string {
		return this.editing.text;
	}

	/** The path links and embeds in the list resolve from. */
	get sourcePath(): string {
		return this.file?.path ?? '';
	}

	/** The titleLine of the item whose card is open, or null. */
	get selected(): number | null {
		return this.editing.selected;
	}

	getViewType(): string {
		return VIEW_TYPE_LIST;
	}

	getViewData(): string {
		return this.text;
	}

	setViewData(data: string, clear: boolean): void {
		// The view's own writes come back here as a reload of the text it already holds (spec,
		// "Saving and outside changes"), and a redraw would tear down a field that has focus.
		if (!clear && data === this.text) return;
		// TextFileView's per-file reset, for when a different file loads.
		if (clear) {
			this.clear();
			this.editing.text = data;
		} else {
			this.outsideChange(data);
		}
		this.render();
		// Only a reload (`clear` false) switches. A switch from inside the leaf's own load doesn't
		// take effect, and a later one would record a Back entry that lands here again, so Back
		// would loop (spec, "Opening and switching views"). A load shows the button instead.
		if (!isListText(data) && !clear && this.file) {
			// Not through openAsMarkdown: the user didn't choose Markdown, so this note mustn't be
			// held as Markdown in this pane if its marker comes back.
			void this.leaf.setViewState({ type: VIEW_TYPE_MARKDOWN, state: { file: this.file.path } });
		}
	}

	// Nothing here writes: an empty new item stays when the file switches (spec, "Selecting and
	// adding").
	clear(): void {
		dismissCard(this);
		this.editing.reset();
		this.editing.text = '';
		this.listTitle = null;
		this.endListNote();
		this.listNoteEl = null;
		if (this.listNoteNotes) this.removeChild(this.listNoteNotes);
		this.listNoteNotes = null;
		this.headingField = null;
		this.showArchived = false;
		this.filter = null;
		this.collapsed.clear();
		this.outsideChanges++;
		// Nothing of the old file stays, not even a field with focus, which render() would keep.
		this.listSizerEl.empty();
		// A different file opens at the top; render() keeps the scroll position otherwise.
		this.listScrollEl.scrollTop = 0;
	}

	protected async onOpen(): Promise<void> {
		await super.onOpen();
		registerFieldEvents(this);
		// The collapse arrows always show where there's no hover.
		this.contentEl.toggleClass('princelists-is-mobile', Platform.isMobile);
		const dragHost = listDragHost(this);
		enableMouseDrag(dragHost);
		if (Platform.isMobile) enableTouchDrag(dragHost);
		if (Platform.isMobile) this.newItemButton = buildNewItemButton(this);
		this.newItemAction = this.addAction('plus', 'New item', () => newItem(this));
		this.archivedButton = this.addAction('square-check-big', 'Show archived', () => this.toggleArchived());
		this.syncArchivedButton();
	}

	protected async onClose(): Promise<void> {
		this.viewClosed = true;
		await super.onClose();
	}

	async onRename(file: TFile): Promise<void> {
		await super.onRename(file);
		this.render();
	}

	onResize(): void {
		super.onResize();
		for (const field of this.contentEl.querySelectorAll('textarea')) fitHeight(field);
	}

	// setViewState records a history entry when the view type changes, so Back would land on the
	// same note as Markdown. `ViewStateResult.history` is documented; that `false` keeps the entry
	// out is observed (1.14.4, spike 1's check 4).
	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		await super.setState(state, result);
		result.history = false;
	}

	onPaneMenu(menu: Menu, source: string): void {
		super.onPaneMenu(menu, source);
		if (isListText(this.text)) {
			menu.addItem((item) =>
				item
					.setTitle('Show archived')
					.setIcon('archive')
					.setChecked(this.showArchived)
					.onClick(() => this.toggleArchived()),
			);
		}
		menu.addItem((item) =>
			item
				.setTitle('Open schedule')
				.setIcon(SCHEDULE_ICON)
				.onClick(() => void openSchedule(this.app.workspace)),
		);
		menu.addItem((item) =>
			item
				.setTitle('Open as Markdown')
				.setIcon('file-text')
				.onClick(() => {
					if (this.file) void openAsMarkdown(this.leaf, this.file);
				}),
		);
	}

	focusListTitle(): void {
		this.listTitleEl?.focus();
		this.listTitleEl?.select();
	}

	lines(): Line[] {
		return splitLines(this.text);
	}

	parse(): { lines: Line[]; model: ListModel } {
		const lines = this.lines();
		return { lines, model: parseList(lines, contentStartLine(this.text)) };
	}

	// One of the view's own writes landed (writeAction). The line-based state and every row's line
	// follow it at once, so no row is read with a stale line.
	applyOwnText(next: string, edit: OwnEdit): void {
		this.editing.applyOwn(next, edit);
		this.shiftLines(edit);
		// Deleting the selected item closes its card.
		if (this.card && this.selected === null && this.card.lostAt === null) dismissCard(this);
	}

	// A keystroke's edit is already in the text: it saves after Obsidian's 2-second wait.
	handleTyped(typed: Typed): void {
		if ('edit' in typed) {
			this.shiftLines(typed.edit);
			this.requestSave();
		} else if ('refused' in typed && typed.firstRefusal) {
			new Notice(UNSAFE_EDIT_NOTICE);
		}
	}

	dropBlock(el: HTMLElement): void {
		const block = this.blocks.get(el);
		if (block) this.removeChild(block);
		this.blocks.delete(el);
	}

	// Draws everything from the text, moving what didn't change into place (redraw.ts); a field holding
	// focus, or about to (`focusing`), stays in place and updates after blur.
	render(focusing: Element | null = null): void {
		redraw(this, focusing);
		this.syncArchivedButton();
	}

	toggleArchived(): void {
		this.showArchived = !this.showArchived;
		this.render();
	}

	endListNote(): void {
		this.listNote = null;
		this.editing.closeListNote();
	}

	// The header's checkbox shows only on a list, and is lit while archived items show.
	private syncArchivedButton(): void {
		const button = this.archivedButton;
		if (!button) return;
		button.toggle(isListText(this.text));
		button.toggleClass('princelists-archived-shown', this.showArchived);
		button.setAttribute('aria-pressed', String(this.showArchived));
		setTooltip(button, this.showArchived ? 'Hide archived' : 'Show archived');
	}

	private outsideChange(data: string): void {
		this.outsideChanges++;
		const before = this.selected;
		const { lostSelected } = this.editing.outsideChange(data);
		if (lostSelected && this.card && before !== null) cardLost(this, this.card, before);
	}

	private shiftLines(edit: OwnEdit): void {
		if (edit.kind === 'change' && edit.delta === 0) return;
		for (const el of this.contentEl.querySelectorAll(`[${LINE_ATTR}]`)) {
			setLine(el, followLine(lineOf(el) as number, edit));
		}
	}
}
