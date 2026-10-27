import { describe, expect, test } from 'vitest';
import { headingText, itemRow, visibleSections } from '../../src/core/display';
import { tickLine } from '../../src/core/item-line';
import { list, readFixture } from './edit-helpers';

const sectionsOf = (text: string, now: Date, showArchived: boolean) => {
	const { lines, model } = list(text);
	return visibleSections(lines, model, now, showArchived);
};

const row = (titleLine: number, title: string, done = false, label = title, archived = false, starred = false) => ({
	kind: 'item',
	titleLine,
	title,
	label,
	done,
	archived,
	starred,
});
const untouched = (start: number, text: string) => ({ kind: 'untouched', start, text });

describe('visibleSections', () => {
	test('draws the design example: headings, titles without fields, and a done item in place', () => {
		const now = new Date(2026, 9, 21, 12, 0);
		expect(sectionsOf(readFixture('example.md'), now, false)).toEqual([
			{ heading: null, rows: [row(5, 'item before any heading')] },
			{
				heading: { line: 7, text: 'Kitchen' },
				rows: [row(8, 'cutting board'), row(9, 'freezer storage boxes'), row(17, 'glass jars 1 l', true)],
			},
			{ heading: { line: 19, text: 'Living room' }, rows: [row(20, 'balcony chair')] },
		]);
	});

	test('hides an item 24 hours after its tick, unless archived items are shown', () => {
		const text = '## H\n- [ ] a\n- [x] b ✔ 2026-10-20 10:00\n- [x] c ✔ 2026-10-20 10:01\n';
		const now = new Date(2026, 9, 21, 10, 0);
		expect(sectionsOf(text, now, false)).toEqual([
			{ heading: null, rows: [] },
			{ heading: { line: 0, text: 'H' }, rows: [row(1, 'a'), row(3, 'c', true)] },
		]);
		expect(sectionsOf(text, now, true)[1]?.rows).toEqual([row(1, 'a'), row(2, 'b', true, 'b', true), row(3, 'c', true)]);
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
			{ heading: null, rows: [] },
			{ heading: { line: 0, text: 'Done' }, rows: [] },
			{ heading: { line: 2, text: 'Open' }, rows: [row(3, 'b')] },
		]);
	});

	test('shows an open line with a leftover mark as open, and strips tags, fields and the block ID', () => {
		const text = '- [ ] a ✔ 2026-10-01 10:00\n- [x] buy milk ✔ 2026-10-21 09:00 📅 2026-10-30 #shop ^abc1\n';
		expect(sectionsOf(text, new Date(2026, 9, 21, 10, 0), false)[0]?.rows).toEqual([
			row(0, 'a'),
			row(1, 'buy milk', true),
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
			},
		]);
	});

	test('keeps a block in its own section, and shows it when the items around it are hidden', () => {
		const text = '## A\n- [x] old\n\nText under A\n\n## B\nPara\n\n- [ ] b\n';
		expect(sectionsOf(text, new Date(2026, 9, 21), false)).toEqual([
			{ heading: null, rows: [] },
			{ heading: { line: 0, text: 'A' }, rows: [untouched(3, 'Text under A')] },
			{ heading: { line: 5, text: 'B' }, rows: [untouched(6, 'Para'), row(8, 'b')] },
		]);
	});
});

describe('itemRow', () => {
	test('shows a starred title without its star', () => {
		expect(itemRow('- [ ] milk ⭐', 0, new Date())).toEqual(row(0, 'milk', false, 'milk', false, true));
	});

	test('reads the row an item line shows, as the view does after its own tick', () => {
		const now = new Date(2026, 9, 21, 10, 0);
		const ticked = tickLine('- [ ] a 📅 2026-10-30', now);
		expect(itemRow(ticked, 4, now)).toEqual(row(4, 'a', true));
	});

	test('marks a done item archived 24 hours after its tick', () => {
		const ticked = tickLine('- [ ] a', new Date(2026, 9, 21, 10, 0));
		expect(itemRow(ticked, 0, new Date(2026, 9, 22, 9, 59)).archived).toBe(false);
		expect(itemRow(ticked, 0, new Date(2026, 9, 22, 10, 0)).archived).toBe(true);
	});

	test.each([
		['only Tasks fields', '- [ ] 📅 2026-10-30', '📅 2026-10-30'],
		['only a tag and a block ID', '- [x] #shop ^abc1', '#shop ^abc1'],
		['nothing at all', '- [ ] ', ''],
	])('labels an item with an empty title by the rest of its line: %s', (_, text, label) => {
		const done = text.startsWith('- [x]');
		expect(itemRow(text, 0, new Date(2026, 9, 21))).toEqual(row(0, '', done, label, done));
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
