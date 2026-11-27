import { debounce, ItemView, type Menu, Platform, Scope, setIcon, setTooltip, type Component, type WorkspaceLeaf } from 'obsidian';
import { SCHEDULE_ICON, VIEW_TYPE_SCHEDULE } from '../constants';
import { labelWithKey } from '../core/key-name';
import { serialQueue } from '../core/queue';
import type { Find } from '../core/display';
import type { OverdueStyle } from '../core/overdue';
import { byList, scheduleFindsNothing, scheduleStripTags, shownSchedule, unarchived, type ScheduledItem, type ScheduleGroup } from '../core/schedule';
import type { TagStripMode } from '../core/tag-strip-mode';
import { litForStrip, NO_LIT_TAGS, type LitTags } from '../core/tags';
import { dayOf } from '../core/when';
import type { ArchiveDelay } from '../obsidian/archive-delay';
import type { OverdueLook } from '../obsidian/overdue-look';
import { addCollapseArrow } from './collapse';
import { bringBackInSchedule } from './come-back';
import { targetOf } from './dom';
import { addStarredOnlyItem, addStarredToggle, buildFilterField, FILTER_ICON, FILTER_TOGGLE_SELECTOR, FILTER_PAUSE_MS, FIND_BUTTON_CLASS, findOf, NO_MATCH_CLASS, NO_MATCH_HINT, openFilter, registerFilterEvents, removeFilterField, syncFilterButton, syncStarredToggle, toggleStarredOnly, type FilterField, type FilterHost } from './filter';
import { FindPaint } from './find-highlight';
import { FIND_KEY_NAME } from './keys';
import type { MarkdownHost } from './notes';
import { HEADING_CLASS, ITEM_TITLE_CLASS, ITEMS_CLASS } from './render-list';
import { showStarColor } from './row-marks';
import { GROUP_BUTTON_CLASS, onScheduleClick } from './schedule-click';
import { isList, listChanged, listDeleted, listRenamed, readList, type ReadList } from './schedule-lists';
import { buildListHeading, buildScheduleRow, LIST_NAME_CLASS, ROW_LIST_CLASS } from './schedule-row';
import { buildTagStrip, showsTagStrip } from './tag-strip';
import { onWindowReturn } from './window-return';

const GROUP_NAMES: Record<ScheduleGroup, string> = {
	today: 'Today',
	tomorrow: 'Tomorrow',
	week: 'Next 7 days',
	later: 'Later',
};

// What Find colors in the Schedule: titles, and list names, which it searches too.
const FIND_SELECTOR = `.${ITEM_TITLE_CLASS}, .${ROW_LIST_CLASS}, .${LIST_NAME_CLASS}`;
const SCHEDULE_ABOUT = 'Dated items from all your lists, by day.';

/** Whether the Schedule groups by list, which the plugin keeps for every Schedule. */
export interface ScheduleGrouping {
	byList(): boolean;
	setByList(on: boolean): void;
}

// Every list's items with a When, by day (spec, "When and the Schedule view").
export class ScheduleView extends ItemView implements MarkdownHost, FilterHost {
	// A static view, as Obsidian's docs class a calendar: a link opens in the main area, not in its place.
	override navigation = false;
	lists = new Map<string, ReadList>();
	readonly rows = new WeakMap<Element, ScheduledItem>();
	readonly headings = new WeakMap<Element, ScheduleGroup>();
	readonly listHeadings = new WeakMap<Element, string>();
	// Only while the view is open, as a list's collapsed headings.
	readonly collapsed = new Set<ScheduleGroup>();
	// Ticks run in turn, so each is worked out on the text the one before it wrote.
	readonly enqueue = serialQueue((error) => console.error(error));
	// Paths an event updated while a refresh was reading, which its older reads must not overwrite.
	// null while no refresh is reading.
	updatedPaths: Set<string> | null = null;
	private refreshes = 0;
	// Each list's text its last comeback failed to write on: a failed write isn't tried again (step one's
	// design, "Saving").
	readonly comeBackFailedOn = new Map<string, string>();
	private blocks: Component[] = [];
	// The colors of what Cmd+F's words match in the titles and list names.
	private readonly findPaint = new FindPaint();
	// Today, the overdue settings, the groups and the tag strip as drawn last. Every field but the notes counts: the rows keep these items, and ticks use their lines.
	private drawn: string | null = null;
	// The day drawn last, whose days read differently after midnight.
	private drawnDay: string | null = null;
	filter: string | null = null;
	filterField: FilterField | null = null;
	/** Off each time the Schedule opens, as its filter is. */
	starredOnly = false;
	/** What the tag strip has lit. */
	litTags: LitTags = NO_LIT_TAGS;
	readonly redrawFiltered = debounce(() => this.render(), FILTER_PAUSE_MS, true);
	// Its own scrolling element, as a list's, so the page takes the list's margins.
	private readonly scrollEl = this.contentEl.createDiv({ cls: 'princelists-scroll' });
	private readonly groupButton: HTMLElement;
	private readonly findButton: HTMLElement;
	private readonly filterSlotEl: HTMLElement;
	// Drawn again on each change, apart from the title and the find field above it, which keeps focus.
	private readonly groupsEl: HTMLElement;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly archiveDelay: ArchiveDelay,
		private readonly overdueLook: OverdueLook,
		readonly tagStripMode: () => TagStripMode,
		readonly grouping: ScheduleGrouping,
	) {
		super(leaf);
		const sizer = this.scrollEl.createDiv({ cls: 'princelists-sizer' });
		const titleRow = sizer.createDiv({ cls: 'princelists-schedule-title-row' });
		titleRow.createDiv({ cls: 'princelists-schedule-title', text: 'Schedule', attr: { role: 'heading', 'aria-level': 1 } });
		// Here rather than in the view's header, which a sidebar hides.
		this.groupButton = titleRow.createEl('button', { cls: GROUP_BUTTON_CLASS });
		setIcon(this.groupButton, 'calendar-arrow-down');
		setTooltip(this.groupButton, 'Sort by date');
		this.syncGroupButton();
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
		this.containerEl.toggleClass('princelists-clears-status-bar', !Platform.isMobile);
		this.contentEl.toggleClass('princelists-is-mobile', Platform.isMobile);
		this.contentEl.toggleClass('princelists-is-phone', Platform.isPhone);
		const { workspace, metadataCache, vault } = this.app;
		this.registerEvent(workspace.on('active-leaf-change', (leaf) => {
			if (leaf === this.leaf) void this.refresh();
		}));
		onWindowReturn(this, this.containerEl, () => {
			// No timer moves the rows' days, so on a new day the window's focus draws them again.
			if (this.drawnDay !== null && dayOf(new Date()) !== this.drawnDay) this.draw();
			bringBackInSchedule(this);
		});
		this.registerEvent(metadataCache.on('changed', (file, data, cache) => listChanged(this, file, data, cache)));
		this.registerEvent(vault.on('rename', (file, oldPath) => void listRenamed(this, file, oldPath)));
		this.registerEvent(vault.on('delete', (file) => listDeleted(this, file.path)));
		this.registerEvent(this.archiveDelay.onChange(() => this.draw()));
		showStarColor(this.contentEl, this.overdueLook.style.starColor);
		this.registerEvent(this.overdueLook.onChange(() => {
			showStarColor(this.contentEl, this.overdueLook.style.starColor);
			this.draw();
		}));
		this.registerDomEvent(this.contentEl, 'click', (evt) => onScheduleClick(this, evt));
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
		this.litTags = NO_LIT_TAGS;
		removeFilterField(this);
		this.lists.clear();
		this.comeBackFailedOn.clear();
		this.collapsed.clear();
		this.removeBlocks();
		this.findPaint.clear();
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
		bringBackInSchedule(this);
	}

	onPaneMenu(menu: Menu, source: string): void {
		super.onPaneMenu(menu, source);
		addStarredOnlyItem(menu, this.starredOnly, () => toggleStarredOnly(this));
	}

	render(): void {
		this.redrawFiltered.cancel();
		if (this.filter === null) removeFilterField(this);
		else if (!this.filterField) {
			this.filterField = buildFilterField(this, this.filterSlotEl);
			addStarredToggle(this.filterField);
		}
		this.syncGroupButton();
		syncFilterButton(this.findButton, this);
		syncStarredToggle(this.filterField, this.starredOnly);
		this.draw();
	}

	draw(): void {
		const now = new Date();
		const today = dayOf(now);
		const dated = [...this.lists.values()].flatMap((list) => unarchived(list.items, now, this.archiveDelay.ms));
		const strip = showsTagStrip(this) ? scheduleStripTags(dated, this.litTags.tags) : null;
		if (strip) this.litTags = litForStrip(this.litTags, strip);
		const filter = { find: findOf(this.filter ?? ''), starredOnly: this.starredOnly, lit: this.litTags };
		const groups = shownSchedule(dated, today, filter, this.collapsed);
		// No row shows its notes, so saving them alone draws nothing again.
		const shown = groups.map(({ items, ...group }) => ({ ...group, items: items.map(({ notes: _notes, ...row }) => row) }));
		const grouped = this.grouping.byList();
		const overdue = this.overdueLook.style;
		const drawn = JSON.stringify([today, overdue, dated.length === 0, shown, strip, this.litTags, grouped]);
		this.drawnDay = today;
		// Rows that show the same still match a new query, as from "mi" to "mil", so they're colored again.
		if (drawn === this.drawn) {
			this.paintFind(filter.find);
			return;
		}
		this.drawn = drawn;
		const scroll = this.scrollEl.scrollTop;
		this.removeBlocks();
		this.groupsEl.empty();
		if (strip) buildTagStrip(this.groupsEl, strip, this.litTags);
		if (dated.length === 0) this.groupsEl.createDiv({ cls: 'princelists-schedule-empty', text: "No items have a date. Pick a day with the calendar icon on an item's card." });
		if (scheduleFindsNothing(dated, groups, filter)) this.groupsEl.createDiv({ cls: NO_MATCH_CLASS, text: NO_MATCH_HINT });
		for (const { group, collapsed, items } of groups) {
			const heading = this.groupsEl.createDiv({ cls: HEADING_CLASS, text: GROUP_NAMES[group], attr: { role: 'heading', 'aria-level': 2 } });
			this.headings.set(heading, group);
			addCollapseArrow(heading, collapsed);
			if (!grouped) this.drawRows(items, today, { showsList: true, overdue });
			else {
				for (const list of byList(items)) {
					const listHeading = this.groupsEl.appendChild(buildListHeading(list));
					this.listHeadings.set(listHeading, list.listPath);
					this.drawRows(list.items, today, { showsList: false, overdue });
				}
			}
		}
		this.scrollEl.scrollTop = scroll;
		this.paintFind(filter.find);
	}

	private paintFind(find: Find | null): void {
		this.findPaint.paintAll(Array.from(this.groupsEl.querySelectorAll<HTMLElement>(FIND_SELECTOR)), find);
	}

	/** Colors what Cmd+F's words match in a title once Obsidian has rendered it, while it shows here. */
	markdownRendered(el: HTMLElement): void {
		if (el.hasClass(ITEM_TITLE_CLASS) && this.groupsEl.contains(el)) this.findPaint.paint(el, findOf(this.filter ?? ''));
	}

	private drawRows(items: readonly ScheduledItem[], today: string, options: { showsList: boolean; overdue: OverdueStyle }): void {
		if (items.length === 0) return;
		const list = this.groupsEl.createEl('ul', { cls: ITEMS_CLASS });
		for (const item of items) {
			const { rowEl, block } = buildScheduleRow(this, item, today, options);
			if (block) this.blocks.push(block);
			this.rows.set(rowEl, item);
			list.append(rowEl);
		}
	}

	// Lit while sorted by date, away from the default, as the filter icon is lit while filtering.
	private syncGroupButton(): void {
		const ungrouped = !this.grouping.byList();
		this.groupButton.toggleClass('princelists-ungrouped', ungrouped);
		this.groupButton.setAttribute('aria-pressed', String(ungrouped));
	}

	private removeBlocks(): void {
		for (const block of this.blocks) this.removeChild(block);
		this.blocks = [];
	}
}
