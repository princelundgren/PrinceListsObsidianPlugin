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
		expect(state.outsideChange(merged)).toEqual({ lostSelected: false, noteText: null });
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
		expect(state.outsideChange(merged)).toEqual({ lostSelected: true, noteText: null });
		expect(state.selected).toBeNull();
		expect(state.typeTitle('buy milk')).toEqual({ lost: true });
		expect(state.text).toBe(merged);
	});
});

describe('the notes field across a typing session', () => {
	const text = `${FRONTMATTER}- [ ] a\n- [ ] b\n\n\told note\n- [ ] c\n\n\tc's note\n`;

	test('every save uses the indent the notes had when the field opened', () => {
		const state = editing(text);
		state.open(4);
		expect(state.openNotes()).toBe('old note');
		typeEach((v) => state.typeNotes(v), [' x', ' xy', ' xy\n', ' xy\n- one', ' xy\n- one\n---']);
		expect(state.text).toBe(`${FRONTMATTER}- [ ] a\n- [ ] b\n\n\t xy\n\t- one\n\t---\n- [ ] c\n\n\tc's note\n`);
	});

	test('the lines after the item shift as the notes grow and shrink, and selected stays', () => {
		const state = editing(text);
		state.open(4);
		state.openNotes();
		const grow = state.typeNotes('one\ntwo\nthree');
		expect(grow).toEqual({ edit: { start: 4, delta: 2, kind: 'change' } });
		const shrink = state.typeNotes('');
		expect(shrink).toEqual({ edit: { start: 4, delta: -4, kind: 'change' } });
		expect(state.selected).toBe(4);
		expect(list(state.text).item(2).titleLine).toBe(5);
	});

	test('outside changes elsewhere are kept, and typing goes on in the same item', () => {
		const state = editing(text);
		state.open(4);
		state.openNotes();
		state.typeNotes('first');
		// From the phone, one Sync at a time: an item added at the top, then c's note edited.
		state.outsideChange(`${FRONTMATTER}- [ ] top\n- [ ] a\n- [ ] b\n\n\tfirst\n- [ ] c\n\n\tc's note\n`);
		expect(state.selected).toBe(5);
		state.outsideChange(`${FRONTMATTER}- [ ] top\n- [ ] a\n- [ ] b\n\n\tfirst\n- [ ] c\n\n\tc's note, edited\n`);
		expect(state.selected).toBe(5);
		state.typeNotes('first\nsecond');
		expect(state.text).toBe(`${FRONTMATTER}- [ ] top\n- [ ] a\n- [ ] b\n\n\tfirst\n\tsecond\n- [ ] c\n\n\tc's note, edited\n`);
	});

	// mapLine finds one changed run between the lines both texts share at the start and the end, so
	// changes above and below the item in one Sync lose it, and its card closes.
	test('changes above and below it in one outside change lose the item', () => {
		const state = editing(text);
		state.open(4);
		state.openNotes();
		state.typeNotes('first');
		const merged = `${FRONTMATTER}- [ ] top\n- [ ] a\n- [ ] b\n\n\tfirst\n- [ ] c\n\n\tc's note, edited\n`;
		expect(state.outsideChange(merged).lostSelected).toBe(true);
		expect(state.typeNotes('first\nsecond')).toEqual({ lost: true });
		expect(state.text).toBe(merged);
	});

	test('an outside change inside the notes being typed is overwritten by the next keystroke', () => {
		const state = editing(text);
		state.open(4);
		state.openNotes();
		state.typeNotes('mine');
		state.outsideChange(`${FRONTMATTER}- [ ] a\n- [ ] b\n\n\ttheirs\n- [ ] c\n\n\tc's note\n`);
		state.typeNotes('mine!');
		expect(state.text).toBe(`${FRONTMATTER}- [ ] a\n- [ ] b\n\n\tmine!\n- [ ] c\n\n\tc's note\n`);
	});

	test('closing the notes ends the session: typing then writes nothing', () => {
		const state = editing(text);
		state.open(4);
		state.openNotes();
		state.closeNotes();
		expect(state.typeNotes('x')).toEqual({ lost: true });
		expect(state.text).toBe(text);
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
		expect(state.openListNote()).toBe('');
		const first = state.typeListNote('N');
		expect(first).toEqual({ edit: { start: 3, delta: 2, kind: 'insert' } });
		state.typeListNote('Note\nmore');
		expect(state.text).toBe(`${FRONTMATTER}Note\nmore\n\n- [ ] a\n- [ ] b\n`);
		expect(state.selected).toBe(7);
	});

	// The note's first save wrote a blank line before the items too. While it is still blank and right
	// under the note, the session replaces it with the note, so emptying the note takes it away again.
	test.each([
		[`${FRONTMATTER}- [ ] a\n- [ ] b\n`],
		[`${FRONTMATTER}## H\n- [ ] a\n`],
		[crlfText(`${FRONTMATTER}- [ ] a\n`)],
	])('a note typed where there was none and erased again leaves %j as it was', (text) => {
		const state = editing(text);
		state.open(contentStartOf(splitLines(text)));
		state.openListNote();
		typeEach((v) => state.typeListNote(v), ['N', 'No', 'N', '']);
		expect(state.text).toBe(text);
		expect(state.selected).toBe(contentStartOf(splitLines(text)));
	});

	// Until the field loses focus, those lines are still the note being typed: a row drawn for a typed
	// `- [ ] y` and acted on would write it twice.
	test('rows for lines inside the note being typed are left out of a redraw', () => {
		const text = `${FRONTMATTER}Old\n\n- [ ] a\n## H\n- [ ] b\n`;
		const state = editing(text);
		state.openListNote();
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

	// The range is the note's own lines: the blank line its save wrote is the session's only while it
	// is still blank and still right under the note, so a line added between the two is kept.
	test.each([
		['an item', '- [ ] milk'],
		['a heading', '## Milk'],
	])('%s another device adds right under the note survives the next keystroke', (_, added) => {
		const state = editing(`${FRONTMATTER}- [ ] a\n`);
		state.openListNote();
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
		state.openListNote();
		typeEach((v) => state.typeListNote(v), ['Ol', 'O', '']);
		expect(state.text).toBe(`${FRONTMATTER}\n- [ ] a\n`);
	});

	test('an item added at the top elsewhere stays after the note being typed', () => {
		const state = editing(`${FRONTMATTER}- [ ] a\n`);
		state.openListNote();
		state.outsideChange(`${FRONTMATTER}- [ ] new\n- [ ] a\n`);
		state.typeListNote('Note');
		expect(state.text).toBe(`${FRONTMATTER}Note\n\n- [ ] new\n- [ ] a\n`);
	});

	test('a heading typed into the note, then taken out again, leaves the items as they were', () => {
		const text = `${FRONTMATTER}Old\n\n- [ ] a\n`;
		const state = editing(text);
		state.openListNote();
		typeEach((v) => state.typeListNote(v), ['Old\n#', 'Old\n# ', 'Old\n# H', 'Old\n# ', 'Old\n#', 'Old\n', 'Old']);
		expect(state.text).toBe(text);
	});

	test('an unclosed fence saves, and closing it brings back what follows as it was', () => {
		const text = `${FRONTMATTER}Old\n\n- [ ] a\n## H\n- [ ] b\n`;
		const state = editing(text);
		state.openListNote();
		const typed = typeEach((v) => state.typeListNote(v), ['Old\n```', 'Old\n```\ncode', 'Old\n```\ncode\n```']);
		expect(typed.every(saved)).toBe(true);
		expect(state.text).toBe(`${FRONTMATTER}Old\n\`\`\`\ncode\n\`\`\`\n\n- [ ] a\n## H\n- [ ] b\n`);
	});

	test('a refused keystroke keeps nothing, says so once, and the next one tries again', () => {
		const text = `${FRONTMATTER}Old\n\n  - [ ] a\n`;
		const state = editing(text);
		state.openListNote();
		const typed = typeEach((v) => state.typeListNote(v), ['- a', '- ab', 'ab']);
		expect(typed[0]).toEqual({ refused: true, firstRefusal: true });
		expect(typed[1]).toEqual({ refused: true, firstRefusal: false });
		expect(saved(typed[2] as Typed)).toBe(true);
		expect(state.text).toBe(`${FRONTMATTER}ab\n\n  - [ ] a\n`);
		state.closeListNote();
		state.openListNote();
		expect(state.typeListNote('- a')).toEqual({ refused: true, firstRefusal: true });
	});

	test("an outside change to the note's own lines makes the field read the note again", () => {
		const state = editing(`${FRONTMATTER}Old\n\n- [ ] a\n`);
		state.openListNote();
		state.typeListNote('Mine');
		const result = state.outsideChange(`${FRONTMATTER}Theirs\nand more\n\n- [ ] a\n`);
		expect(result).toEqual({ lostSelected: false, noteText: 'Theirs\nand more' });
		state.typeListNote('Theirs\nand more, and mine');
		expect(state.text).toBe(`${FRONTMATTER}Theirs\nand more, and mine\n\n- [ ] a\n`);
	});

	test('a change inside the note that leaves both ends is overwritten by the next keystroke', () => {
		const state = editing(`${FRONTMATTER}One\ntwo\nthree\n\n- [ ] a\n`);
		state.openListNote();
		state.outsideChange(`${FRONTMATTER}One\nTWO\nthree\n\n- [ ] a\n`);
		state.typeListNote('One\ntwo\nthree!');
		expect(state.text).toBe(`${FRONTMATTER}One\ntwo\nthree!\n\n- [ ] a\n`);
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
