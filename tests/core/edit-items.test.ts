import { describe, expect, test } from 'vitest';
import {
	RepeatingItemError,
	UnsafeEditError,
	deleteItem,
	getItemNotes,
	insertItem,
	insertItemInSection,
	setItemTitle,
	toggleItem,
} from '../../src/core/edit-items';
import { parseItemLine } from '../../src/core/item-line';
import { joinLines, type Line } from '../../src/core/lines';
import {
	FIXTURES,
	JOINING_CASES,
	REFUSED_CASES,
	crlf,
	expectRestKept,
	itemBlock,
	list,
	readFixture,
} from './edit-helpers';

const now = new Date(2026, 9, 20, 23, 55);

describe('toggleItem', () => {
	test('ticks with a stamp and keeps the CRLF endings', () => {
		const { lines, item } = list('- [ ] a\r\n- [ ] b\r\n');
		expect(joinLines(toggleItem(lines, item(0), now))).toBe('- [x] a ✔ 2026-10-20 23:55\r\n- [ ] b\r\n');
	});
	test('unticks a done item, whatever its status character', () => {
		const { lines, item } = list('- [x] a ✔ 2026-10-20 23:55\n');
		expect(joinLines(toggleItem(lines, item(0), now))).toBe('- [ ] a\n');
		const markers = list(readFixture('markers.md'));
		for (const [n, expected] of [
			[3, '- [ ] d'],
			[4, '- [ ] e'],
			[5, '- [ ] f'],
		] as const) {
			expect(toggleItem(markers.lines, markers.item(n), now)[n]?.text).toBe(expected);
		}
	});
	test('refuses to tick a repeating item, but unticks one', () => {
		const open = list('- [ ] a 🔁 every week\n');
		expect(() => toggleItem(open.lines, open.item(0), now)).toThrow(RepeatingItemError);
		const done = list('- [x] a ✔ 2026-10-20 23:55 🔁 every week\n');
		expect(joinLines(toggleItem(done.lines, done.item(0), now))).toBe('- [ ] a 🔁 every week\n');
	});
});

describe('insertItem and insertItemInSection', () => {
	test('inserts after an item and keeps the missing final newline', () => {
		const { lines, model, item } = list('- [ ] a');
		const result = insertItem(lines, model, item(0), 'new');
		expect(joinLines(result.lines)).toBe('- [ ] a\n- [ ] new');
		expect(result.titleLine).toBe(1);
	});
	test('with after null, inserts at the first item or heading after the list note, or at the end', () => {
		const withHeading = list('---\nprincelists: true\n---\nNote\n\n## H\n- [ ] a\n');
		const first = insertItem(withHeading.lines, withHeading.model, null, 'new');
		expect(joinLines(first.lines)).toBe('---\nprincelists: true\n---\nNote\n\n- [ ] new\n## H\n- [ ] a\n');
		expect(first.titleLine).toBe(5);
		const empty = list('---\nprincelists: true\n---\n');
		expect(joinLines(insertItem(empty.lines, empty.model, null, 'new').lines)).toBe(
			'---\nprincelists: true\n---\n- [ ] new\n',
		);
	});
	test('inserts as the first item under a heading', () => {
		const { lines, model, section } = list('- [ ] a\n## H\n- [ ] b\n');
		const result = insertItemInSection(lines, model, section(1), 'new');
		expect(joinLines(result.lines)).toBe('- [ ] a\n## H\n- [ ] new\n- [ ] b\n');
		expect(result.titleLine).toBe(2);
	});
	test('in a section without items, inserts after its content and a setext heading', () => {
		for (const [text, expected] of [
			['## H\nText\n\n## K\n', '## H\nText\n- [ ] new\n\n## K\n'],
			['Kitchen\n---\n', 'Kitchen\n---\n- [ ] new\n'],
		] as const) {
			const { lines, model, section } = list(text);
			expect(joinLines(insertItemInSection(lines, model, section(1), 'new').lines)).toBe(expected);
		}
	});
	test('in the top section, inserts where insertItem puts an item with after null', () => {
		const { lines, model, section } = list('Note\n\n## H\n');
		expect(joinLines(insertItemInSection(lines, model, section(0), 'new').lines)).toBe('Note\n\n- [ ] new\n## H\n');
	});
	test('writes an empty line after the new item where the text below would join it', () => {
		const top = list(JOINING_CASES.setextHeadingTop);
		const expected = 'Note\n\n- [ ] new\n\nKitchen\n---\n- [ ] a\n';
		expect(joinLines(insertItem(top.lines, top.model, null, 'new').lines)).toBe(expected);
		expect(joinLines(insertItemInSection(top.lines, top.model, top.section(0), 'new').lines)).toBe(expected);
		const fence = list(JOINING_CASES.fenceThenText);
		const result = insertItem(fence.lines, fence.model, fence.item(1), 'new');
		expect(joinLines(result.lines)).toBe('## G\n- [ ] z\n- [ ] a\n\n\t```\n\tx\n\t```\n- [ ] new\n\nText\n## K\n- [ ] c\n');
		expect(result.titleLine).toBe(7);
		const crlfTop = list(crlf(JOINING_CASES.setextHeadingTop));
		expect(joinLines(insertItem(crlfTop.lines, crlfTop.model, null, 'new').lines)).toBe(crlf(expected));
	});
	test('leaves every other item, heading and untouched block as it parsed', () => {
		const cases = [...Object.values(JOINING_CASES), ...FIXTURES.map(readFixture)];
		for (const text of cases) {
			const { lines, model, items } = list(text);
			const results = [
				insertItem(lines, model, null, 'new'),
				...model.sections.map((s) => insertItemInSection(lines, model, s, 'new')),
				...items.map((it) => insertItem(lines, model, it, 'new')),
			];
			for (const result of results) {
				const after = joinLines(result.lines);
				expectRestKept(text, after, { added: ['item:- [ ] new'] });
				expect(list(after).items.some((it) => it.titleLine === result.titleLine && it.endLine === result.titleLine + 1)).toBe(true);
			}
		}
	});
	test('keeps an NFD title as it is, and writes the new line with the file ending', () => {
		const title = 'Crème brûlée'.normalize('NFD');
		const { lines, model, item } = list('- [ ] a\n');
		expect(insertItem(lines, model, item(0), title).lines[1]?.text).toBe(`- [ ] ${title}`);
		const crlf = list('- [ ] a\r\n- [ ] b\r\n');
		expect(joinLines(insertItem(crlf.lines, crlf.model, crlf.item(0), 'new').lines)).toBe('- [ ] a\r\n- [ ] new\r\n- [ ] b\r\n');
	});
	test('refuses an insert that an empty line after the new item can\'t keep from changing the rest', () => {
		// The text would become the new item's notes; the <div> would take in the new item.
		const wider = list(REFUSED_CASES.widerColumnMove);
		expect(() => insertItem(wider.lines, wider.model, wider.item(1), 'new')).toThrow(UnsafeEditError);
		const div = list(REFUSED_CASES.divInEmptySection);
		expect(() => insertItemInSection(div.lines, div.model, div.section(1), 'new')).toThrow(UnsafeEditError);
		expect(joinLines(div.lines)).toBe(REFUSED_CASES.divInEmptySection);
	});
	test('refuses a title with a line break', () => {
		const { lines, model, item, section } = list('- [ ] a\n');
		for (const title of ['a\nb', 'a\rb']) {
			expect(() => insertItem(lines, model, null, title)).toThrow();
			expect(() => insertItemInSection(lines, model, section(0), title)).toThrow();
			expect(() => setItemTitle(lines, item(0), title)).toThrow();
		}
	});
});

describe('deleteItem', () => {
	test.each([
		['- [ ] a\n\n\tn\n- [ ] b\n', 0, '- [ ] b\n'],
		['- [ ] a\n- [ ] b', 1, '- [ ] a'],
		['- [ ] a\n\n- [ ] b\n\n- [ ] c\n', 1, '- [ ] a\n\n- [ ] c\n'],
		// Beyond the table: with a gap on one side only, the gap stays.
		['## H\n- [ ] a\n\n- [ ] b\n', 0, '## H\n\n- [ ] b\n'],
		// Untouched text would join the item above, so an empty line takes the deleted item's place.
		[JOINING_CASES.fenceThenText, 1, '## G\n- [ ] z\n\nText\n## K\n- [ ] c\n'],
		// The same for text that would join the list note or an untouched paragraph, and for a setext
		// heading's text, which would turn the paragraph above into the heading.
		['Note\n- [ ] a\n\n\t```\n\tx\n\t```\nText\n\n- [ ] b\n', 0, 'Note\n\nText\n\n- [ ] b\n'],
		['- [ ] z\n\nU1\n- [ ] a\n\n\t```\n\tx\n\t```\nU2\n', 1, '- [ ] z\n\nU1\n\nU2\n'],
		['Note\n- [ ] a\n\n\t```\n\tx\n\t```\nKitchen\n---\n- [ ] b\n', 0, 'Note\n\nKitchen\n---\n- [ ] b\n'],
		[JOINING_CASES.hrUnderListNote, 0, '---\nprincelists: true\n---\nShopping for the weekend\n\n---\n- [ ] bread\n'],
		[JOINING_CASES.hrUnderNote, 0, 'Note\n\n---\n- [ ] b\n'],
		[JOINING_CASES.hrUnderUntouched, 1, '## G\n- [ ] z\n\nU\n\n---\n- [ ] b\n'],
		[JOINING_CASES.equalsUnderNote, 0, 'Note\n\n===\n'],
		[crlf(JOINING_CASES.hrUnderNote), 0, crlf('Note\n\n---\n- [ ] b\n')],
		// A definition belongs to no block: b would turn from an item into a paragraph with the same
		// text, and "title" would vanish into the definition as its title.
		['[r]: /u\n- [ ] a\n\n\t```\n\tx\n\t```\n2. [ ] b\n', 0, '[r]: /u\n\n2. [ ] b\n'],
		['[r]: /u\n- [ ] a\n\n\t```\n\tx\n\t```\n"title"\n', 0, '[r]: /u\n\n"title"\n'],
		// Nothing joins here, so no empty line is added: text that becomes part of the list note, and a
		// fence, which no paragraph takes in.
		['Note\n\n- [ ] a\n\nText\n\n- [ ] b\n', 0, 'Note\n\nText\n\n- [ ] b\n'],
		[JOINING_CASES.fenceUnderNote, 0, 'Note\n```\ncode\n```\n- [ ] b\n'],
	])('%j without item %i', (text, n, expected) => {
		const { lines, model, item } = list(text);
		expect(joinLines(deleteItem(lines, model, item(n)))).toBe(expected);
	});
	test('leaves every other item, heading and untouched block as it parsed', () => {
		for (const text of [...Object.values(JOINING_CASES), ...FIXTURES.map(readFixture)]) {
			const { lines, model, items } = list(text);
			for (const it of items) {
				expectRestKept(text, joinLines(deleteItem(lines, model, it)), { removed: [itemBlock(lines, it)] });
			}
		}
	});
	test('refuses a delete that leaves text the item above takes in, even after an empty line', () => {
		const { lines, model, item } = list(REFUSED_CASES.widerColumnDelete);
		expect(() => deleteItem(lines, model, item(1))).toThrow(UnsafeEditError);
	});
});

describe('getItemNotes', () => {
	test('strips the notes indent by columns, a tab and 4 spaces alike', () => {
		const { lines, item } = list('- [ ] a\n\n\tone\n    two\n\t\tcode\n');
		expect(getItemNotes(lines, item(0))).toBe('one\ntwo\n\tcode');
	});
	test('a tab that crosses the notes indent leaves its remaining columns as spaces', () => {
		const { lines, item } = list('- [ ] a\n\n  one\n \tcode\n');
		expect(item(0).notesIndent).toBe('  ');
		expect(getItemNotes(lines, item(0))).toBe('one\n  code');
	});
});

describe('setItemTitle', () => {
	test('setting the current title leaves every fixture byte-identical', () => {
		for (const name of FIXTURES) {
			const text = readFixture(name);
			const { lines, items } = list(text);
			for (const item of items) {
				const title = parseItemLine((lines[item.titleLine] as Line).text)?.title ?? '';
				expect(joinLines(setItemTitle(lines, item, title)), `${name}:${item.titleLine}`).toBe(text);
			}
		}
	});
	test('replaces the title and keeps the ending', () => {
		const { lines, item } = list('- [ ] a 📅 2026-10-30\r\n');
		expect(joinLines(setItemTitle(lines, item(0), 'b'))).toBe('- [ ] b 📅 2026-10-30\r\n');
	});
});
