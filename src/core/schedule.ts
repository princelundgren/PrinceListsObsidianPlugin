import { isArchived } from './archive';
import { isFiltered, timelessItemRow, whenMatches, type Find } from './display';
import { getItemNotes } from './edit-items';
import { splitLines } from './lines';
import { parseList } from './parse';
import { carriesTags, stripTags } from './tags';
import { daysFrom } from './when';

export interface ScheduledItem {
	listPath: string;
	listName: string;
	titleLine: number;
	/** The title line's text. */
	line: string;
	title: string;
	starred: boolean;
	/** The item's tags without their `#`: the title's, then the tail's. */
	tags: string[];
	/** The tail's tags. */
	tailTags: string[];
	done: boolean;
	day: string;
	/** The item's place in its list. */
	order: number;
	notes: string;
}

export type ScheduleGroup = 'today' | 'tomorrow' | 'week' | 'later';

const GROUP_ORDER: readonly ScheduleGroup[] = ['today', 'tomorrow', 'week', 'later'];

// Items with a When, done ones included: whether one is archived depends on when it's drawn.
export function datedItems(text: string, contentStart: number, list: { path: string; name: string }): ScheduledItem[] {
	const lines = splitLines(text);
	const items = parseList(lines, contentStart).sections.flatMap((section) => section.items);
	const scheduled: ScheduledItem[] = [];
	items.forEach((item, order) => {
		const { titleLine } = item;
		const line = lines[titleLine]?.text ?? '';
		const row = timelessItemRow(line, titleLine);
		if (row.when === null) return;
		const { title, starred, done, when: day, tags, tailTags } = row;
		scheduled.push({ listPath: list.path, listName: list.name, titleLine, line, title, starred, tags, tailTags, done, day, order, notes: getItemNotes(lines, item) });
	});
	return scheduled;
}

/** The items that are open, or done and not yet archived at `now` with `archiveDelayMs`. */
export function unarchived(items: readonly ScheduledItem[], now: Date, archiveDelayMs: number): ScheduledItem[] {
	return items.filter((item) => !(item.done && isArchived(item.line, now, archiveDelayMs)));
}

/** Whether `find` finds the item: its title, its notes or its list's name fuzzily, or its day as exact text. */
export function matchesSchedule(item: ScheduledItem, find: Find): boolean {
	return [item.title, item.notes, item.listName].some((text) => find.fuzzyMatches(text)) || whenMatches(item.day, find);
}

// Today takes everything overdue too.
export function scheduleGroup(day: string, today: string): ScheduleGroup {
	const days = daysFrom(today, day);
	if (days <= 0) return 'today';
	if (days === 1) return 'tomorrow';
	return days <= 7 ? 'week' : 'later';
}

const inScheduleOrder = (items: readonly ScheduledItem[]) =>
	[...items].sort((a, b) => a.day.localeCompare(b.day) || a.listName.localeCompare(b.listName) || a.order - b.order);

export function groupSchedule(items: readonly ScheduledItem[], today: string): { group: ScheduleGroup; items: ScheduledItem[] }[] {
	const sorted = inScheduleOrder(items);
	return GROUP_ORDER.map((group) => ({ group, items: sorted.filter((item) => scheduleGroup(item.day, today) === group) })).filter(
		({ items }) => items.length > 0,
	);
}

export interface ScheduleFilter {
	/** What Cmd+F's field finds, or null while it holds nothing. */
	find: Find | null;
	/** "Show starred only": hides every item that isn't starred. */
	starredOnly: boolean;
	/** The lit tags: an item shows only if it carries every one. */
	tags: readonly string[];
}

export interface ShownGroup {
	group: ScheduleGroup;
	/** The heading's arrow shows it collapsed, whether or not a filter shows items under it. */
	collapsed: boolean;
	items: ScheduledItem[];
}

/** Whether a filter is on and `groups`, shownSchedule's of `items` for `filter`, hold none of them. */
export function scheduleFindsNothing(items: readonly ScheduledItem[], groups: readonly ShownGroup[], filter: ScheduleFilter): boolean {
	return isFiltered(filter) && items.length > 0 && groups.every((group) => group.items.length === 0);
}

/**
 * The Schedule's groups as drawn: only the items `filter` matches, and a group only while one does. A
 * collapsed group has no items under it, unless a query, "Show starred only" or a lit tag filters
 * the Schedule.
 */
export function shownSchedule(items: readonly ScheduledItem[], today: string, filter: ScheduleFilter, collapsed: ReadonlySet<ScheduleGroup>): ShownGroup[] {
	const { find, starredOnly, tags } = filter;
	const filtering = isFiltered(filter);
	return groupSchedule(
		items.filter((item) => (!starredOnly || item.starred) && carriesTags(item.tags, tags) && (find === null || matchesSchedule(item, find))),
		today,
	).map(({ group, items: matches }) => {
		const isCollapsed = collapsed.has(group);
		return { group, collapsed: isCollapsed, items: isCollapsed && !filtering ? [] : matches };
	});
}

/** The tags the strip offers for the Schedule: those of `items` in the Schedule's order, and the lit ones. */
export function scheduleStripTags(items: readonly ScheduledItem[], lit: readonly string[]): string[] {
	return stripTags(inScheduleOrder(items).map((item) => item.tags), lit);
}
