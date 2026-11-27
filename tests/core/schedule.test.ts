import { describe, expect, test } from 'vitest';
import { byList, datedItems, groupByListOf, groupSchedule, listFolder, matchesSchedule, scheduleFindsNothing, scheduleGroup, scheduleStripTags, shownSchedule, unarchived, type ScheduledItem, type ScheduleGroup } from '../../src/core/schedule';
import type { Find } from '../../src/core/display';
import { NO_LIT_TAGS } from '../../src/core/tags';
import { containing } from './edit-helpers';

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

describe('unarchived, repeats', () => {
	test.each([
		['a ticked daily line', '- [x] Water ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14', true],
		['the last time, ticked', '- [x] Water 🔚 1x ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14', false],
		['a Tasks history line', '- [x] Water ⏳ 2026-11-14 🔁 every day ✅ 2026-11-14', false],
		['an open repeating line', '- [ ] Water ⏳ 2026-11-14 🔁 every day', true],
	])('reads %s as itemRow does', (_, line, repeats) => {
		const text = ['---', 'princelists: true', '---', line, ''].join('\n');
		expect(unarchived(datedItems(text, 3, list), new Date(2026, 10, 14, 20, 0), DAY)[0]?.repeats).toBe(repeats);
	});
});

describe('datedItems, repeats', () => {
	test.each([
		['an open repeating line', '- [ ] water ⏳ 2026-11-13 🔁 every day', true],
		['an open line whose repeat it cannot follow', '- [ ] fix the 🔁 every day bug ⏳ 2026-11-13', true],
		['a done repeating line', '- [x] water ⏳ 2026-11-13 🔁 every day ✅ 2026-11-13', false],
		['a 🔁 in the title that is no field', "- [ ] fix the 🔁 icon's color ⏳ 2026-11-13", false],
	])('reads %s', (_, line, repeats) => {
		const text = ['---', 'princelists: true', '---', line, ''].join('\n');
		expect(datedItems(text, 3, list)[0]?.repeats).toBe(repeats);
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
		tags: [],
		carried: [],
		tailTags: [],
		repeats: false,
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

describe('byList', () => {
	const item = (listPath: string, title: string, day: string): ScheduledItem => ({
		listPath,
		listName: listPath.replace(/^.*\//, '').replace(/\.md$/, ''),
		titleLine: 0,
		line: `- [ ] ${title}`,
		title,
		starred: false,
		tags: [],
		carried: [],
		tailTags: [],
		repeats: false,
		done: false,
		day,
		order: 0,
		notes: '',
	});
	const lists = (items: ScheduledItem[]) => byList(items).map(({ listPath, listName, folder, items }) => [listPath, listName, folder, items.map((i) => i.title)]);

	test('splits by list, the lists by name, each keeping its items in the order given', () => {
		const items = groupSchedule(
			[item('Work.md', 'Book the room', '2026-10-27'), item('Groceries.md', 'Milk', '2026-10-27'), item('Work.md', 'Send the report', '2026-10-26')],
			'2026-10-27',
		)[0]!.items;
		expect(lists(items)).toEqual([
			['Groceries.md', 'Groceries', '', ['Milk']],
			['Work.md', 'Work', '', ['Send the report', 'Book the room']],
		]);
	});

	test('gives two lists of one name a subheading each, by path', () => {
		const items = [item('Work/Inbox.md', 'Call Bo', '2026-10-27'), item('Home/Inbox.md', 'Water plants', '2026-10-27'), item('Work/Inbox.md', 'Reply', '2026-10-27')];
		expect(lists(items)).toEqual([
			['Home/Inbox.md', 'Inbox', 'Home', ['Water plants']],
			['Work/Inbox.md', 'Inbox', 'Work', ['Call Bo', 'Reply']],
		]);
	});

	test('has no list for no items', () => {
		expect(byList([])).toEqual([]);
	});
});

describe('listFolder', () => {
	test.each([
		['Groceries.md', ''],
		['Home/Inbox.md', 'Home'],
		['Projects/Q4/Work.md', 'Projects/Q4'],
	])('%s is in %j', (path, folder) => {
		expect(listFolder(path)).toBe(folder);
	});
});

describe('groupByListOf', () => {
	test.each([true, false])('keeps a stored %s', (stored) => {
		expect(groupByListOf(stored)).toBe(stored);
	});

	test.each([undefined, null, 'false', 0])('reads %j as grouped', (stored) => {
		expect(groupByListOf(stored)).toBe(true);
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
		tags: [],
		carried: [],
		tailTags: [],
		repeats: false,
		done: false,
		day: '2026-10-28',
		order: 0,
		notes: 'The oat one',
	};

	test.each([
		['MILK', true],
		['**milk**', true],
		['oat', true],
		['grocer', true],
		['milk oat grocer', true],
		['milk bread', false],
		['**the', false],
		['milk 2026-10-28', false],
		['bread', false],
		['2026-10-28', true],
	])('%j matches: %s', (query, matches) => {
		expect(matchesSchedule(item, containing(query) as Find)).toBe(matches);
	});

	test('matches the day as exact text, never through the word search', () => {
		const anyDay = (text: string) => ({ text, matches: (shown: string) => /^\d{4}-\d{2}-\d{2}$/.test(shown) });
		expect(matchesSchedule(item, anyDay('2026-10'))).toBe(true);
		expect(matchesSchedule(item, anyDay('2026-11'))).toBe(false);
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
		tags: [],
		carried: [],
		tailTags: [],
		repeats: false,
		done: false,
		day,
		order: 0,
		notes: '',
	});
	const items = [item('Call Ann', '2026-10-27'), item('Call Bo', '2026-10-28', true), item('Shop', '2026-10-28')];
	const shown = (query: string, collapsed: ScheduleGroup[], starredOnly = false) =>
		shownSchedule(items, '2026-10-27', { find: containing(query), starredOnly, lit: NO_LIT_TAGS }, new Set(collapsed)).map(({ group, collapsed, items }) => [
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

	test('finds nothing only while a filter is on and no item matches it', () => {
		const findsNothing = (query: string, starredOnly = false) => {
			const filter = { find: containing(query), starredOnly, lit: NO_LIT_TAGS };
			return scheduleFindsNothing(items, shownSchedule(items, '2026-10-27', filter, new Set()), filter);
		};
		expect(findsNothing('nothing like it')).toBe(true);
		expect(findsNothing('shop', true)).toBe(true);
		expect(findsNothing('call')).toBe(false);
		expect(findsNothing('')).toBe(false);
		const none = { find: containing('call'), starredOnly: false, lit: NO_LIT_TAGS };
		expect(scheduleFindsNothing([], [], none)).toBe(false);
	});
});

describe("a list's and a heading's tags in the Schedule", () => {
	const text = ['---', 'princelists: true', '---', '- [ ] before ⏳ 2026-10-28', '## Office #work', '- [ ] under ⏳ 2026-10-28 #own', ''].join('\n');
	const items = datedItems(text, 3, { ...list, tags: ['home'] });
	const titles = (lit: { tags: string[]; untagged: boolean }) =>
		shownSchedule(items, '2026-10-27', { find: null, starredOnly: false, lit }, new Set()).flatMap((g) => g.items.map((i) => i.title));

	test("carried is the own tags then the section's inherited ones, and tags and tailTags stay the own", () => {
		expect(items.map((item) => item.carried)).toEqual([['home'], ['own', 'home', 'work']]);
		expect(items.map((item) => item.tags)).toEqual([[], ['own']]);
		expect(items.map((item) => item.tailTags)).toEqual([[], ['own']]);
	});

	test('shownSchedule counts them: a list tag lights both, a heading tag its section, No tag neither', () => {
		expect(titles({ tags: ['home'], untagged: false })).toEqual(['before', 'under']);
		expect(titles({ tags: ['work'], untagged: false })).toEqual(['under']);
		expect(titles({ tags: [], untagged: true })).toEqual([]);
	});

	test("scheduleStripTags keeps the list's own tags", () => {
		expect(scheduleStripTags(items, [])).toEqual(['home', 'own', 'work']);
	});

	test('a nested list tag lights under its parent', () => {
		const nested = datedItems(text, 3, { ...list, tags: ['work/acme'] });
		const filter = { find: null, starredOnly: false, lit: { tags: ['work'], untagged: false } };
		expect(shownSchedule(nested, '2026-10-27', filter, new Set()).flatMap((g) => g.items)).toHaveLength(2);
	});
});

describe('tags in the Schedule', () => {
	const item = (title: string, day: string, tags: string[], listName = 'Home', order = 0): ScheduledItem => ({
		listPath: `${listName}.md`,
		listName,
		titleLine: order,
		line: `- [ ] ${title}`,
		title,
		starred: false,
		tags,
		carried: tags,
		tailTags: [],
		repeats: false,
		done: false,
		day,
		order,
		notes: '',
	});
	const items = [item('Later', '2026-10-30', ['Frozen']), item('Soon', '2026-10-27', ['frozen', 'shop/a']), item('Plain', '2026-10-28', [])];

	test('shownSchedule shows only items carrying every lit tag, parents included', () => {
		const titles = (tags: string[]) => shownSchedule(items, '2026-10-27', { find: null, starredOnly: false, lit: { tags, untagged: false } }, new Set()).flatMap((g) => g.items.map((i) => i.title));
		expect(titles(['frozen'])).toEqual(['Soon', 'Later']);
		expect(titles(['shop'])).toEqual(['Soon']);
		expect(titles(['frozen', 'shop'])).toEqual(['Soon']);
		const filter = { find: null, starredOnly: false, lit: { tags: ['nope'], untagged: false } };
		expect(scheduleFindsNothing(items, shownSchedule(items, '2026-10-27', filter, new Set()), filter)).toBe(true);
	});

	test('shownSchedule with No tag lit adds the items with no tag', () => {
		const titles = (tags: string[]) => shownSchedule(items, '2026-10-27', { find: null, starredOnly: false, lit: { tags, untagged: true } }, new Set()).flatMap((g) => g.items.map((i) => i.title));
		expect(titles([])).toEqual(['Plain']);
		expect(titles(['shop'])).toEqual(['Soon', 'Plain']);
	});

	test("scheduleStripTags takes the casing of the first item in the Schedule's order, not the file's", () => {
		expect(scheduleStripTags(items, [])).toEqual(['frozen', 'shop/a']);
		expect(scheduleStripTags(items, ['Z'])).toEqual(['frozen', 'shop/a', 'Z']);
	});
});
