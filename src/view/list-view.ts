import type { EditorView } from '@codemirror/view';
import { type Component, debounce, type Menu, type Modal, Platform, TextFileView, type TFile, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_LIST, VIEW_TYPE_MARKDOWN } from '../constants';
import { CollapsedHeadings } from '../core/collapsed';
import { ListEditing } from '../core/editing';
import { labelWithKey } from '../core/key-name';
import { rememberLast } from '../core/last-result';
import { splitLines, type Line } from '../core/lines';
import { listInheritedTags } from '../core/display';
import type { InheritedTags } from '../core/inherited-tags';
import type { OverdueStyle } from '../core/overdue';
import { parseList, type ListModel } from '../core/parse';
import type { RepeatDraft } from '../core/repeat-line';
import { serialQueue } from '../core/queue';
import { RowSelection } from '../core/selection';
import type { TagStripMode } from '../core/tag-strip-mode';
import { NO_LIT_TAGS, type LitTags } from '../core/tags';
import { dayOf } from '../core/when';
import type { ArchiveDelay } from '../obsidian/archive-delay';
import type { OverdueLook } from '../obsidian/overdue-look';
import { contentStartLine, isListText, listTags } from '../obsidian/marker';
import type { PrinceListsSettings } from '../obsidian/settings';
import { buildNewItemButton } from './add-button';
import type { Card } from './card';
import { closeRepeatPopover } from './card-repeat';
import { closeTagPopover } from './card-tags';
import { bringBackInList } from './come-back';
import { fitHeight } from './dom';
import { listDragHost } from './drag-host';
import { enableMouseDrag } from './drag-mouse';
import { enableTouchDrag } from './drag-touch';
import { swallowClickAfterHold } from './events';
import { FindPaint } from './find-highlight';
import { FILTER_PAUSE_MS, type FilterField, type FilterHost } from './filter';
import { ADD_KEY_NAME, registerListKeys } from './keys';
import type { ListNoteSession, ListTitleSession } from './fields';
import type { HeadingField } from './heading-field';
import type { DraftBase } from './line-edit';
import { enableMouseHold } from './hold-mouse';
import { addHeaderActions, syncButtons } from './list-buttons';
import { clearList } from './list-clear';
import { registerListEvents } from './list-events';
import { paintRendered } from './list-find';
import { outsideChange } from './list-follow';
import { addListPaneItems } from './list-pane-menu';
import { redraw } from './redraw';
import { buildSelectionBar } from './selection-bar';
import { buildTagsPopover, closeTagsPopover, placeTagsPopover } from './tags-popover';
import type { TagSuggest } from './tag-suggest';

// canAcceptExtension stays at its default of false: true would open every note clicked from a
// list pane in the list view.
export class PrinceListView extends TextFileView implements FilterHost {
	// The exact file text, apart from the inherited `data`, with every keystroke applied to it for
	// getViewData and Obsidian's merge, and the line-based state that follows it.
	readonly editing = new ListEditing(contentStartLine);
	// Off each time a list opens: clear() turns it off, and it stays out of getState and local
	// storage, so nothing restores it (spec, "Done and archived").
	showArchived = false;
	/** Off each time a list opens, as showArchived is. */
	starredOnly = false;
	/** None each time a list opens, as starredOnly is. */
	litTags: LitTags = NO_LIT_TAGS;
	card: Card | null = null;
	/** The open card's tag popover, its field and the field's type-ahead, or null while it is closed. */
	tagPopover: { el: HTMLElement; input: HTMLInputElement; suggest: TagSuggest } | null = null;
	/** The open card's repeat form, the item's line as it read and the outside changes when it opened, its draft, and on mobile the modal it's in rather than a popover; null while it is closed. */
	repeatPopover: { el: HTMLElement; opened: DraftBase; draft: RepeatDraft | 'read-only'; modal: Modal | null } | null = null;
	listTitle: ListTitleSession | null = null;
	listNote: ListNoteSession | null = null;
	// Not `titleEl`: ItemView has an undocumented `titleEl`, the pane header's title, which Obsidian
	// sets text on while it loads the view, so a field of that name broke opening a list.
	listTitleEl: HTMLTextAreaElement | null = null;
	listNoteEl: HTMLElement | null = null;
	/** The list note's editor, there while the file is a list. */
	listNoteEditor: EditorView | null = null;
	headingField: HeadingField | null = null;
	/** Cmd+F's query, or null while its field is closed. Like showArchived, nothing restores it. */
	filter: string | null = null;
	readonly collapsed = new CollapsedHeadings(this.editing);
	/** The rows selected to act on together; never saved, so closing the list ends it. */
	readonly selection = new RowSelection(this.editing);
	/** Whether the view is selecting: from the first row selected until none is, with the bar in place of the floating "+". */
	selecting = false;
	/** The items and headings being added whose card or field hasn't opened yet; on mobile they hide the floating "+" as an open card does. */
	addsPending = 0;
	readonly dragsRows = true;
	readonly dragsHeadings = true;
	filterField: FilterField | null = null;
	newItemButton: HTMLButtonElement | null = null;
	findAction: HTMLElement | null = null;
	scheduleAction: HTMLElement | null = null;
	/** The rendered titles, headings and list note, by the element they belong to. */
	readonly blocks = new Map<HTMLElement, Component>();
	/** The colors of what Cmd+F's words match in this list's titles. */
	readonly findPaint = new FindPaint();
	// One-off writes wait for the one before to land, then edit the text as it left it, so two quick
	// taps on one box tick and untick it, and taps on two rows both land.
	readonly enqueue = serialQueue((error) => console.error(error));
	/** Draws the rows Cmd+F's query matches once typing pauses, rather than at every letter. */
	readonly redrawFiltered = debounce(() => this.render(), FILTER_PAUSE_MS, true);
	private readonly parsedText = rememberLast((text) => {
		const lines = splitLines(text);
		const model = parseList(lines, contentStartLine(text));
		return { lines, model, inherited: listInheritedTags(lines, model, listTags(text)) };
	});
	// The day the rows were drawn on, whose days read differently after midnight.
	private drawnDay: string | null = null;
	/** How many outside changes the view has taken, so a queued tap can tell one landed. */
	outsideChanges = 0;
	/** Whether the last redraw left out rows inside the list note being typed. */
	rowsHeldBack = false;
	/** Set once the view closes, so a tap still queued then does nothing. */
	viewClosed = false;
	/**
	 * Set when a press must open nothing, such as one that ends a hold or closes a popover or menu, so
	 * its click is held back.
	 */
	swallowNextClick = false;
	/** The menu the view showed last, while it shows (spec, "Selecting and adding"). */
	shownMenu: Menu | null = null;
	// The list scrolls here, not in contentEl, so nothing relies on Obsidian's stylesheet scrolling
	// `.view-content`. Not `scrollEl`: that may be a name Obsidian's views use at runtime.
	readonly listScrollEl: HTMLElement;
	/** What the view draws, at Obsidian's readable line width, as a Markdown view's sizer. */
	readonly listSizerEl: HTMLElement;
	readonly tagStripMode = (): TagStripMode => this.settings().tagStrip;
	readonly overdueStyle = (): OverdueStyle => this.overdueLook.style;

	constructor(
		leaf: WorkspaceLeaf,
		readonly archiveDelay: ArchiveDelay,
		readonly overdueLook: OverdueLook,
		readonly settings: () => Readonly<PrinceListsSettings>,
	) {
		super(leaf);
		this.contentEl.addClass('princelists-content');
		// Focusable, but not in the tab order, so focus can stay in the view, where its keys reach it (select.ts).
		this.listScrollEl = this.contentEl.createDiv({ cls: 'princelists-scroll', attr: { tabindex: -1 } });
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
			outsideChange(this, data);
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

	clear(): void {
		clearList(this);
	}

	protected async onOpen(): Promise<void> {
		await super.onOpen();
		registerListEvents(this);
		const dragHost = listDragHost(this);
		enableMouseDrag(dragHost);
		if (Platform.isMobile) enableTouchDrag(dragHost);
		if (Platform.isDesktop) enableMouseHold(this);
		this.newItemButton = buildNewItemButton(this, labelWithKey('New item', ADD_KEY_NAME), dragHost.edgeScroll);
		const selectionBar = buildSelectionBar(this);
		swallowClickAfterHold(this, selectionBar);
		buildTagsPopover(this);
		addHeaderActions(this);
		syncButtons(this);
	}

	protected async onClose(): Promise<void> {
		this.viewClosed = true;
		closeTagPopover(this);
		closeRepeatPopover(this);
		closeTagsPopover(this);
		this.redrawFiltered.cancel();
		this.endListNote();
		this.dropListNoteEditor();
		this.selection.clear();
		this.findPaint.clear();
		await super.onClose();
	}

	/** Colors what Cmd+F's words match in `el` once it's rendered, when it's one of this list's titles or a block of the card's notes. */
	markdownRendered(el: HTMLElement): void {
		paintRendered(this, el);
	}

	async onRename(file: TFile): Promise<void> {
		await super.onRename(file);
		this.render();
	}

	onResize(): void {
		super.onResize();
		for (const field of this.contentEl.querySelectorAll('textarea')) fitHeight(field);
		placeTagsPopover(this);
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
		addListPaneItems(this, menu);
	}

	focusListTitle(): void {
		this.listTitleEl?.focus();
		this.listTitleEl?.select();
	}

	lines(): Line[] {
		return splitLines(this.text);
	}

	/** The text's lines, model and inherited tags, parsed once per text. Shared by every caller: never change them. */
	parse(): { lines: readonly Line[]; model: Readonly<ListModel>; inherited: InheritedTags } {
		return this.parsedText(this.text);
	}

	dropBlock(el: HTMLElement): void {
		const block = this.blocks.get(el);
		if (block) this.removeChild(block);
		this.blocks.delete(el);
	}

	// Draws everything from the text, moving what didn't change into place (redraw.ts); a field holding
	// focus, or about to (`focusing`), stays in place and updates after blur. Then brings back any
	// repeating item that came due, as a redraw is when the view sees the day change.
	render(focusing: Element | null = null): void {
		this.redrawFiltered.cancel();
		this.drawnDay = dayOf(new Date());
		redraw(this, focusing);
		syncButtons(this);
		bringBackInList(this);
	}

	// The view or its window got focus. No timer moves the rows' days, so on a new day it draws again.
	returned(): void {
		if (this.drawnDay === null || dayOf(new Date()) === this.drawnDay) bringBackInList(this);
		else this.render();
	}

	/** The toggle is part of the field, so archived items hide again with it. */
	filterClosed(): void {
		this.showArchived = false;
	}

	toggleArchived(): void {
		this.showArchived = !this.showArchived;
		this.render();
	}

	endListNote(): void {
		this.listNote = null;
		this.editing.closeListNote();
	}

	dropListNoteEditor(): void {
		this.listNoteEditor?.destroy();
		this.listNoteEditor = null;
	}
}
