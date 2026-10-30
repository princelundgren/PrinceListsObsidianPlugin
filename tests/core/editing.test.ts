import { describe, expect, test } from 'vitest';
import { visibleSections, withoutRange } from '../../src/core/display';
import { ListEditing, type Typed } from '../../src/core/editing';
import { getItemNotes } from '../../src/core/edit-items';
import { NO_LINES_MOVED, ownEdit } from '../../src/core/follow';
import { planItemMove, type PlannedMove } from '../../src/core/list-actions';
import { toggleLine } from '../../src/core/item-line';
import { splitLines } from '../../src/core/lines';
import { contentStartOf, list, notesEditor } from './edit-helpers';

const FRONTMATTER = '---\nprincelists: true\n---\n';

function editing(text: string): ListEditing {
	const state = new ListEditing((t) => contentStartOf(splitLines(t)));
	state.text = text;
	return state;
}

const saved = (typed: Typed) => 'edit' in typed;
const crlfText = (text: string) => text.replace(/\n/g, '\r\n');
const lineAt = (state: ListEditing, line: number | null) => (line === null ? undefined : splitLines(state.text)[line]?.text);

// Each keystroke types the field's whole value so far, as the view passes the textarea's value.
function typeEach(type: (value: string) => Typed, values: readonly string[]): Typed[] {
	return values.map((value) => type(value));
}

test('selectedTitle leaves out the star', () => {
	const state = editing(`${FRONTMATTER}- [ ] milk ⭐\n`);
	state.open(3);
	expect(state.selectedTitle()).toBe('milk');
});

describe('the title field across a typing session', () => {
	const text = `${FRONTMATTER}- [ ] a\n- [ ] b #home\n- [ ] c\n`;

	test('typing replaces the title and keeps the tail once', () => {
		const state = editing(text);
		state.open(4);
		expect(state.selectedTitle()).toBe('b');
		state.focusTitle();
		const results = typeEach((v) => state.typeTitle(v), ['bu', 'buy', 'buy ', 'buy #', 'buy #milk', 'buy #milk2']);
		expect(results.every(saved)).toBe(true);
		expect(state.text).toBe(`${FRONTMATTER}- [ ] a\n- [ ] buy #milk2 #home\n- [ ] c\n`);
	});

	test("a drag's move of the item moves the selection, and typing lands on the moved line", () => {
		const state = editing(text);
		state.open(4);
		state.focusTitle();
		state.typeTitle('buy');
		const moved = planItemMove(state.text, 3, 4, { after: 5 }) as PlannedMove;
		state.applyOwn(moved.next, moved.edit);
		expect(state.selected).toBe(5);
		state.typeTitle('buy #milk');
		expect(state.text).toBe(`${FRONTMATTER}- [ ] a\n- [ ] c\n- [ ] buy #milk #home\n`);
	});

	test('an outside change above the item moves the selection, and typing lands in the same item', () => {
		const state = editing(text);
		state.open(4);
		state.focusTitle();
		state.typeTitle('buy #mi');
		// The phone added an item at the top; Obsidian's merge kept the typing.
		const merged = `${FRONTMATTER}- [ ] new\n- [ ] a\n- [ ] buy #mi #home\n- [ ] c\n`;
		expect(state.outsideChange(merged)).toEqual({ lostSelected: false });
		expect(state.selected).toBe(5);
		state.typeTitle('buy #milk2');
		expect(state.text).toBe(`${FRONTMATTER}- [ ] new\n- [ ] a\n- [ ] buy #milk2 #home\n- [ ] c\n`);
	});

	// A tap on the card's box can leave the title focused (on the iPhone it may not take focus).
	test('a tick on the selected item, by the view, with a tag typed, keeps the tag typed once', () => {
		const state = editing(text);
		state.open(4);
		state.focusTitle();
		typeEach((v) => state.typeTitle(v), ['buy', 'buy #', 'buy #milk']);
		const now = new Date(2026, 9, 21, 9, 0);
		const ticked = `${FRONTMATTER}- [ ] a\n${toggleLine('- [ ] buy #milk #home', now)}\n- [ ] c\n`;
		state.applyOwn(ticked, { ...NO_LINES_MOVED, start: 4, retitle: (line) => toggleLine(line, now) });
		state.typeTitle('buy #milk2');
		expect(lineAt(state, 4)).toBe('- [x] buy #milk2 ✔ 2026-10-21 09:00 #home');
	});

	test("an outside change to the item's own line loses it, and typing writes nothing", () => {
		const state = editing(text);
		state.open(4);
		state.focusTitle();
		state.typeTitle('buy');
		const merged = `${FRONTMATTER}- [ ] a\n- [x] buy #home ✔ 2026-10-21 09:00\n- [ ] c\n`;
		expect(state.outsideChange(merged)).toEqual({ lostSelected: true });
		expect(state.selected).toBeNull();
		expect(state.typeTitle('buy milk')).toEqual({ lost: true });
		expect(state.text).toBe(merged);
	});
});

describe("a visit to a card's notes across a typing session", () => {
	const text = `${FRONTMATTER}- [ ] a\n\tnote\n- [ ] b\n`;

	test('follows a tick and a new item above it, and a line added above it from outside', () => {
		const before = `${FRONTMATTER}- [ ] z\n${text.slice(FRONTMATTER.length)}`;
		const state = editing(before);
		state.open(4);
		const { type } = notesEditor(state, 'item');
		state.applyOwn(before.replace('[ ] z', '[x] z'), { start: 3, delta: 0, kind: 'change' });
		state.applyOwn(`${FRONTMATTER}- [ ] top\n${state.text.slice(FRONTMATTER.length)}`, { start: 3, delta: 1, kind: 'insert' });
		state.outsideChange(`${FRONTMATTER}- [ ] first\n${state.text.slice(FRONTMATTER.length)}`);
		expect(saved(type('note!') as Typed)).toBe(true);
		expect(state.text).toBe(`${FRONTMATTER}- [ ] first\n- [ ] top\n- [x] z\n- [ ] a\n\tnote!\n- [ ] b\n`);
	});

	test('notesPieceRange follows the lines typed, and is null once the visit ends', () => {
		const state = editing(text);
		state.open(3);
		notesEditor(state, 'item').type('one\ntwo\nthree');
		expect(state.notesPieceRange()).toEqual({ start: 4, end: 7 });
		state.closeNotes();
		expect(state.notesPieceRange()).toBeNull();
		expect(state.saveNotes({ from: 0, to: 1, lines: ['x'] })).toEqual({ lost: true });
	});

	test('is lost once its item is deleted', () => {
		const state = editing(text);
		state.open(3);
		const { type } = notesEditor(state, 'item');
		state.applyOwn(`${FRONTMATTER}- [ ] b\n`, { start: 3, delta: -2, kind: 'delete' });
		expect(type('mine')).toEqual({ lost: true });
	});
});

describe('a visit to the list note across a typing session', () => {
	test('typing a note where there was none puts it before the items, and moves the selection', () => {
		const state = editing(`${FRONTMATTER}- [ ] a\n- [ ] b\n`);
		state.open(4);
		const { type } = notesEditor(state, 'listNote');
		expect(type('N')).toEqual({ edit: { start: 3, delta: 2, kind: 'insert' }, note: 'N' });
		type('Note\nmore');
		expect(state.text).toBe(`${FRONTMATTER}Note\nmore\n\n- [ ] a\n- [ ] b\n`);
		expect(state.selected).toBe(7);
	});

	// The note's first save wrote a blank line before the items too. While it is still blank and right
	// under the note, the visit replaces it with the note, so emptying the note takes it away again.
	test.each([
		[`${FRONTMATTER}- [ ] a\n- [ ] b\n`],
		[`${FRONTMATTER}## H\n- [ ] a\n`],
		[crlfText(`${FRONTMATTER}- [ ] a\n`)],
	])('a note typed where there was none and erased again leaves %j as it was', (text) => {
		const state = editing(text);
		const start = contentStartOf(splitLines(text));
		state.open(start);
		const { type } = notesEditor(state, 'listNote');
		for (const value of ['N', 'No', 'N', '']) type(value);
		expect(state.text).toBe(text);
		expect(state.selected).toBe(start);
	});

	// Until the editor loses focus, those lines are still the note being typed: a row drawn for a typed
	// `- [ ] y` and acted on would write it twice.
	test('rows for lines inside the note being typed are left out of a redraw', () => {
		const state = editing(`${FRONTMATTER}Old\n\n- [ ] a\n## H\n- [ ] b\n`);
		notesEditor(state, 'listNote').type('Old\n# Typed\n- [ ] y\nmore');
		const { lines, model } = list(state.text);
		const drawn = (range: { start: number; end: number } | null) =>
			withoutRange(visibleSections(lines, model, new Date(2026, 9, 21), { showArchived: false, query: '', keepLine: null, collapsed: new Set() }), range).flatMap((section) => [
				section.heading?.text ?? null,
				...section.rows.map((row) => (row.kind === 'item' ? row.title : row.text)),
			]);
		expect(drawn(null)).toEqual([null, 'Typed', 'y', 'a', 'H', 'b']);
		expect(drawn(state.listNoteRange())).toEqual([null, null, 'a', 'H', 'b']);
		state.closeListNote();
		expect(state.listNoteRange()).toBeNull();
	});

	// The blank line its save wrote is the visit's only while it is still blank and still right under
	// the note, so a line added between the two is kept.
	test.each([
		['an item', '- [ ] milk'],
		['a heading', '## Milk'],
	])('%s another device adds right under the note survives the next keystroke', (_, added) => {
		const state = editing(`${FRONTMATTER}- [ ] a\n`);
		const { type } = notesEditor(state, 'listNote');
		type('N');
		expect(state.text).toBe(`${FRONTMATTER}N\n\n- [ ] a\n`);
		state.outsideChange(`${FRONTMATTER}N\n${added}\n\n- [ ] a\n`);
		type('No');
		expect(state.text).toBe(`${FRONTMATTER}No\n\n${added}\n\n- [ ] a\n`);
		type('');
		expect(state.text).toBe(`${FRONTMATTER}${added}\n\n- [ ] a\n`);
	});

	test('a blank line the list already had stays when the note is erased', () => {
		const state = editing(`${FRONTMATTER}Old\n\n- [ ] a\n`);
		const { type } = notesEditor(state, 'listNote');
		for (const value of ['Ol', 'O', '']) type(value);
		expect(state.text).toBe(`${FRONTMATTER}\n- [ ] a\n`);
	});

	test('an item added at the top elsewhere stays after the note being typed', () => {
		const state = editing(`${FRONTMATTER}- [ ] a\n`);
		const { type } = notesEditor(state, 'listNote');
		state.outsideChange(`${FRONTMATTER}- [ ] new\n- [ ] a\n`);
		type('Note');
		expect(state.text).toBe(`${FRONTMATTER}Note\n\n- [ ] new\n- [ ] a\n`);
	});

	test('a heading typed into the note, then taken out again, leaves the items as they were', () => {
		const text = `${FRONTMATTER}Old\n\n- [ ] a\n`;
		const state = editing(text);
		const { type } = notesEditor(state, 'listNote');
		for (const value of ['Old\n#', 'Old\n# ', 'Old\n# H', 'Old\n# ', 'Old\n#', 'Old\n', 'Old']) type(value);
		expect(state.text).toBe(text);
	});

	test('an unclosed fence saves, and closing it brings back what follows as it was', () => {
		const state = editing(`${FRONTMATTER}Old\n\n- [ ] a\n## H\n- [ ] b\n`);
		const { type } = notesEditor(state, 'listNote');
		const typed = ['Old\n```', 'Old\n```\ncode', 'Old\n```\ncode\n```'].map((value) => type(value));
		expect(typed.every((t) => saved(t as Typed))).toBe(true);
		expect(state.text).toBe(`${FRONTMATTER}Old\n\`\`\`\ncode\n\`\`\`\n\n- [ ] a\n## H\n- [ ] b\n`);
	});

	test('an outside change above the lines it holds moves them, and typing lands in the same lines', () => {
		const state = editing(`${FRONTMATTER}\nSecond\n\n- [ ] a\n`);
		const { type } = notesEditor(state, 'listNote');
		state.outsideChange(`${FRONTMATTER}Zero\n\nSecond\n\n- [ ] a\n`);
		type('Second!');
		expect(state.text).toBe(`${FRONTMATTER}Zero\n\nSecond!\n\n- [ ] a\n`);
	});

	test("a card's visit and the list note's are one session: opening one ends the other", () => {
		const state = editing(`${FRONTMATTER}Note\n\n- [ ] a\n\tfirst\n`);
		state.open(5);
		state.openNotes('item');
		state.openNotes('listNote');
		expect(state.notesPieceRange()).toBeNull();
		expect(state.saveNotes({ from: 0, to: 1, lines: ['x'] })).toEqual({ lost: true });
		state.closeNotes();
		expect(state.listNoteRange()).toEqual({ start: 3, end: 4 });
	});
});

describe("selected follows the view's own writes", () => {
	const text = `${FRONTMATTER}- [ ] a\n- [ ] \n- [ ] c\n`;

	test('a removal before it shifts it, and one of it closes the card', () => {
		const state = editing(text);
		state.open(5);
		state.applyOwn(`${FRONTMATTER}- [ ] a\n- [ ] c\n`, ownEdit(4, text, `${FRONTMATTER}- [ ] a\n- [ ] c\n`, 'delete'));
		expect(state.selected).toBe(4);
		state.applyOwn(`${FRONTMATTER}- [ ] a\n`, ownEdit(4, `${FRONTMATTER}- [ ] a\n- [ ] c\n`, `${FRONTMATTER}- [ ] a\n`, 'delete'));
		expect(state.selected).toBeNull();
	});

	test('tracked lines, such as an empty item waiting for removal, follow both kinds of change', () => {
		const state = editing(text);
		const pending = state.track(4);
		state.applyOwn(`${FRONTMATTER}Note\n\n- [ ] a\n- [ ] \n- [ ] c\n`, { start: 3, delta: 2, kind: 'insert' });
		expect(pending.line).toBe(6);
		state.outsideChange(`${FRONTMATTER}Note\n\n- [ ] top\n- [ ] a\n- [ ] \n- [ ] c\n`);
		expect(pending.line).toBe(7);
		state.untrack(pending);
		state.outsideChange(text);
		expect(pending.line).toBe(7);
	});

	test('a reset, for another file, lets nothing tracked act on it', () => {
		const state = editing(text);
		const pending = state.track(4);
		state.open(5);
		state.reset();
		expect(pending.line).toBeNull();
		expect(state.selected).toBeNull();
	});

	test("two empty items can't be told apart by an outside change, so selected follows own writes only", () => {
		const two = `${FRONTMATTER}- [ ] \n- [ ] \n`;
		const state = editing(two);
		state.open(4);
		const removed = `${FRONTMATTER}- [ ] \n`;
		state.applyOwn(removed, ownEdit(3, two, removed, 'delete'));
		expect(state.selected).toBe(3);
	});
});

describe('a visit to the notes', () => {
	test("opens a card's notes and the list note exactly as parsed, without the empty lines around them", () => {
		const text = `${FRONTMATTER}\n\nNote\n\n\n- [ ] a\n\n\n\tA\n\n\tB\n\n\n- [ ] b\n`;
		const state = editing(text);
		expect(state.openNotes('listNote')).toBe('Note');
		state.open(8);
		const { lines, item } = list(text);
		expect(state.openNotes('item')).toBe(getItemNotes(lines, item(0)));
		expect(state.notesPieceRange()).toEqual({ start: 11, end: 14 });
	});

	test('opens no visit when the card has no item', () => {
		const state = editing(`${FRONTMATTER}- [ ] a\n`);
		expect(state.openNotes('item')).toBeNull();
		expect(state.visitText()).toBeNull();
	});

	test('notesChangeFits says whether the layout can take a change, and changes nothing', () => {
		const text = `${FRONTMATTER}Old\n  - [ ] a\n`;
		const state = editing(text);
		state.openNotes('listNote');
		expect(state.notesChangeFits({ from: 0, to: 1, lines: ['- a'] })).toBe(false);
		expect(state.text).toBe(text);
		expect(state.notesChangeFits({ from: 0, to: 1, lines: ['ab'] })).toBe(true);
		expect(state.text).toBe(text);
		expect(state.saveListNote({ from: 0, to: 1, lines: ['- a'] })).toEqual({ refused: true, firstRefusal: true });
		expect(state.saveListNote({ from: 0, to: 1, lines: ['- a'] })).toEqual({ refused: true, firstRefusal: false });
		expect(state.text).toBe(text);
	});

	test("a line tracked at an empty list note's start follows the note's first text", () => {
		const state = editing(`${FRONTMATTER}- [ ] a\n`);
		const first = state.track(3);
		state.openNotes('listNote');
		expect(state.saveListNote({ from: 0, to: 1, lines: ['N'] })).toEqual({ edit: { start: 3, delta: 2, kind: 'insert' }, note: 'N' });
		expect(first.line).toBe(5);
	});

	test("a card's save is a change at its item's title line", () => {
		const state = editing(`${FRONTMATTER}- [ ] a\n\tx\n`);
		state.open(3);
		state.openNotes('item');
		expect(state.saveNotes({ from: 0, to: 1, lines: ['x', 'y'] })).toEqual({ edit: { start: 3, delta: 1, kind: 'change' } });
	});

	test("a visit's saves are one step of the list's undo", () => {
		const text = `${FRONTMATTER}- [ ] a\n\tx\n- [ ] b\n`;
		const state = editing(text);
		state.open(3);
		state.openNotes('item');
		state.saveNotes({ from: 0, to: 1, lines: ['xy'] });
		state.saveNotes({ from: 1, to: 1, lines: ['z'] });
		state.saveNotes({ from: 0, to: 1, lines: ['x'] });
		state.closeNotes();
		const undo = state.history.undo(state.text);
		expect(undo?.next).toBe(text);
		state.applyOwn(text, (undo as NonNullable<typeof undo>).edit);
		expect(state.history.undo(state.text)).toBeNull();
	});

	test('follows an outside change above the notes, and is lost to one of its own lines', () => {
		const text = `${FRONTMATTER}- [ ] a\n\tx\n- [ ] b\n`;
		const state = editing(text);
		state.open(3);
		state.openNotes('item');
		state.saveNotes({ from: 1, to: 1, lines: [''] });
		state.outsideChange(`${FRONTMATTER}- [ ] top\n${state.text.slice(FRONTMATTER.length)}`);
		expect(state.visitText()).toBe('x\n');
		expect(saved(state.saveNotes({ from: 1, to: 2, lines: ['y'] }))).toBe(true);
		expect(state.text).toBe(`${FRONTMATTER}- [ ] top\n- [ ] a\n\tx\n\ty\n- [ ] b\n`);
		state.outsideChange(state.text.replace('\tx', '\tx from the phone'));
		expect(state.saveNotes({ from: 0, to: 1, lines: ['mine'] })).toEqual({ lost: true });
		expect(state.visitText()).toBeNull();
	});

	test("the list note's visit is lost to an outside change to one of its own lines, and its range with it", () => {
		const text = `${FRONTMATTER}Old\n\n- [ ] a\n`;
		const state = editing(text);
		state.openNotes('listNote');
		expect(state.listNoteRange()).toEqual({ start: 3, end: 4 });
		const phone = text.replace('Old', 'Old from the phone');
		state.outsideChange(phone);
		expect(state.listNoteRange()).toBeNull();
		expect(state.saveListNote({ from: 0, to: 1, lines: ['mine'] })).toEqual({ lost: true });
		expect(state.text).toBe(phone);
	});

	test('a new visit says so again at its first refusal', () => {
		const text = `${FRONTMATTER}Old\n  - [ ] a\n`;
		const state = editing(text);
		state.openNotes('listNote');
		expect(state.saveListNote({ from: 0, to: 1, lines: ['- a'] })).toEqual({ refused: true, firstRefusal: true });
		state.closeListNote();
		state.openNotes('listNote');
		expect(state.saveListNote({ from: 0, to: 1, lines: ['- a'] })).toEqual({ refused: true, firstRefusal: true });
		expect(state.text).toBe(text);
	});

	test('a change outside the lines the visit holds throws, as the editor and the file are out of step', () => {
		const state = editing(`${FRONTMATTER}- [ ] a\n\tx\n- [ ] b\n`);
		state.open(3);
		state.openNotes('item');
		const stale = { from: 1, to: 2, lines: ['y'] };
		expect(() => state.notesChangeFits(stale)).toThrow('Lines 1 to 2 are not in the 1 lines of these notes');
		expect(() => state.saveNotes(stale)).toThrow('Lines 1 to 2 are not in the 1 lines of these notes');
	});
});
