import { describe, expect, test } from 'vitest';
import { datedItems, groupSchedule, matchesSchedule, scheduleGroup, shownSchedule, unarchived, type ScheduledItem, type ScheduleGroup } from '../../src/core/schedule';

const now = new Date(2026, 9, 27, 12, 0);
const list = { path: 'Lists/Home.md', name: 'Home' };
const DAY = 86_400_000;

describe('datedItems and unarchived', () => {
	test('keep open items with a When and done ones not yet archived, across sections', () => {
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
		const items = unarchived(datedItems(text, 3, list), now, DAY);
		expect(items.map(({ title, titleLine, day, done, starred, order }) => ({ title, titleLine, day, done, starred, order }))).toEqual([
			{ title: 'open', titleLine: 3, day: '2026-10-28', done: false, starred: false, order: 0 },
			{ title: 'ticked today', titleLine: 5, day: '2026-10-27', done: true, starred: false, order: 2 },
			{ title: 'under a heading', titleLine: 11, day: '2026-11-02', done: false, starred: true, order: 4 },
		]);
		expect(items[0]).toMatchObject({ listPath: 'Lists/Home.md', listName: 'Home', line: '- [ ] open ⏳ 2026-10-28' });
	});

	test("keep each item's notes, without their indent", () => {
		const text = ['---', 'princelists: true', '---', '- [ ] call ⏳ 2026-10-28', '', '  Ask about **Friday**', '  - [ ] bring keys', '- [ ] bare ⏳ 2026-10-28', ''].join('\n');
		expect(datedItems(text, 3, list).map((item) => item.notes)).toEqual(['Ask about **Friday**\n- [ ] bring keys', '']);
	});
});

describe('unarchived', () => {
	// A tick more than a day ahead counts as done long ago, and from its time once it is less than a day ahead.
	const text = [
		'---',
		'princelists: true',
		'---',
		'- [x] ticked ✔ 2026-10-27 11:00 ⏳ 2026-10-27',
		'- [x] ahead ✔ 2026-10-30 12:00 ⏳ 2026-10-27',
		'- [ ] open ⏳ 2026-10-28',
		'',
	].join('\n');
	const items = datedItems(text, 3, list);
	const titles = (at: Date, delay = DAY) => unarchived(items, at, delay).map((item) => item.title);

	test.each([
		[new Date(2026, 9, 27, 12, 0), ['ticked', 'open']],
		[new Date(2026, 9, 28, 10, 59), ['ticked', 'open']],
		[new Date(2026, 9, 28, 11, 0), ['open']],
		[new Date(2026, 9, 29, 13, 0), ['ahead', 'open']],
	])('at %s, keeps what a list read then shows', (at, shown) => {
		expect(titles(at)).toEqual(shown);
	});

	test('hides a done item after the delay it is given', () => {
		expect(titles(new Date(2026, 9, 27, 11, 59), DAY / 24)).toEqual(['ticked', 'open']);
		expect(titles(new Date(2026, 9, 27, 12, 0), DAY / 24)).toEqual(['open']);
	});

	test('brings an item back when the clock moves back', () => {
		expect(titles(new Date(2026, 9, 28, 11, 30))).toEqual(['open']);
		expect(titles(new Date(2026, 9, 28, 10, 30))).toEqual(['ticked', 'open']);
	});
});

describe('scheduleGroup', () => {
	test.each([
		['2026-10-20', 'today'],
		['2026-10-27', 'today'],
		['2026-10-28', 'tomorrow'],
		['2026-10-29', 'week'],
		['2026-11-03', 'week'],
		['2026-11-04', 'later'],
		['2026-12-31', 'later'],
	])('%s from 2026-10-27 is %s', (day, group) => {
		expect(scheduleGroup(day, '2026-10-27')).toBe(group);
	});
	test('counts seven days across a month end', () => {
		expect(scheduleGroup('2026-11-07', '2026-10-31')).toBe('week');
		expect(scheduleGroup('2026-11-08', '2026-10-31')).toBe('later');
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
		notes: '',
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

describe('matchesSchedule', () => {
	const item: ScheduledItem = {
		listPath: 'Lists/Groceries.md',
		listName: 'Groceries',
		titleLine: 3,
		line: '- [ ] Buy **milk** ⏳ 2026-10-28',
		title: 'Buy **milk**',
		starred: false,
		done: false,
		day: '2026-10-28',
		order: 0,
		notes: 'The oat one',
	};

	test.each([
		['', true],
		['MILK', true],
		['**milk**', true],
		['oat', true],
		['grocer', true],
		['bread', false],
		['2026-10-28', false],
	])('%j matches: %s', (query, matches) => {
		expect(matchesSchedule(item, query)).toBe(matches);
	});
});

describe('shownSchedule', () => {
	const item = (title: string, day: string, starred = false): ScheduledItem => ({
		listPath: 'Home.md',
		listName: 'Home',
		titleLine: 0,
		line: `- [ ] ${title}`,
		title,
		starred,
		done: false,
		day,
		order: 0,
		notes: '',
	});
	const items = [item('Call Ann', '2026-10-27'), item('Call Bo', '2026-10-28', true), item('Shop', '2026-10-28')];
	const shown = (query: string, collapsed: ScheduleGroup[], starredOnly = false) =>
		shownSchedule(items, '2026-10-27', { query, starredOnly }, new Set(collapsed)).map(({ group, collapsed, items }) => [
			group,
			collapsed,
			items.map((i) => i.title),
		]);

	test('a collapsed group shows only its heading while nothing filters', () => {
		expect(shown('', ['tomorrow'])).toEqual([
			['today', false, ['Call Ann']],
			['tomorrow', true, []],
		]);
	});

	test('while filtering, only matches show, collapsed groups included, and a group without one goes', () => {
		expect(shown('call', ['tomorrow'])).toEqual([
			['today', false, ['Call Ann']],
			['tomorrow', true, ['Call Bo']],
		]);
		expect(shown('shop', [])).toEqual([['tomorrow', false, ['Shop']]]);
		expect(shown('nothing like it', [])).toEqual([]);
	});

	test('starred only shows only starred items, collapsed groups included, and a group without one goes', () => {
		expect(shown('', ['tomorrow'], true)).toEqual([['tomorrow', true, ['Call Bo']]]);
		expect(shown('call', [], true)).toEqual([['tomorrow', false, ['Call Bo']]]);
		expect(shown('shop', [], true)).toEqual([]);
	});
});
