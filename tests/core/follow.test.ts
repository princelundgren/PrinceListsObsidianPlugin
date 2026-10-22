import { describe, expect, test } from 'vitest';
import { NO_LINES_MOVED, followLine, followRange, mapRange, ownEdit, type OwnEdit } from '../../src/core/follow';
import { deleteItem, insertItem, setItemNotes, toggleItem } from '../../src/core/edit-items';
import { setListNote } from '../../src/core/edit-list-note';
import { joinLines, splitLines } from '../../src/core/lines';
import { list } from './edit-helpers';

const FRONTMATTER = '---\nprincelists: true\n---\n';

// The same line found in the edited text, or null, from a fresh parse: what following must agree with.
const titleLines = (text: string) => list(text).items.map((item) => item.titleLine);

describe('followLine', () => {
	const change: OwnEdit = { start: 5, delta: 2, kind: 'change' };
	test('a line before the run stays, the run start stays for a change, and a line after shifts', () => {
		expect(followLine(4, change)).toBe(4);
		expect(followLine(5, change)).toBe(5);
		expect(followLine(6, change)).toBe(8);
	});
	test('an insert shifts a line at its start too, because the new lines go in before it', () => {
		expect(followLine(5, { start: 5, delta: 1, kind: 'insert' })).toBe(6);
		expect(followLine(4, { start: 5, delta: 1, kind: 'insert' })).toBe(4);
	});
	test('a delete drops the line it starts at', () => {
		expect(followLine(5, { start: 5, delta: -3, kind: 'delete' })).toBeNull();
		expect(followLine(9, { start: 5, delta: -3, kind: 'delete' })).toBe(6);
	});
});

describe('ownEdit', () => {
	test('measures the change in length from the lines before and after', () => {
		expect(ownEdit(3, 'a\nb\n', 'a\nb\nc\nd\n', 'change')).toEqual({ start: 3, delta: 2, kind: 'change' });
		expect(ownEdit(0, 'a\nb\n', 'a\n', 'delete')).toEqual({ start: 0, delta: -1, kind: 'delete' });
	});
});

// Each case edits through the core, follows every item's title line with the edit's run, and checks
// the result against a fresh parse of the edited text.
describe('followLine agrees with a fresh parse after each own edit', () => {
	const text = `${FRONTMATTER}Note\n\n- [ ] a\n- [ ] b\n\n\tb's note\n- [ ] c\n## H\n- [ ] d\n`;

	test('typing notes into b shifts c and d, and keeps a and b', () => {
		const { lines, model, item } = list(text);
		const b = item(1);
		const edited = joinLines(setItemNotes(lines, model, b, 'one\ntwo\nthree', b.notesIndent));
		const edit = ownEdit(b.titleLine, text, edited, 'change');
		expect(titleLines(text).map((line) => followLine(line, edit))).toEqual(titleLines(edited));
	});

	test("removing all of b's notes shifts the lines after it up", () => {
		const { lines, model, item } = list(text);
		const edited = joinLines(setItemNotes(lines, model, item(1), ''));
		const edit = ownEdit(item(1).titleLine, text, edited, 'change');
		expect(titleLines(text).map((line) => followLine(line, edit))).toEqual(titleLines(edited));
	});

	test('ticking moves nothing', () => {
		const { lines, item } = list(text);
		const edited = joinLines(toggleItem(lines, item(2), new Date(2026, 9, 21, 9, 0)));
		const edit = ownEdit(item(2).titleLine, text, edited, 'change');
		expect(titleLines(text).map((line) => followLine(line, edit))).toEqual(titleLines(edited));
	});

	test('an insert before the first item shifts the first item too', () => {
		const { lines, model } = list(text);
		const inserted = insertItem(lines, model, null, '');
		const edited = joinLines(inserted.lines);
		const edit = ownEdit(inserted.titleLine, text, edited, 'insert');
		const followed = titleLines(text).map((line) => followLine(line, edit));
		expect([inserted.titleLine, ...followed]).toEqual(titleLines(edited));
	});

	test('deleting c drops it and shifts d', () => {
		const { lines, model, item } = list(text);
		const edited = joinLines(deleteItem(lines, model, item(2)));
		const edit = ownEdit(item(2).titleLine, text, edited, 'delete');
		const followed = titleLines(text).map((line) => followLine(line, edit));
		expect(followed[2]).toBeNull();
		expect(followed.filter((line) => line !== null)).toEqual(titleLines(edited));
	});

	test('a list note written where there was none shifts the first item, which sat at its start', () => {
		const bare = `${FRONTMATTER}- [ ] a\n- [ ] b\n`;
		const { lines, model } = list(bare);
		const edited = joinLines(setListNote(lines, model, model.listNote, 'A note\nover two lines').lines);
		const edit = ownEdit(model.listNote.start, bare, edited, 'insert');
		expect(titleLines(bare).map((line) => followLine(line, edit))).toEqual(titleLines(edited));
	});

	test('a list note that grows shifts every item', () => {
		const { lines, model } = list(text);
		const edited = joinLines(setListNote(lines, model, model.listNote, 'A\n\nlonger\n\nnote').lines);
		const edit = ownEdit(model.listNote.start, text, edited, 'change');
		expect(titleLines(text).map((line) => followLine(line, edit))).toEqual(titleLines(edited));
	});
});

describe('followRange', () => {
	const range = { start: 3, end: 5 };
	test('an edit whose run starts at or after the range leaves it', () => {
		expect(followRange(range, { start: 5, delta: -2, kind: 'delete' })).toEqual(range);
		expect(followRange(range, { start: 9, delta: 4, kind: 'change' })).toEqual(range);
	});
	test('an empty range stays where an item is inserted or removed at it', () => {
		const empty = { start: 3, end: 3 };
		expect(followRange(empty, { start: 3, delta: 1, kind: 'insert' })).toEqual(empty);
		expect(followRange(empty, { start: 3, delta: -1, kind: 'delete' })).toEqual(empty);
	});
	test("an edit that starts inside the range can't be followed", () => {
		expect(followRange(range, { start: 4, delta: 1, kind: 'change' })).toBeNull();
		expect(followRange(range, { start: 3, delta: 0, kind: 'change' })).toBeNull();
	});
});

describe('mapRange', () => {
	const before = splitLines(`${FRONTMATTER}Note\nmore\n\n- [ ] a\n- [ ] b\n`);

	test('a change after the note leaves its range', () => {
		const after = splitLines(`${FRONTMATTER}Note\nmore\n\n- [ ] a\n- [x] b\n`);
		expect(mapRange(before, after, { start: 3, end: 5 })).toEqual({ start: 3, end: 5 });
	});

	test('a change inside the note that leaves both ends in place maps the range around it', () => {
		const midNote = splitLines(`${FRONTMATTER}Note\nx\ny\nmore\n\n- [ ] a\n`);
		const longer = splitLines(`${FRONTMATTER}Note\nmore\n\n- [ ] a\n`);
		expect(mapRange(longer, midNote, { start: 3, end: 5 })).toEqual({ start: 3, end: 7 });
	});

	test("a change to either end can't be mapped", () => {
		expect(mapRange(before, splitLines(`${FRONTMATTER}Changed\nmore\n\n- [ ] a\n- [ ] b\n`), { start: 3, end: 5 })).toBeNull();
		expect(mapRange(before, splitLines(`${FRONTMATTER}Note\nchanged\n\n- [ ] a\n- [ ] b\n`), { start: 3, end: 5 })).toBeNull();
	});

	// An empty range is a position, not a line: the line at its start is the first item's, and an item
	// added above that one must land after the note, not before it.
	test('an empty range stays right after the line before it', () => {
		const bare = splitLines(`${FRONTMATTER}- [ ] a\n`);
		const empty = { start: 3, end: 3 };
		expect(mapRange(bare, splitLines(`${FRONTMATTER}- [ ] a\n- [ ] b\n`), empty)).toEqual(empty);
		expect(mapRange(bare, splitLines(`${FRONTMATTER}- [ ] new\n- [ ] a\n`), empty)).toEqual(empty);
		expect(mapRange(bare, splitLines(`${FRONTMATTER}- [x] a\n`), empty)).toEqual(empty);
		expect(mapRange(splitLines(FRONTMATTER), splitLines(`${FRONTMATTER}- [ ] a\n`), empty)).toEqual(empty);
		expect(mapRange(splitLines('- [ ] a\n'), splitLines('Text\n- [ ] a\n'), { start: 0, end: 0 })).toEqual({ start: 0, end: 0 });
	});

	test("an empty range whose line before it changed can't be mapped", () => {
		const bare = splitLines(`${FRONTMATTER}- [ ] a\n`);
		// The frontmatter grew, so the line before the note moved with it.
		expect(mapRange(bare, splitLines(`---\nprincelists: true\ntags: x\n---\n- [ ] a\n`), { start: 3, end: 3 })).toEqual({ start: 4, end: 4 });
		// One change spans the frontmatter's closing line and a new note, so where the note starts is unknown.
		const both = splitLines(`---\nprincelists: true\ntags: x\n---\nNote\n\n- [ ] a\n`);
		expect(mapRange(bare, both, { start: 3, end: 3 })).toBeNull();
	});
});

test('NO_LINES_MOVED leaves every line and the list note range', () => {
	expect([0, 7].map((line) => followLine(line, NO_LINES_MOVED))).toEqual([0, 7]);
	expect(followRange({ start: 3, end: 5 }, NO_LINES_MOVED)).toEqual({ start: 3, end: 5 });
});
