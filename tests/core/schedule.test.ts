import { describe, expect, test } from 'vitest';
import { groupSchedule, scheduleGroup, scheduledItems, type ScheduledItem } from '../../src/core/schedule';

const now = new Date(2026, 9, 27, 12, 0);
const list = { path: 'Lists/Home.md', name: 'Home' };

describe('scheduledItems', () => {
	test('keeps open items with a When and done ones not yet archived, across sections', () => {
		const text = [
			'---',
			'princelists: true',
			'---',
			'- [ ] open ⏳ 2026-10-28',
			'- [ ] no when',
			'- [x] ticked today ✔ 2026-10-27 11:00 ⏳ 2026-10-27',
			'- [x] archived ✔ 2026-10-25 09:00 ⏳ 2026-10-25',
			'```',
			'- [ ] fenced ⏳ 2026-10-28',
			'```',
			'## Later',
			'- [ ] under a heading ⭐ ⏳ 2026-11-02',
			'',
		].join('\n');
		const items = scheduledItems(text, 3, now, list);
		expect(items.map(({ title, titleLine, day, done, starred, order }) => ({ title, titleLine, day, done, starred, order }))).toEqual([
			{ title: 'open', titleLine: 3, day: '2026-10-28', done: false, starred: false, order: 0 },
			{ title: 'ticked today', titleLine: 5, day: '2026-10-27', done: true, starred: false, order: 2 },
			{ title: 'under a heading', titleLine: 11, day: '2026-11-02', done: false, starred: true, order: 4 },
		]);
		expect(items[0]).toMatchObject({ listPath: 'Lists/Home.md', listName: 'Home', line: '- [ ] open ⏳ 2026-10-28' });
	});
});

describe('scheduleGroup', () => {
	test.each([
		['2026-10-20', 'today'],
		['2026-10-27', 'today'],
		['2026-10-28', 'tomorrow'],
		['2026-10-29', 'week'],
		['2026-11-03', 'week'],
		['2026-11-04', 'month'],
		['2026-11-27', 'month'],
		['2026-11-28', 'later'],
	])('%s from 2026-10-27 is %s', (day, group) => {
		expect(scheduleGroup(day, '2026-10-27')).toBe(group);
	});
	test('counts 31 days across a month end', () => {
		expect(scheduleGroup('2026-12-01', '2026-10-31')).toBe('month');
	});
});

describe('groupSchedule', () => {
	const item = (listName: string, order: number, day: string): ScheduledItem => ({
		listPath: `${listName}.md`,
		listName,
		titleLine: order,
		line: `- [ ] ${listName} ${order}`,
		title: `${listName} ${order}`,
		starred: false,
		done: false,
		day,
		order,
	});

	test('sorts by day, then list name, then place in the list, and leaves out empty groups', () => {
		const items = [item('Home', 2, '2026-10-27'), item('Groceries', 5, '2026-10-29'), item('Home', 1, '2026-10-27'), item('Groceries', 9, '2026-10-27'), item('Home', 0, '2026-10-26')];
		const groups = groupSchedule(items, '2026-10-27');
		expect(groups.map(({ group, items }) => [group, items.map((i) => i.title)])).toEqual([
			['today', ['Home 0', 'Groceries 9', 'Home 1', 'Home 2']],
			['week', ['Groceries 5']],
		]);
	});
});
