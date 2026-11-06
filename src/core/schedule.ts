import { isArchived } from './archive';
import { matchesQuery, timelessItemRow } from './display';
import { getItemNotes } from './edit-items';
import { splitLines } from './lines';
import { parseList } from './parse';
import { daysFrom } from './when';

export interface ScheduledItem {
	listPath: string;
	listName: string;
	titleLine: number;
	/** The title line's text. */
	line: string;
	title: string;
	starred: boolean;
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
		const { title, starred, done, when: day } = row;
		scheduled.push({ listPath: list.path, listName: list.name, titleLine, line, title, starred, done, day, order, notes: getItemNotes(lines, item) });
	});
	return scheduled;
}

/** The items that are open, or done and not yet archived at `now` with `archiveDelayMs`. */
export function unarchived(items: readonly ScheduledItem[], now: Date, archiveDelayMs: number): ScheduledItem[] {
	return items.filter((item) => !(item.done && isArchived(item.line, now, archiveDelayMs)));
}

/** Whether Cmd+F's `query` finds the item in its title, its notes or its list's name, as a list's filter matches. */
export function matchesSchedule(item: ScheduledItem, query: string): boolean {
	return matchesQuery(item.title, item.notes, query) || matchesQuery(item.listName, '', query);
}

// Today takes everything overdue too.
export function scheduleGroup(day: string, today: string): ScheduleGroup {
	const days = daysFrom(today, day);
	if (days <= 0) return 'today';
	if (days === 1) return 'tomorrow';
	return days <= 7 ? 'week' : 'later';
}

export function groupSchedule(items: readonly ScheduledItem[], today: string): { group: ScheduleGroup; items: ScheduledItem[] }[] {
	const sorted = [...items].sort((a, b) => a.day.localeCompare(b.day) || a.listName.localeCompare(b.listName) || a.order - b.order);
	return GROUP_ORDER.map((group) => ({ group, items: sorted.filter((item) => scheduleGroup(item.day, today) === group) })).filter(
		({ items }) => items.length > 0,
	);
}

export interface ScheduleFilter {
	/** What Cmd+F's field holds; '' filters nothing. */
	query: string;
	/** "Show starred only": hides every item that isn't starred. */
	starredOnly: boolean;
}

export interface ShownGroup {
	group: ScheduleGroup;
	/** The heading's arrow shows it collapsed, whether or not a filter shows items under it. */
	collapsed: boolean;
	items: ScheduledItem[];
}

/**
 * The Schedule's groups as drawn: only the items `filter` matches, and a group only while one does. A
 * collapsed group has no items under it, unless a query or "Show starred only" filters the Schedule.
 */
export function shownSchedule(items: readonly ScheduledItem[], today: string, filter: ScheduleFilter, collapsed: ReadonlySet<ScheduleGroup>): ShownGroup[] {
	const filtering = filter.query !== '' || filter.starredOnly;
	return groupSchedule(
		items.filter((item) => (!filter.starredOnly || item.starred) && matchesSchedule(item, filter.query)),
		today,
	).map(({ group, items: matches }) => {
		const isCollapsed = collapsed.has(group);
		return { group, collapsed: isCollapsed, items: isCollapsed && !filtering ? [] : matches };
	});
}
