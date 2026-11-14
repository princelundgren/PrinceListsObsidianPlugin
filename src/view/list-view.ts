import type { EditorView } from '@codemirror/view';
import { type Component, debounce, type Menu, Notice, Platform, setTooltip, TextFileView, type TFile, type ViewStateResult, type WorkspaceLeaf } from 'obsidian';
import { SCHEDULE_ICON, VIEW_TYPE_LIST, VIEW_TYPE_MARKDOWN } from '../constants';
import { showsOn } from '../core/button-platforms';
import { CollapsedHeadings } from '../core/collapsed';
import { ListEditing, type Typed } from '../core/editing';
import { followLine, type OwnEdit } from '../core/follow';
import { labelWithKey } from '../core/key-name';
import { rememberLast } from '../core/last-result';
import { splitLines, type Line } from '../core/lines';
import { parseList, type ListModel } from '../core/parse';
import type { RepeatDraft } from '../core/repeat-line';
import { serialQueue } from '../core/queue';
import { RowSelection } from '../core/selection';
import type { TagStripMode } from '../core/tag-strip-mode';
import { NO_LIT_TAGS, type LitTags } from '../core/tags';
import type { ArchiveDelay } from '../obsidian/archive-delay';
import { contentStartLine, isListText } from '../obsidian/marker';
import { openSchedule } from '../obsidian/open-schedule';
import type { PrinceListsSettings } from '../obsidian/settings';
import { openAsMarkdown } from '../obsidian/switch';
import { buildNewItemButton, hasNoItems, newItem } from './add-button';
import { cardLost, dismissCard, type Card } from './card';
import { closeRepeatPopover } from './card-repeat';
import { closeTagPopover } from './card-tags';
import { bringBackInList } from './come-back';
import { fitHeight } from './dom';
import { listDragHost } from './drag-host';
import { enableMouseDrag } from './drag-mouse';
import { enableTouchDrag } from './drag-touch';
import { registerFieldEvents, swallowClickAfterHold } from './events';
import { addStarredOnlyItem, ARCHIVED_TOGGLE_CLASS, FILTER_ICON, FILTER_PAUSE_MS, syncFilterButton, syncStarredToggle, toggleFilter, toggleStarredOnly, type FilterField, type FilterHost } from './filter';
import { ADD_KEY_NAME, ARCHIVED_KEY_NAME, FIND_KEY_NAME, registerListKeys } from './keys';
import { registerFileRedraws } from './notes-drawing';
import type { ListNoteSession, ListTitleSession } from './fields';
import type { HeadingField } from './heading-field';
import type { DraftBase } from './line-edit';
import { enableMouseHold } from './hold-mouse';
import { ownElements } from './own-rows';
import { redraw } from './redraw';
import { LINE_ATTR, lineOf, setLine } from './render-list';
import { focusListWhenActive } from './select';
import { buildSelectionBar, syncSelectionBar } from './selection-bar';
import { buildSelectionTagPopover, closeSelectionTagPopover, placeSelectionTagPopover } from './selection-tag-popover';
import type { TagSuggest } from './tag-suggest';
import { onWindowReturn } from './window-return';
import { UNSAFE_EDIT_NOTICE } from './write';

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
	/** The open card's repeat popover, the item's line as it read and the outside changes when it opened, and its draft; null while it is closed. */
	repeatPopover: { el: HTMLElement; opened: DraftBase; draft: RepeatDraft | 'read-only' } | null = null;
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
	readonly dragsRows = true;
	readonly dragsHeadings = true;
	filterField: FilterField | null = null;
	private newItemButton: HTMLButtonElement | null = null;
	private newItemAction: HTMLElement | null = null;
	private findAction: HTMLElement | null = null;
	private scheduleAction: HTMLElement | null = null;
	/** The rendered titles, headings and list note, by the element they belong to. */
	readonly blocks = new Map<HTMLElement, Component>();
	// One-off writes wait for the one before to land, then edit the text as it left it, so two quick
	// taps on one box tick and untick it, and taps on two rows both land.
	readonly enqueue = serialQueue((error) => console.error(error));
	/** Draws the rows Cmd+F's query matches once typing pauses, rather than at every letter. */
	readonly redrawFiltered = debounce(() => this.render(), FILTER_PAUSE_MS, true);
	private readonly parsedText = rememberLast((text) => {
		const lines = splitLines(text);
		return { lines, model: parseList(lines, contentStartLine(text)) };
	});
	/** How many outside changes the view has taken, so a queued tap can tell one landed. */
	outsideChanges = 0;
	/** Whether the last redraw left out rows inside the list note being typed. */
	rowsHeldBack = false;
	/** Set once the view closes, so a tap still queued then does nothing. */
	viewClosed = false;
	/**
	 * Set by a hold canceled on a row or heading, a row lifted to drag, or a row held with a mouse, so
	 * the click that ends it opens nothing.
	 */
	swallowNextClick = false;
	// The list scrolls here, not in contentEl, so nothing relies on Obsidian's stylesheet scrolling
	// `.view-content`. Not `scrollEl`: that may be a name Obsidian's views use at runtime.
	readonly listScrollEl: HTMLElement;
	/** What the view draws, at Obsidian's readable line width, as a Markdown view's sizer. */
	readonly listSizerEl: HTMLElement;
	readonly tagStripMode = (): TagStripMode => this.settings().tagStrip;

	constructor(
		leaf: WorkspaceLeaf,
		readonly archiveDelay: ArchiveDelay,
		private readonly settings: () => Readonly<PrinceListsSettings>,
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
		this.dropListNoteEditor();
		this.listNoteEl = null;
		this.headingField = null;
		this.showArchived = false;
		this.starredOnly = false;
		this.litTags = NO_LIT_TAGS;
		this.filter = null;
		this.filterField = null;
		this.collapsed.clear();
		this.selection.clear();
		this.outsideChanges++;
		// Nothing of the old file stays, not even a field with focus, which render() would keep.
		this.listSizerEl.empty();
		// A different file opens at the top; render() keeps the scroll position otherwise.
		this.listScrollEl.scrollTop = 0;
	}

	protected async onOpen(): Promise<void> {
		await super.onOpen();
		this.registerEvent(this.archiveDelay.onChange(() => this.render()));
		this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => {
			if (leaf === this.leaf) bringBackInList(this);
		}));
		onWindowReturn(this, this.containerEl, () => bringBackInList(this));
		registerFieldEvents(this);
		focusListWhenActive(this);
		registerFileRedraws(this);
		this.contentEl.toggleClass('princelists-is-phone', Platform.isPhone);
		// The collapse arrows always show where there's no hover.
		this.contentEl.toggleClass('princelists-is-mobile', Platform.isMobile);
		const dragHost = listDragHost(this);
		enableMouseDrag(dragHost);
		if (Platform.isMobile) enableTouchDrag(dragHost);
		if (Platform.isDesktop) enableMouseHold(this);
		const newItemLabel = labelWithKey('New item', ADD_KEY_NAME);
		this.newItemButton = buildNewItemButton(this, newItemLabel);
		const selectionBar = buildSelectionBar(this);
		swallowClickAfterHold(this, selectionBar);
		buildSelectionTagPopover(this);
		this.newItemAction = this.addAction('plus', newItemLabel, () => newItem(this));
		this.findAction = this.addAction(FILTER_ICON, labelWithKey('Filter list', FIND_KEY_NAME), () => toggleFilter(this));
		// Each action goes left of the ones before, so this one sits leftmost.
		this.scheduleAction = this.addAction(SCHEDULE_ICON, 'Open schedule', () => void openSchedule(this.app.workspace));
		this.syncButtons();
	}

	protected async onClose(): Promise<void> {
		this.viewClosed = true;
		closeTagPopover(this);
		closeRepeatPopover(this);
		closeSelectionTagPopover(this);
		this.redrawFiltered.cancel();
		this.endListNote();
		this.dropListNoteEditor();
		this.selection.clear();
		await super.onClose();
	}

	async onRename(file: TFile): Promise<void> {
		await super.onRename(file);
		this.render();
	}

	onResize(): void {
		super.onResize();
		for (const field of this.contentEl.querySelectorAll('textarea')) fitHeight(field);
		placeSelectionTagPopover(this);
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
					.setTitle('Show archived items')
					.setIcon('archive')
					.setChecked(this.showArchived)
					.onClick(() => this.toggleArchived()),
			);
			addStarredOnlyItem(menu, this.starredOnly, () => toggleStarredOnly(this));
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

	/** The text's lines and model, parsed once per text. Shared by every caller: never change them. */
	parse(): { lines: readonly Line[]; model: Readonly<ListModel> } {
		return this.parsedText(this.text);
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
	// focus, or about to (`focusing`), stays in place and updates after blur. Then brings back any
	// repeating item that came due, as a redraw is when the view sees the day change.
	render(focusing: Element | null = null): void {
		this.redrawFiltered.cancel();
		redraw(this, focusing);
		this.syncButtons();
		bringBackInList(this);
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

	/** Shows or hides the view's buttons, and the selection bar, to match the text, the settings and selecting. */
	syncButtons(): void {
		const isList = isListText(this.text);
		const showsFloating = isList && !this.selecting && this.showsFloatingAdd();
		this.newItemButton?.toggle(showsFloating);
		this.contentEl.toggleClass('princelists-has-floating-add', showsFloating);
		this.newItemAction?.toggle(isList && !this.selecting && this.showsHeaderAdd());
		this.scheduleAction?.toggle(isList && this.settings().showScheduleButton);
		this.syncFindButtons();
		syncSelectionBar(this);
	}

	/** Follows a change to where the "+" buttons show: an empty list is drawn again, since its hint names them. */
	syncAddButtons(): void {
		if (hasNoItems(this)) this.render();
		else this.syncButtons();
	}

	/** Whether the settings show a "+" that adds an item on this device. */
	showsAddButton(): boolean {
		return this.showsFloatingAdd() || this.showsHeaderAdd();
	}

	private showsFloatingAdd(): boolean {
		return showsOn(this.settings().floatingAddButton, Platform.isMobile);
	}

	private showsHeaderAdd(): boolean {
		return showsOn(this.settings().headerAddButton, Platform.isMobile);
	}

	// The header's filter icon shows only on a list, pressed while the field is open. The toggles in
	// the field's row are lit while archived items show and while only starred ones do.
	private syncFindButtons(): void {
		if (this.findAction) {
			this.findAction.toggle(isListText(this.text));
			syncFilterButton(this.findAction, this);
		}
		syncStarredToggle(this.filterField, this.starredOnly);
		const button = this.filterField?.rowEl.querySelector<HTMLElement>(`.${ARCHIVED_TOGGLE_CLASS}`);
		if (!button) return;
		button.toggleClass('princelists-archived-shown', this.showArchived);
		button.setAttribute('aria-pressed', String(this.showArchived));
		setTooltip(button, labelWithKey(this.showArchived ? 'Hide archived items' : 'Show archived items', ARCHIVED_KEY_NAME));
	}

	private outsideChange(data: string): void {
		this.outsideChanges++;
		const before = this.selected;
		const { lostSelected } = this.editing.outsideChange(data);
		if (lostSelected && this.card && before !== null) cardLost(this, this.card, before);
	}

	private shiftLines(edit: OwnEdit): void {
		if (edit.kind === 'change' && edit.delta === 0) return;
		for (const el of ownElements(this.contentEl, `[${LINE_ATTR}]`)) {
			setLine(el, followLine(lineOf(el) as number, edit));
		}
	}
}
