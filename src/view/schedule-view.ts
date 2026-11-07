import { debounce, ItemView, type Menu, Notice, Platform, Scope, setIcon, setTooltip, TFile, type CachedMetadata, type Component, type TAbstractFile, type WorkspaceLeaf } from 'obsidian';
import { SCHEDULE_ICON, VIEW_TYPE_LIST, VIEW_TYPE_SCHEDULE } from '../constants';
import { toggleItem } from '../core/edit-items';
import { isMarkerValue } from '../core/frontmatter';
import { labelWithKey } from '../core/key-name';
import { joinLines, splitLines } from '../core/lines';
import { itemAt, parseList } from '../core/parse';
import { serialQueue } from '../core/queue';
import { datedItems, scheduleFindsNothing, shownSchedule, unarchived, type ScheduledItem, type ScheduleGroup } from '../core/schedule';
import { dayOf } from '../core/when';
import type { ArchiveDelay } from '../obsidian/archive-delay';
import { editListFile } from '../obsidian/file-edit';
import { contentStartLine } from '../obsidian/marker';
import { openAsList } from '../obsidian/switch';
import { addCollapseArrow, COLLAPSE_CLASS } from './collapse';
import { targetOf } from './dom';
import { addStarredOnlyItem, addStarredToggle, buildFilterField, FILTER_ICON, FILTER_TOGGLE_SELECTOR, FILTER_PAUSE_MS, FIND_BUTTON_CLASS, findOf, NO_MATCH_CLASS, NO_MATCH_HINT, openFilter, registerFilterEvents, removeFilterField, STARRED_TOGGLE_CLASS, syncFilterButton, syncStarredToggle, toggleFilter, toggleStarredOnly, type FilterField, type FilterHost } from './filter';
import { FIND_KEY_NAME } from './keys';
import { PrinceListView } from './list-view';
import { handleLinkClick, type MarkdownHost } from './notes';
import { openItem } from './open-item';
import { HEADING_CLASS, ITEM_CLASS, ITEMS_CLASS, TICK_SELECTOR } from './render-list';
import { buildScheduleRow } from './schedule-row';
import { CHANGED_ELSEWHERE_NOTICE, tryEdit } from './write';

const GROUP_NAMES: Record<ScheduleGroup, string> = {
	today: 'Today',
	tomorrow: 'Tomorrow',
	week: 'Next 7 days',
	later: 'Later',
};

const SCHEDULE_ABOUT = 'Dated items from all your lists, by day.';

// A list as the view last read it: a tick is worked out on that text.
interface ReadList {
	text: string;
	items: ScheduledItem[];
}

// Every list's items with a When, by day (spec, "When and the Schedule view").
export class ScheduleView extends ItemView implements MarkdownHost, FilterHost {
	// A static view, as Obsidian's docs class a calendar: a link opens in the main area, not in its place.
	override navigation = false;
	private lists = new Map<string, ReadList>();
	private readonly rows = new WeakMap<Element, ScheduledItem>();
	private readonly headings = new WeakMap<Element, ScheduleGroup>();
	// Only while the view is open, as a list's collapsed headings.
	private readonly collapsed = new Set<ScheduleGroup>();
	// Ticks run in turn, so each is worked out on the text the one before it wrote.
	private readonly enqueue = serialQueue((error) => console.error(error));
	// Paths an event updated while a refresh was reading, which its older reads must not overwrite.
	// null while no refresh is reading.
	private updatedPaths: Set<string> | null = null;
	private refreshes = 0;
	private blocks: Component[] = [];
	// Today and the groups as drawn last. Every field but the notes counts: the rows keep these items, and ticks use their lines.
	private drawn: string | null = null;
	filter: string | null = null;
	filterField: FilterField | null = null;
	/** Off each time the Schedule opens, as its filter is. */
	starredOnly = false;
	readonly redrawFiltered = debounce(() => this.render(), FILTER_PAUSE_MS, true);
	// Its own scrolling element, as a list's, so the page takes the list's margins.
	private readonly scrollEl = this.contentEl.createDiv({ cls: 'princelists-scroll' });
	private readonly findButton: HTMLElement;
	private readonly filterSlotEl: HTMLElement;
	// Drawn again on each change, apart from the title and the find field above it, which keeps focus.
	private readonly groupsEl: HTMLElement;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly archiveDelay: ArchiveDelay,
	) {
		super(leaf);
		const sizer = this.scrollEl.createDiv({ cls: 'princelists-sizer' });
		const titleRow = sizer.createDiv({ cls: 'princelists-schedule-title-row' });
		titleRow.createDiv({ cls: 'princelists-schedule-title', text: 'Schedule', attr: { role: 'heading', 'aria-level': 1 } });
		// Here rather than in the view's header, which a sidebar hides.
		this.findButton = titleRow.createEl('button', { cls: FIND_BUTTON_CLASS });
		setIcon(this.findButton, FILTER_ICON);
		setTooltip(this.findButton, labelWithKey('Filter schedule', FIND_KEY_NAME));
		syncFilterButton(this.findButton, this);
		sizer.createDiv({ cls: 'princelists-schedule-about', text: SCHEDULE_ABOUT });
		this.filterSlotEl = sizer.createDiv();
		this.groupsEl = sizer.createDiv();
		// Only while the Schedule has focus, as in a list: elsewhere Cmd+F stays Obsidian's search.
		this.scope = new Scope(this.app.scope);
		this.scope.register(['Mod'], 'f', () => {
			openFilter(this);
			return false;
		});
	}

	getViewType(): string {
		return VIEW_TYPE_SCHEDULE;
	}

	getDisplayText(): string {
		return 'Schedule';
	}

	getIcon(): string {
		return SCHEDULE_ICON;
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass('princelists-content', 'princelists-schedule');
		this.contentEl.toggleClass('princelists-is-mobile', Platform.isMobile);
		this.contentEl.toggleClass('princelists-is-phone', Platform.isPhone);
		const { workspace, metadataCache, vault } = this.app;
		this.registerEvent(workspace.on('active-leaf-change', (leaf) => {
			if (leaf === this.leaf) void this.refresh();
		}));
		this.registerEvent(metadataCache.on('changed', (file, data, cache) => this.listChanged(file, data, cache)));
		this.registerEvent(vault.on('rename', (file, oldPath) => void this.listRenamed(file, oldPath)));
		this.registerEvent(vault.on('delete', (file) => this.listDeleted(file.path)));
		this.registerEvent(this.archiveDelay.onChange(() => this.draw()));
		this.registerDomEvent(this.contentEl, 'click', (evt) => this.onClick(evt));
		this.registerDomEvent(this.contentEl, 'mousedown', (evt) => {
			if (targetOf(evt)?.closest(FILTER_TOGGLE_SELECTOR)) evt.preventDefault();
		});
		registerFilterEvents(this, this.contentEl);
		await this.refresh();
	}

	async onClose(): Promise<void> {
		// A refresh still reading draws nothing once it finishes.
		this.refreshes++;
		this.drawn = null;
		this.redrawFiltered.cancel();
		this.filter = null;
		this.starredOnly = false;
		removeFilterField(this);
		this.lists.clear();
		this.collapsed.clear();
		this.removeBlocks();
	}

	async refresh(): Promise<void> {
		const refresh = ++this.refreshes;
		const updatedPaths = new Set<string>();
		this.updatedPaths = updatedPaths;
		const { vault, metadataCache } = this.app;
		const files = vault.getMarkdownFiles().filter((file) => isList(metadataCache.getFileCache(file)));
		// The events keep a held list current.
		const read = await Promise.all(
			files.map(async (file) => [file.path, this.lists.get(file.path) ?? readList(file, await vault.cachedRead(file))] as const),
		);
		if (refresh !== this.refreshes) return;
		this.updatedPaths = null;
		const lists = new Map(read.filter(([path]) => !updatedPaths.has(path)));
		for (const path of updatedPaths) {
			const list = this.lists.get(path);
			if (list) lists.set(path, list);
		}
		this.lists = lists;
		this.draw();
	}

	private listChanged(file: TFile, text: string, cache: CachedMetadata): void {
		if (isList(cache)) this.listRead(file, text);
		else this.listDeleted(file.path);
	}

	private listRead(file: TFile, text: string): void {
		this.updatedPaths?.add(file.path);
		this.lists.set(file.path, readList(file, text));
		this.draw();
	}

	private async listRenamed(file: TAbstractFile, oldPath: string): Promise<void> {
		this.updatedPaths?.add(oldPath).add(file.path);
		const wasList = this.lists.delete(oldPath);
		if (file instanceof TFile && isList(this.app.metadataCache.getFileCache(file))) {
			this.lists.set(file.path, readList(file, await this.app.vault.cachedRead(file)));
		} else if (!wasList) {
			return;
		}
		this.draw();
	}

	private listDeleted(path: string): void {
		this.updatedPaths?.add(path);
		if (this.lists.delete(path)) this.draw();
	}

	private onClick(evt: MouseEvent): void {
		const target = targetOf(evt);
		if (target?.closest(`.${FIND_BUTTON_CLASS}`)) {
			toggleFilter(this);
			return;
		}
		if (target?.closest(`.${STARRED_TOGGLE_CLASS}`)) {
			toggleStarredOnly(this);
			return;
		}
		const heading = target?.closest(`.${COLLAPSE_CLASS}`)?.closest(`.${HEADING_CLASS}`);
		const group = heading && this.headings.get(heading);
		if (group) {
			this.toggleGroup(group);
			return;
		}
		const rowEl = target?.closest(`.${ITEM_CLASS}`);
		const item = rowEl && this.rows.get(rowEl);
		if (!target || !item || handleLinkClick(this.app, item.listPath, evt, target)) return;
		if (target.closest(TICK_SELECTOR)) {
			// The box shows the file: the redraw after the write ticks it.
			evt.preventDefault();
			void this.enqueue(() => this.tick(item));
		} else {
			void this.openItem(item);
		}
	}

	private toggleGroup(group: ScheduleGroup): void {
		if (!this.collapsed.delete(group)) this.collapsed.add(group);
		this.draw();
	}

	private async tick(item: ScheduledItem): Promise<void> {
		const list = this.lists.get(item.listPath);
		const file = this.app.vault.getFileByPath(item.listPath);
		if (!list || !file) {
			new Notice(CHANGED_ELSEWHERE_NOTICE);
			return;
		}
		const lines = splitLines(list.text);
		const block = itemAt(parseList(lines, contentStartLine(list.text)), item.titleLine);
		// A change since the row was drawn may have put another item on its line.
		if (!block || lines[item.titleLine]?.text !== item.line) {
			new Notice(CHANGED_ELSEWHERE_NOTICE);
			return;
		}
		const edited = tryEdit(() => toggleItem(lines, block, new Date()));
		if (!edited) return;
		const next = joinLines(edited);
		// Taken at once, so the next tick in this list builds on it before the metadata cache catches up.
		if ((await editListFile(this.app, file, list.text, next)) === 'written') this.listRead(file, next);
	}

	// In a tab that already shows the list, else a new one.
	private async openItem(item: ScheduledItem): Promise<void> {
		const file = this.app.vault.getFileByPath(item.listPath);
		if (!file) {
			new Notice(CHANGED_ELSEWHERE_NOTICE);
			return;
		}
		const { workspace } = this.app;
		// By its state, which a tab restored in the background keeps while its view waits to load.
		const shown = workspace.getLeavesOfType(VIEW_TYPE_LIST).find((leaf) => leaf.getViewState().state?.file === file.path);
		const leaf = shown ?? workspace.getLeaf('tab');
		if (!(leaf.view instanceof PrinceListView && leaf.view.file === file)) await openAsList(leaf, file);
		workspace.setActiveLeaf(leaf, { focus: true });
		if (leaf.view instanceof PrinceListView && leaf.view.file === file) openItem(leaf.view, item.titleLine, item.line);
	}

	onPaneMenu(menu: Menu, source: string): void {
		super.onPaneMenu(menu, source);
		addStarredOnlyItem(menu, this.starredOnly, () => toggleStarredOnly(this));
	}

	render(): void {
		this.redrawFiltered.cancel();
		if (this.filter === null) removeFilterField(this);
		else if (!this.filterField) {
			this.filterField = buildFilterField(this.filterSlotEl, this.filter, 'Find in schedule');
			addStarredToggle(this.filterField);
		}
		syncFilterButton(this.findButton, this);
		syncStarredToggle(this.filterField, this.starredOnly);
		this.draw();
	}

	private draw(): void {
		const now = new Date();
		const today = dayOf(now);
		const dated = [...this.lists.values()].flatMap((list) => unarchived(list.items, now, this.archiveDelay.ms));
		const filter = { find: findOf(this.filter ?? ''), starredOnly: this.starredOnly };
		const groups = shownSchedule(dated, today, filter, this.collapsed);
		// No row shows its notes, so saving them alone draws nothing again.
		const shown = groups.map(({ items, ...group }) => ({ ...group, items: items.map(({ notes: _notes, ...row }) => row) }));
		const drawn = JSON.stringify([today, dated.length === 0, shown]);
		if (drawn === this.drawn) return;
		this.drawn = drawn;
		const scroll = this.scrollEl.scrollTop;
		this.removeBlocks();
		this.groupsEl.empty();
		if (dated.length === 0) this.groupsEl.createDiv({ cls: 'princelists-schedule-empty', text: "No items have a date. Pick a day with the calendar icon on an item's card." });
		if (scheduleFindsNothing(dated, groups, filter)) this.groupsEl.createDiv({ cls: NO_MATCH_CLASS, text: NO_MATCH_HINT });
		for (const { group, collapsed, items } of groups) {
			const heading = this.groupsEl.createDiv({ cls: HEADING_CLASS, text: GROUP_NAMES[group], attr: { role: 'heading', 'aria-level': 2 } });
			this.headings.set(heading, group);
			addCollapseArrow(heading, collapsed);
			if (items.length === 0) continue;
			const list = this.groupsEl.createEl('ul', { cls: ITEMS_CLASS });
			for (const item of items) {
				const { rowEl, block } = buildScheduleRow(this, item, today);
				if (block) this.blocks.push(block);
				this.rows.set(rowEl, item);
				list.append(rowEl);
			}
		}
		this.scrollEl.scrollTop = scroll;
	}

	private removeBlocks(): void {
		for (const block of this.blocks) this.removeChild(block);
		this.blocks = [];
	}
}

function isList(cache: CachedMetadata | null): boolean {
	return isMarkerValue(cache?.frontmatter);
}

function readList(file: TFile, text: string): ReadList {
	return { text, items: datedItems(text, contentStartLine(text), { path: file.path, name: file.basename }) };
}
