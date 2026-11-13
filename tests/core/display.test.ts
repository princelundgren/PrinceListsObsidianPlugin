import { describe, expect, test } from 'vitest';
import { findsNothing, headingText, isItemVisible, itemRow, listStripTags, visibleSections, type RowFilter } from '../../src/core/display';
import { tickLine } from '../../src/core/item-line';
import { NO_LIT_TAGS } from '../../src/core/tags';
import { containing, list, readFixture } from './edit-helpers';

const DAY = 86_400_000;

const sectionsOf = (
	text: string,
	now: Date,
	showArchived: boolean,
	query = '',
	keepLine: number | null = null,
	collapsed: ReadonlySet<number> = new Set(),
	archiveDelayMs = DAY,
) => {
	const { lines, model } = list(text);
	return visibleSections(lines, model, now, { showArchived, starredOnly: false, lit: NO_LIT_TAGS, archiveDelayMs, find: containing(query), keepLine, collapsed });
};

const row = (titleLine: number, title: string, done = false, label = title, archived = false, starred = false, when: string | null = null, tags: string[] = [], tailTags: string[] = tags, repeats = false) => ({
	kind: 'item',
	titleLine,
	title,
	label,
	done,
	archived,
	starred,
	when,
	tags,
	tailTags,
	repeats,
});
const untouched = (start: number, text: string) => ({ kind: 'untouched', start, text });

describe('visibleSections', () => {
	test('draws the design example: headings, titles without fields, and a done item in place', () => {
		const now = new Date(2026, 9, 21, 12, 0);
		expect(sectionsOf(readFixture('example.md'), now, false)).toEqual([
			{ heading: null, rows: [row(5, 'item before any heading')], collapsed: false },
			{
				heading: { line: 7, text: 'Kitchen' },
				rows: [row(8, 'cutting board'), row(9, 'freezer storage boxes', false, 'freezer storage boxes', false, false, '2026-10-21'), row(17, 'glass jars 1 l', true)],
				collapsed: false,
			},
			{ heading: { line: 19, text: 'Living room' }, rows: [row(20, 'balcony chair')], collapsed: false },
		]);
	});

	test('hides an item 24 hours after its tick, unless archived items are shown', () => {
		const text = '## H\n- [ ] a\n- [x] b ✔ 2026-10-20 10:00\n- [x] c ✔ 2026-10-20 10:01\n';
		const now = new Date(2026, 9, 21, 10, 0);
		expect(sectionsOf(text, now, false)).toEqual([
			{ heading: null, rows: [], collapsed: false },
			{ heading: { line: 0, text: 'H' }, rows: [row(1, 'a'), row(3, 'c', true)], collapsed: false },
		]);
		expect(sectionsOf(text, now, true)[1]?.rows).toEqual([row(1, 'a'), row(2, 'b', true, 'b', true), row(3, 'c', true)]);
	});

	test('hides an item the archive delay it is given after its tick', () => {
		const text = '- [x] a ✔ 2026-10-21 09:00\n- [x] b ✔ 2026-10-21 09:01\n';
		const rows = sectionsOf(text, new Date(2026, 9, 21, 10, 0), false, '', null, new Set(), DAY / 24)[0]?.rows;
		expect(rows).toEqual([row(1, 'b', true)]);
	});

	test.each([
		['a done item with no time', '- [x] a\n'],
		['another done character', '- [-] a\n'],
		['an unreadable time', '- [x] a ✔ 2026-13-45 10:00\n'],
	])('hides %s at once', (_, text) => {
		const now = new Date(2026, 9, 21, 10, 0);
		expect(sectionsOf(text, now, false)[0]?.rows).toEqual([]);
		expect(sectionsOf(text, now, true)[0]?.rows).toEqual([row(0, 'a', true, 'a', true)]);
	});

	test('keeps a heading whose items are all hidden', () => {
		const text = '## Done\n- [x] a\n## Open\n- [ ] b\n';
		expect(sectionsOf(text, new Date(2026, 9, 21), false)).toEqual([
			{ heading: null, rows: [], collapsed: false },
			{ heading: { line: 0, text: 'Done' }, rows: [], collapsed: false },
			{ heading: { line: 2, text: 'Open' }, rows: [row(3, 'b')], collapsed: false },
		]);
	});

	test('shows an open line with a leftover mark as open, and strips tags, fields and the block ID', () => {
		const text = '- [ ] a ✔ 2026-10-01 10:00\n- [x] buy milk ✔ 2026-10-21 09:00 📅 2026-10-30 #shop ^abc1\n';
		expect(sectionsOf(text, new Date(2026, 9, 21, 10, 0), false)[0]?.rows).toEqual([
			row(0, 'a'),
			row(1, 'buy milk', true, 'buy milk', false, false, null, ['shop']),
		]);
	});
});

describe('visibleSections, content the plugin leaves alone', () => {
	test('shows each block between items in its slot, as its raw text', () => {
		expect(sectionsOf(readFixture('top-level-untouched.md'), new Date(2026, 9, 21), false)).toEqual([
			{
				heading: null,
				rows: [
					row(0, 'first'),
					untouched(2, '```\n- [ ] x\n```'),
					untouched(6, '%%\n- [ ] y\n%%'),
					untouched(10, '$$\n- [ ] z\n$$'),
					untouched(14, '<div>\n- [ ] w\n</div>'),
					untouched(18, '| a | b |\n| - | - |\n| 1 | 2 |'),
					untouched(22, '- bullet'),
					row(24, 'last'),
				],
				collapsed: false,
			},
		]);
	});

	test('keeps a block in its own section, and shows it when the items around it are hidden', () => {
		const text = '## A\n- [x] old\n\nText under A\n\n## B\nPara\n\n- [ ] b\n';
		expect(sectionsOf(text, new Date(2026, 9, 21), false)).toEqual([
			{ heading: null, rows: [], collapsed: false },
			{ heading: { line: 0, text: 'A' }, rows: [untouched(3, 'Text under A')], collapsed: false },
			{ heading: { line: 5, text: 'B' }, rows: [untouched(6, 'Para'), row(8, 'b')], collapsed: false },
		]);
	});
});

describe('itemRow', () => {
	test('shows a starred title without its star', () => {
		expect(itemRow('- [ ] milk ⭐', 0, new Date(), DAY)).toEqual(row(0, 'milk', false, 'milk', false, true));
	});

	test('reads the row an item line shows, as the view does after its own tick', () => {
		const now = new Date(2026, 9, 21, 10, 0);
		const ticked = tickLine('- [ ] a 📅 2026-10-30', now);
		expect(itemRow(ticked, 4, now, DAY)).toEqual(row(4, 'a', true));
	});

	test.each([
		['an open repeating line', '- [ ] water ⏳ 2026-11-13 🔁 every day', true],
		['an open line whose repeat it cannot follow', '- [ ] fix the 🔁 every day bug', true],
		['a done repeating line', '- [x] water ⏳ 2026-11-13 🔁 every day ✅ 2026-11-13', false],
		['a 🔁 in the title that is no field', "- [ ] fix the 🔁 icon's color", false],
	])('shows the repeat of %s: %s', (_, text, repeats) => {
		expect(itemRow(text, 0, new Date(2026, 10, 14), DAY).repeats).toBe(repeats);
	});

	test('marks a done item archived 24 hours after its tick', () => {
		const ticked = tickLine('- [ ] a', new Date(2026, 9, 21, 10, 0));
		expect(itemRow(ticked, 0, new Date(2026, 9, 22, 9, 59), DAY).archived).toBe(false);
		expect(itemRow(ticked, 0, new Date(2026, 9, 22, 10, 0), DAY).archived).toBe(true);
	});

	test('marks a done item archived after the delay it is given', () => {
		const ticked = tickLine('- [ ] a', new Date(2026, 9, 21, 10, 0));
		expect(itemRow(ticked, 0, new Date(2026, 9, 21, 10, 59), DAY / 24).archived).toBe(false);
		expect(itemRow(ticked, 0, new Date(2026, 9, 21, 11, 0), DAY / 24).archived).toBe(true);
		expect(itemRow(ticked, 0, new Date(2026, 9, 21, 10, 0), 0).archived).toBe(true);
	});

	test.each([
		['only Tasks fields', '- [ ] 📅 2026-10-30', '📅 2026-10-30', []],
		['only a tag and a block ID', '- [x] #shop ^abc1', '#shop ^abc1', ['shop']],
		['nothing at all', '- [ ] ', '', []],
	])('labels an item with an empty title by the rest of its line: %s', (_, text, label, tags) => {
		const done = text.startsWith('- [x]');
		expect(itemRow(text, 0, new Date(2026, 9, 21), DAY)).toEqual(row(0, '', done, label, done, false, null, tags));
	});
});

describe('headingText', () => {
	test.each([
		['an ATX heading', '## Kitchen\n', 0, 'Kitchen'],
		['a deeper ATX heading with a closing sequence', '### Old ##\n', 0, 'Old'],
		['an indented ATX heading', '  ## Hall\n', 0, 'Hall'],
		['an empty ATX heading', '##\n', 0, ''],
		['a setext heading', 'Kitchen\n===\n', 0, 'Kitchen'],
		['a setext heading over two lines', 'Old\n  line two\n---\n', 0, 'Old line two'],
		['a setext heading after a link reference definition', '[r]: /u\nKitchen\n---\n', 1, 'Kitchen'],
	])('reads %s', (_, text, headingLine, expected) => {
		const { lines, model } = list(`${text}- [ ] a\n`);
		expect(model.sections[1]?.headingLine).toBe(headingLine);
		expect(headingText(lines, headingLine)).toBe(expected);
	});
});

describe('visibleSections, filtered', () => {
	const now = new Date(2026, 9, 21, 12, 0);
	const text = 'Intro\n\n- [ ] Buy milk\n- [ ] Bread\n\n\t**bold** milk\n## Garden\n- [ ] Rake\n## Old\n- [x] milk jug ✔ 2026-10-01 10:00\n';

	test('keeps an item whose title or notes hold the query, ignoring case', () => {
		expect(sectionsOf(text, now, false, 'MILK')).toEqual([
			{ heading: null, rows: [row(2, 'Buy milk'), row(3, 'Bread')], collapsed: false },
			{ heading: { line: 6, text: 'Garden' }, rows: [], collapsed: false },
			{ heading: { line: 8, text: 'Old' }, rows: [], collapsed: false },
		]);
		expect(sectionsOf(text, now, false, '**bold**')[0]?.rows).toEqual([row(3, 'Bread')]);
	});

	test('shows every heading, with or without an item that matches', () => {
		expect(sectionsOf(text, now, false, 'rake').map((section) => section.heading?.text ?? null)).toEqual([null, 'Garden', 'Old']);
	});

	test('hides content the plugin leaves alone while the query is not empty', () => {
		const garden = '## Garden\nA note on rakes\n\n- [ ] Rake\n';
		expect(sectionsOf(garden, now, false, 'rake')[1]?.rows).toEqual([row(3, 'Rake')]);
		expect(sectionsOf(garden, now, false, '')[1]?.rows[0]).toEqual(untouched(1, 'A note on rakes'));
	});

	test('keeps a matching archived item hidden unless archived items are shown', () => {
		expect(sectionsOf(text, now, false, 'jug')[2]).toEqual({ heading: { line: 8, text: 'Old' }, rows: [], collapsed: false });
		expect(sectionsOf(text, now, true, 'jug')[2]).toEqual({
			heading: { line: 8, text: 'Old' },
			rows: [row(9, 'milk jug', true, 'milk jug', true)],
			collapsed: false,
		});
	});

	test('keeps the item on keepLine hidden while it is archived and archived items are hidden', () => {
		expect(sectionsOf(text, now, false, '', 9)[2]).toEqual({ heading: { line: 8, text: 'Old' }, rows: [], collapsed: false });
		expect(sectionsOf(text, now, false, 'rake', 9)[2]).toEqual({ heading: { line: 8, text: 'Old' }, rows: [], collapsed: false });
	});

	test('shows the item on keepLine without matching, and its heading', () => {
		expect(sectionsOf(text, now, false, 'milk', 7)[1]).toEqual({ heading: { line: 6, text: 'Garden' }, rows: [row(7, 'Rake')], collapsed: false });
	});
});

describe('visibleSections, starred only', () => {
	const now = new Date(2026, 9, 21, 12, 0);
	const text = 'Intro\n- [ ] Buy milk ⭐\n- [ ] Bread\n## Garden\n- [ ] Rake\n## Old\n- [x] milk jug ⭐ ✔ 2026-10-01 10:00\n- [ ] Seeds ⭐\n';
	const starred = (filter: { query?: string; showArchived?: boolean; keepLine?: number | null; collapsed?: ReadonlySet<number> } = {}) => {
		const { lines, model } = list(text);
		const { query = '', showArchived = false, keepLine = null, collapsed = new Set<number>() } = filter;
		return visibleSections(lines, model, now, { showArchived, starredOnly: true, lit: NO_LIT_TAGS, archiveDelayMs: DAY, find: containing(query), keepLine, collapsed });
	};

	test('shows only starred items, and every heading', () => {
		expect(starred()).toEqual([
			{ heading: null, rows: [row(1, 'Buy milk', false, 'Buy milk', false, true)], collapsed: false },
			{ heading: { line: 3, text: 'Garden' }, rows: [], collapsed: false },
			{ heading: { line: 5, text: 'Old' }, rows: [row(7, 'Seeds', false, 'Seeds', false, true)], collapsed: false },
		]);
	});

	test('with a query, shows only the starred items it matches', () => {
		expect(starred({ query: 'seed' }).flatMap((section) => section.rows)).toEqual([row(7, 'Seeds', false, 'Seeds', false, true)]);
		expect(starred({ query: 'bread' }).flatMap((section) => section.rows)).toEqual([]);
	});

	test('shows an archived starred item while archived items are shown', () => {
		expect(starred({ showArchived: true })[2]?.rows.map((shown) => shown.kind === 'item' && shown.title)).toEqual(['milk jug', 'Seeds']);
	});

	test('shows the starred items of a collapsed section', () => {
		expect(starred({ collapsed: new Set([5]) })[2]).toEqual({
			heading: { line: 5, text: 'Old' },
			rows: [row(7, 'Seeds', false, 'Seeds', false, true)],
			collapsed: true,
		});
	});

	test("shows the open card's item though it isn't starred", () => {
		expect(starred({ keepLine: 4 })[1]).toEqual({ heading: { line: 3, text: 'Garden' }, rows: [row(4, 'Rake')], collapsed: false });
	});
});

describe('visibleSections, matching the date', () => {
	const now = new Date(2026, 9, 21, 12, 0);
	const text = '- [ ] Renew ⏳ 2026-11-12\n- [ ] Call ⏳ 2026-12-01\n- [ ] Undated\n';

	test('matches the When as the file writes it', () => {
		expect(sectionsOf(text, now, false, '2026-11')[0]?.rows.map((shown) => shown.kind === 'item' && shown.title)).toEqual(['Renew']);
	});

	test('matches the When as exact text, never fuzzily', () => {
		const anyDay = { text: '2026-11', fuzzyMatches: (shown: string) => /^\d{4}-\d{2}-\d{2}$/.test(shown) };
		const { lines, model } = list(text);
		const sections = visibleSections(lines, model, now, { showArchived: false, starredOnly: false, lit: NO_LIT_TAGS, archiveDelayMs: DAY, find: anyDay, keepLine: null, collapsed: new Set() });
		expect(sections[0]?.rows.map((shown) => shown.kind === 'item' && shown.title)).toEqual(['Renew']);
	});
});

describe('visibleSections, collapsed', () => {
	const now = new Date(2026, 9, 21, 12, 0);
	const text = '---\nprincelists: true\n---\n- [ ] a\n## B\n- [ ] b\n## C\n- [ ] c\n';
	const collapsed = new Set([4]);

	test('a collapsed section shows only its heading; the others show as they are', () => {
		expect(sectionsOf(text, now, false, '', null, collapsed)).toEqual([
			{ heading: null, rows: [row(3, 'a')], collapsed: false },
			{ heading: { line: 4, text: 'B' }, rows: [], collapsed: true },
			{ heading: { line: 6, text: 'C' }, rows: [row(7, 'c')], collapsed: false },
		]);
	});

	test('while filtering, matches in a collapsed section show', () => {
		expect(sectionsOf(text, now, false, 'b', null, collapsed)[1]).toEqual({ heading: { line: 4, text: 'B' }, rows: [row(5, 'b')], collapsed: true });
	});

	test("the open card's item shows in a collapsed section", () => {
		expect(sectionsOf(text, now, false, '', 5, collapsed)[1]?.rows).toEqual([row(5, 'b')]);
	});
});

describe('findsNothing', () => {
	const now = new Date(2026, 9, 21, 12, 0);
	const text = 'Intro\n## Garden\n- [ ] Rake\n';
	const filter = (query: string, starredOnly = false): RowFilter => ({ showArchived: false, starredOnly, lit: NO_LIT_TAGS, archiveDelayMs: DAY, find: containing(query), keepLine: null, collapsed: new Set() });
	const nothing = (listText: string, rowFilter: RowFilter) => {
		const { lines, model } = list(listText);
		return findsNothing(model, rowFilter, visibleSections(lines, model, now, rowFilter));
	};

	test('is true while a query matches no item', () => {
		expect(nothing(text, filter('milk'))).toBe(true);
		expect(nothing(text, filter('rake'))).toBe(false);
	});

	test('is true while "Show starred only" finds no starred item', () => {
		expect(nothing(text, filter('', true))).toBe(true);
	});

	test('is false while nothing filters the list', () => {
		expect(nothing(text, filter(''))).toBe(false);
	});

	test('is false for a list with no items, which shows its own hint', () => {
		expect(nothing('Intro\n## Garden\n', filter('milk'))).toBe(false);
	});
});

describe('isItemVisible', () => {
	const now = new Date(2026, 9, 21, 12, 0);
	const text = '---\nprincelists: true\n---\n- [ ] a\n## B\n- [ ] b\n## C\n- [ ] c\n- [x] old ✔ 2026-10-01 10:00\n';
	const visible = (titleLine: number, query = '', collapsed: ReadonlySet<number> = new Set()) => {
		const { lines, model } = list(text);
		return isItemVisible(lines, model, now, { showArchived: false, starredOnly: false, lit: NO_LIT_TAGS, archiveDelayMs: DAY, find: containing(query), keepLine: null, collapsed }, titleLine);
	};

	test('an item in an open section, with no filter, is visible', () => {
		expect(visible(5)).toBe(true);
	});

	test('an item in a collapsed section is hidden', () => {
		expect(visible(5, '', new Set([4]))).toBe(false);
	});

	test('an item the query does not match is hidden', () => {
		expect(visible(5, 'c')).toBe(false);
	});

	test('an archived item is hidden while archived items are hidden', () => {
		expect(visible(8)).toBe(false);
	});
});

describe('lit tags', () => {
	const now = new Date(2026, 9, 21, 12, 0);
	const text = 'Intro\n- [ ] Fries #frozen\n- [ ] Peas #Frozen/green ⭐\n- [ ] Bread\n## Garden\n- [ ] Rake #tools\n\tnotes #x\n- [x] Old #gone ✔ 2026-10-01 10:00\n';
	const filter = (tags: string[], extra: Partial<RowFilter> = {}): RowFilter => ({ showArchived: false, starredOnly: false, lit: { tags, untagged: false }, archiveDelayMs: DAY, find: null, keepLine: null, collapsed: new Set(), ...extra });
	const titles = (rowFilter: RowFilter) => {
		const { lines, model } = list(text);
		return visibleSections(lines, model, now, rowFilter).flatMap(({ rows }) => rows.map((r) => (r.kind === 'item' ? r.title : r.text)));
	};

	test('shows only the items carrying every lit tag, a parent tag included, under every heading', () => {
		const { lines, model } = list(text);
		expect(titles(filter(['frozen']))).toEqual(['Fries', 'Peas #Frozen/green']);
		expect(titles(filter(['frozen', 'tools']))).toEqual([]);
		expect(visibleSections(lines, model, now, filter(['tools'])).map(({ heading }) => heading?.text ?? null)).toEqual([null, 'Garden']);
	});

	test('findsNothing is true when no item carries the tags', () => {
		const { lines, model } = list(text);
		const none = filter(['nothing']);
		expect(findsNothing(model, none, visibleSections(lines, model, now, none))).toBe(true);
		const some = filter(['tools']);
		expect(findsNothing(model, some, visibleSections(lines, model, now, some))).toBe(false);
	});

	test('combines with a query and with "Show starred only" by AND', () => {
		expect(titles(filter(['frozen'], { find: containing('fries') }))).toEqual(['Fries']);
		expect(titles(filter(['frozen'], { starredOnly: true }))).toEqual(['Peas #Frozen/green']);
	});

	test("shows the card's item whether or not it carries the tags", () => {
		expect(titles(filter(['tools'], { keepLine: 3 }))).toEqual(['Bread', 'Rake']);
	});

	test('the strip leaves out an archived item\'s tags until archived items show, keeps a lit tag no item carries, and ignores the notes', () => {
		const { lines, model } = list(text);
		const strip = (showArchived: boolean, lit: string[] = []) => listStripTags(lines, model, now, { showArchived, archiveDelayMs: DAY }, lit);
		expect(strip(false)).toEqual(['frozen', 'Frozen/green', 'tools']);
		expect(strip(true)).toEqual(['frozen', 'Frozen/green', 'gone', 'tools']);
		expect(strip(false, ['zzz'])).toEqual(['frozen', 'Frozen/green', 'tools', 'zzz']);
	});

	test('the strip keeps the casing met first in file order, across headings', () => {
		const { lines, model } = list('## Freezer\n- [ ] Fries #Frozen\n## Later\n- [ ] Peas #frozen\n');
		expect(listStripTags(lines, model, now, { showArchived: false, archiveDelayMs: DAY }, [])).toEqual(['Frozen']);
	});
});

describe('No tag', () => {
	const now = new Date(2026, 9, 21, 12, 0);
	const text = '- [ ] Fries #frozen\n- [ ] #fridge Milk\n- [ ] Bread\n\tnotes #frozen\n## Dry #pantry\n- [ ] Rice\n- [ ] Salt #pantry\n- [ ] Year #1984\n';
	const filter = (tags: string[], extra: Partial<RowFilter> = {}): RowFilter => ({ showArchived: false, starredOnly: false, lit: { tags, untagged: true }, archiveDelayMs: DAY, find: null, keepLine: null, collapsed: new Set(), ...extra });
	const titles = (rowFilter: RowFilter) => {
		const { lines, model } = list(text);
		return visibleSections(lines, model, now, rowFilter).flatMap(({ rows }) => rows.map((r) => (r.kind === 'item' ? r.title : r.text)));
	};

	test("alone shows the items with no tag on their own line, whatever their notes or heading carry", () => {
		expect(titles(filter([]))).toEqual(['Bread', 'Rice', 'Year']);
	});

	test('adds the items with no tag to those carrying every lit tag', () => {
		expect(titles(filter(['frozen']))).toEqual(['Fries', 'Bread', 'Rice', 'Year']);
		expect(titles(filter(['frozen', 'pantry']))).toEqual(['Bread', 'Rice', 'Year']);
	});

	test('combines with a query by AND', () => {
		expect(titles(filter(['frozen'], { find: containing('bread') }))).toEqual(['Bread']);
	});

	test('findsNothing is true when every item has a tag', () => {
		const { lines, model } = list('- [ ] Fries #frozen\n');
		const noTag = filter([]);
		expect(findsNothing(model, noTag, visibleSections(lines, model, now, noTag))).toBe(true);
	});
});
