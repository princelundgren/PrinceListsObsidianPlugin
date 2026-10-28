import { describe, expect, test } from 'vitest';
import { visibleSections, withoutRange } from '../../src/core/display';
import { ListEditing, type Typed } from '../../src/core/editing';
import { NO_LINES_MOVED, ownEdit } from '../../src/core/follow';
import { planItemMove, type PlannedMove } from '../../src/core/list-actions';
import { toggleLine } from '../../src/core/item-line';
import { splitLines } from '../../src/core/lines';
import { contentStartOf, list } from './edit-helpers';

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

describe('a piece of the notes across a typing session', () => {
	const text = `${FRONTMATTER}- [ ] a\n\n\t- [ ] box\n\n\tpiece\n- [ ] b\n`;

	test('opens a piece without its indent, and a new item after it with the same indent', () => {
		const state = editing(`${FRONTMATTER}- [ ] a\n\n\tpara\n\n\t- x\n\t  - y\n- [ ] b\n`);
		state.open(3);
		expect(state.openNotesPiece({ start: 8, end: 9 }, false)).toBe('- y');
		expect(saved(state.typeNotesPiece('- y!'))).toBe(true);
		state.openNotesPiece({ start: 9, end: 9 }, false);
		state.typeNotesPiece('- z');
		expect(state.text).toBe(`${FRONTMATTER}- [ ] a\n\n\tpara\n\n\t- x\n\t  - y!\n\t  - z\n- [ ] b\n`);
	});

	test('opens a new item one level out, after the parent marker the open piece gives', () => {
		const state = editing(`${FRONTMATTER}- [ ] a\n\n\t- x\n\t  - y\n- [ ] b\n`);
		state.open(3);
		state.openNotesPiece({ start: 6, end: 7 }, false);
		state.openNotesPiece({ start: 7, end: 7 }, false);
		const marker = state.notesPieceOutdent('- ');
		expect(marker).toBe('\t- ');
		state.openNotesPiece({ start: 7, end: 7 }, false, '\t');
		state.typeNotesPiece('- z');
		expect(state.text).toBe(`${FRONTMATTER}- [ ] a\n\n\t- x\n\t  - y\n\t- z\n- [ ] b\n`);
	});

	test('gives no outdent marker for a top-level item of its list', () => {
		const state = editing(`${FRONTMATTER}- [ ] a\n\n\t- x\n\n\tpara\n\n\t  - y\n- [ ] b\n`);
		state.open(3);
		state.openNotesPiece({ start: 5, end: 6 }, false);
		expect(state.notesPieceOutdent('- x')).toBeNull();
		state.openNotesPiece({ start: 9, end: 10 }, false);
		expect(state.notesPieceOutdent('- y')).toBeNull();
	});

	test('follows a tick and a new item above it, and a line added above it from outside', () => {
		const state = editing(text);
		state.open(3);
		expect(state.openNotesPiece({ start: 7, end: 8 }, false)).toBe('piece');
		state.applyOwn(text.replace('[ ] box', '[x] box'), { start: 5, delta: 0, kind: 'change' });
		const withTop = `${FRONTMATTER}- [ ] top\n${state.text.slice(FRONTMATTER.length)}`;
		state.applyOwn(withTop, { start: 3, delta: 1, kind: 'insert' });
		state.outsideChange(`${FRONTMATTER}- [ ] first\n${state.text.slice(FRONTMATTER.length)}`);
		expect(saved(state.typeNotesPiece('piece!'))).toBe(true);
		expect(state.text).toBe(`${FRONTMATTER}- [ ] first\n- [ ] top\n- [ ] a\n\n\t- [x] box\n\n\tpiece!\n- [ ] b\n`);
	});

	test('notesPieceRange follows the lines typed, and is null once the piece closes', () => {
		const state = editing(text);
		state.open(3);
		state.openNotesPiece({ start: 7, end: 8 }, false);
		state.typeNotesPiece('one\ntwo\nthree');
		expect(state.notesPieceRange()).toEqual({ start: 7, end: 10 });
		state.closeNotes();
		expect(state.notesPieceRange()).toBeNull();
		expect(state.typeNotesPiece('x')).toEqual({ lost: true });
	});

	test('is lost once its item is deleted', () => {
		const state = editing(text);
		state.open(3);
		state.openNotesPiece({ start: 7, end: 8 }, false);
		state.applyOwn(`${FRONTMATTER}- [ ] b\n`, { start: 3, delta: -5, kind: 'delete' });
		expect(state.typeNotesPiece('mine')).toEqual({ lost: true });
	});

	test('is lost once an outside change takes its own lines', () => {
		const state = editing(text);
		state.open(3);
		state.openNotesPiece({ start: 7, end: 8 }, false);
		state.outsideChange(text.replace('\tpiece', '\tpiece from the phone'));
		expect(state.typeNotesPiece('mine')).toEqual({ lost: true });
		expect(state.text).toBe(text.replace('\tpiece', '\tpiece from the phone'));
	});
});

describe('the list note across a typing session', () => {
	test('typing a note where there was none puts it before the items, and moves the selection', () => {
		const text = `${FRONTMATTER}- [ ] a\n- [ ] b\n`;
		const state = editing(text);
		state.open(4);
		expect(state.openListNote({ start: 3, end: 3 }, false)).toBe('');
		const first = state.typeListNote('N');
		expect(first).toEqual({ edit: { start: 3, delta: 2, kind: 'insert' }, note: 'N' });
		state.typeListNote('Note\nmore');
		expect(state.text).toBe(`${FRONTMATTER}Note\nmore\n\n- [ ] a\n- [ ] b\n`);
		expect(state.selected).toBe(7);
	});

	test("a new piece's first save is a change at the line above it, so the lines below it follow", () => {
		const state = editing(`${FRONTMATTER}First\n\n- [ ] a\n`);
		state.openListNote({ start: 4, end: 4 }, true);
		expect(state.typeListNote('x')).toEqual({ edit: { start: 3, delta: 2, kind: 'change' }, note: 'First\n\nx' });
		expect(state.text).toBe(`${FRONTMATTER}First\n\nx\n\n- [ ] a\n`);
	});

	test('a piece opens alone, and typing into it changes only its lines', () => {
		const state = editing(`${FRONTMATTER}First\n\n- p\n  - q\n\n- [ ] a\n`);
		expect(state.openListNote({ start: 6, end: 7 }, false)).toBe('- q');
		expect(state.listNoteOutdent('- q')).toBe('- ');
		state.typeListNote('- q!');
		expect(state.text).toBe(`${FRONTMATTER}First\n\n- p\n  - q!\n\n- [ ] a\n`);
		expect(state.listNoteRange()).toEqual({ start: 6, end: 7 });
	});

	test('the note as typed is the whole note, which a nested checkbox line leaves a note', () => {
		const state = editing(`${FRONTMATTER}- p\n  - q\n\n- [ ] a\n`);
		state.openListNote({ start: 4, end: 5 }, false);
		expect(state.listNoteAsTyped('- [ ] x')).toBe('- p\n  - [ ] x');
	});

	// The note's first save wrote a blank line before the items too. While it is still blank and right
	// under the note, the session replaces it with the note, so emptying the note takes it away again.
	test.each([
		[`${FRONTMATTER}- [ ] a\n- [ ] b\n`],
		[`${FRONTMATTER}## H\n- [ ] a\n`],
		[crlfText(`${FRONTMATTER}- [ ] a\n`)],
	])('a note typed where there was none and erased again leaves %j as it was', (text) => {
		const state = editing(text);
		const start = contentStartOf(splitLines(text));
		state.open(start);
		state.openListNote({ start, end: start }, false);
		typeEach((v) => state.typeListNote(v), ['N', 'No', 'N', '']);
		expect(state.text).toBe(text);
		expect(state.selected).toBe(start);
	});

	test('a new piece after the last is saved after an empty line, and erased leaves the note as it was', () => {
		const text = `${FRONTMATTER}First\n- [ ] a\n`;
		const state = editing(text);
		state.openListNote({ start: 4, end: 4 }, true);
		state.typeListNote('new');
		expect(state.text).toBe(`${FRONTMATTER}First\n\nnew\n\n- [ ] a\n`);
		typeEach((v) => state.typeListNote(v), ['ne', 'n', '']);
		expect(state.text).toBe(text);
	});

	// Until the field loses focus, those lines are still the note being typed: a row drawn for a typed
	// `- [ ] y` and acted on would write it twice.
	test('rows for lines inside the note being typed are left out of a redraw', () => {
		const text = `${FRONTMATTER}Old\n\n- [ ] a\n## H\n- [ ] b\n`;
		const state = editing(text);
		state.openListNote({ start: 3, end: 4 }, false);
		state.typeListNote('Old\n# Typed\n- [ ] y\nmore');
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

	// The blank line its save wrote is the session's only while it is still blank and still right
	// under the piece, so a line added between the two is kept.
	test.each([
		['an item', '- [ ] milk'],
		['a heading', '## Milk'],
	])('%s another device adds right under the note survives the next keystroke', (_, added) => {
		const state = editing(`${FRONTMATTER}- [ ] a\n`);
		state.openListNote({ start: 3, end: 3 }, false);
		state.typeListNote('N');
		expect(state.text).toBe(`${FRONTMATTER}N\n\n- [ ] a\n`);
		state.outsideChange(`${FRONTMATTER}N\n${added}\n\n- [ ] a\n`);
		state.typeListNote('No');
		expect(state.text).toBe(`${FRONTMATTER}No\n\n${added}\n\n- [ ] a\n`);
		state.typeListNote('');
		expect(state.text).toBe(`${FRONTMATTER}${added}\n\n- [ ] a\n`);
	});

	test('a blank line the list already had stays when the note is erased', () => {
		const text = `${FRONTMATTER}Old\n\n- [ ] a\n`;
		const state = editing(text);
		state.openListNote({ start: 3, end: 4 }, false);
		typeEach((v) => state.typeListNote(v), ['Ol', 'O', '']);
		expect(state.text).toBe(`${FRONTMATTER}\n- [ ] a\n`);
	});

	test('an item added at the top elsewhere stays after the note being typed', () => {
		const state = editing(`${FRONTMATTER}- [ ] a\n`);
		state.openListNote({ start: 3, end: 3 }, false);
		state.outsideChange(`${FRONTMATTER}- [ ] new\n- [ ] a\n`);
		state.typeListNote('Note');
		expect(state.text).toBe(`${FRONTMATTER}Note\n\n- [ ] new\n- [ ] a\n`);
	});

	test('a heading typed into the note, then taken out again, leaves the items as they were', () => {
		const text = `${FRONTMATTER}Old\n\n- [ ] a\n`;
		const state = editing(text);
		state.openListNote({ start: 3, end: 4 }, false);
		typeEach((v) => state.typeListNote(v), ['Old\n#', 'Old\n# ', 'Old\n# H', 'Old\n# ', 'Old\n#', 'Old\n', 'Old']);
		expect(state.text).toBe(text);
	});

	test('an unclosed fence saves, and closing it brings back what follows as it was', () => {
		const text = `${FRONTMATTER}Old\n\n- [ ] a\n## H\n- [ ] b\n`;
		const state = editing(text);
		state.openListNote({ start: 3, end: 4 }, false);
		const typed = typeEach((v) => state.typeListNote(v), ['Old\n```', 'Old\n```\ncode', 'Old\n```\ncode\n```']);
		expect(typed.every(saved)).toBe(true);
		expect(state.text).toBe(`${FRONTMATTER}Old\n\`\`\`\ncode\n\`\`\`\n\n- [ ] a\n## H\n- [ ] b\n`);
	});

	test('a refused keystroke keeps nothing, says so once, and the next one tries again', () => {
		const text = `${FRONTMATTER}Old\n\n  - [ ] a\n`;
		const state = editing(text);
		state.openListNote({ start: 3, end: 4 }, false);
		const typed = typeEach((v) => state.typeListNote(v), ['- a', '- ab', 'ab']);
		expect(typed[0]).toEqual({ refused: true, firstRefusal: true });
		expect(typed[1]).toEqual({ refused: true, firstRefusal: false });
		expect(saved(typed[2] as Typed)).toBe(true);
		expect(state.text).toBe(`${FRONTMATTER}ab\n\n  - [ ] a\n`);
		state.closeListNote();
		state.openListNote({ start: 3, end: 4 }, false);
		expect(state.typeListNote('- a')).toEqual({ refused: true, firstRefusal: true });
	});

	test('an outside change above the piece moves it, and typing lands in the same piece', () => {
		const state = editing(`${FRONTMATTER}First\n\nSecond\n\n- [ ] a\n`);
		state.openListNote({ start: 5, end: 6 }, false);
		state.outsideChange(`${FRONTMATTER}Zero\n\nFirst\n\nSecond\n\n- [ ] a\n`);
		state.typeListNote('Second!');
		expect(state.text).toBe(`${FRONTMATTER}Zero\n\nFirst\n\nSecond!\n\n- [ ] a\n`);
	});

	test("an outside change to the piece's own lines loses it, and typing writes nothing", () => {
		const state = editing(`${FRONTMATTER}One\ntwo\n\n- [ ] a\n`);
		state.openListNote({ start: 3, end: 5 }, false);
		state.typeListNote('One\ntwo!');
		const merged = `${FRONTMATTER}One\nTWO\n\n- [ ] a\n`;
		expect(state.outsideChange(merged)).toEqual({ lostSelected: false });
		expect(state.typeListNote('One\ntwo!!')).toEqual({ lost: true });
		expect(state.listNoteRange()).toBeNull();
		expect(state.text).toBe(merged);
	});

	test("a card's piece and the list note's are one session: opening one ends the other", () => {
		const state = editing(`${FRONTMATTER}Note\n\n- [ ] a\n\tfirst\n`);
		state.open(5);
		state.openNotesPiece({ start: 6, end: 7 }, false);
		state.openListNote({ start: 3, end: 4 }, false);
		expect(state.notesPieceRange()).toBeNull();
		expect(state.typeNotesPiece('x')).toEqual({ lost: true });
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
