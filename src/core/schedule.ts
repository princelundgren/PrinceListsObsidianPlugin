import { isArchived } from './archive';
import { timelessItemRow } from './display';
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
}

export type ScheduleGroup = 'today' | 'tomorrow' | 'week' | 'later';

const GROUP_ORDER: readonly ScheduleGroup[] = ['today', 'tomorrow', 'week', 'later'];

// Items with a When, done ones included: whether one is archived depends on when it's drawn.
export function datedItems(text: string, contentStart: number, list: { path: string; name: string }): ScheduledItem[] {
	const lines = splitLines(text);
	const items = parseList(lines, contentStart).sections.flatMap((section) => section.items);
	const scheduled: ScheduledItem[] = [];
	items.forEach(({ titleLine }, order) => {
		const line = lines[titleLine]?.text ?? '';
		const row = timelessItemRow(line, titleLine);
		if (row.when === null) return;
		const { title, starred, done, when: day } = row;
		scheduled.push({ listPath: list.path, listName: list.name, titleLine, line, title, starred, done, day, order });
	});
	return scheduled;
}

/** The items that are open, or done and not yet archived at `now`. */
export function unarchived(items: readonly ScheduledItem[], now: Date): ScheduledItem[] {
	return items.filter((item) => !(item.done && isArchived(item.line, now)));
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
