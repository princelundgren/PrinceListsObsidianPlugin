import { describe, expect, test } from 'vitest';
import { ListEditing } from '../../src/core/editing';
import { getItemNotes } from '../../src/core/edit-items';
import { splitLines } from '../../src/core/lines';
import { changedLines } from '../../src/core/notes-lines';
import { contentStartOf, crlf, list } from './edit-helpers';

const FRONTMATTER = '---\nprincelists: true\n---\n';

function editing(text: string, selected?: number): ListEditing {
	const state = new ListEditing((t) => contentStartOf(splitLines(t)));
	state.text = text;
	if (selected !== undefined) state.open(selected);
	return state;
}

// The editor: it opens a visit, and saves each change as changedLines gives it, as the view will.
function editor(state: ListEditing, notes: 'item' | 'listNote') {
	let text = state.openNotes(notes);
	if (text === null) throw new Error('The card has no item');
	return {
		get text() {
			return text as string;
		},
		type(next: string) {
			const change = changedLines(text as string, next);
			text = next;
			if (!change) return null;
			return notes === 'item' ? state.saveNotes(change) : state.saveListNote(change);
		},
	};
}

const saved = (typed: unknown) => typeof typed === 'object' && typed !== null && 'edit' in typed;
// The notes as the editor holds them, without the empty lines at their start and end, which the
// parse leaves out.
const trimmed = (text: string) => text.replace(/^\n+/, '').replace(/\n+$/, '');

describe('changedLines', () => {
	test('typing in one line gives that line', () => {
		expect(changedLines('x\na\ny', 'x\nab\ny')).toEqual({ from: 1, to: 2, lines: ['ab'] });
	});

	test('Enter at the end of a line inserts one empty line after it', () => {
		expect(changedLines('x\na\ny', 'x\na\n\ny')).toEqual({ from: 2, to: 2, lines: [''] });
	});

	test('joining two lines gives the joined line in place of both', () => {
		expect(changedLines('x\na\ny', 'xa\ny')).toEqual({ from: 0, to: 2, lines: ['xa'] });
	});

	test('erasing all of a line leaves it empty', () => {
		expect(changedLines('a', '')).toEqual({ from: 0, to: 1, lines: [''] });
	});

	test('an inserted line among equal lines rewrites none of them', () => {
		expect(changedLines('a\na', 'a\na\na')).toEqual({ from: 2, to: 2, lines: ['a'] });
	});

	test('equal texts give null', () => {
		expect(changedLines('x\ny', 'x\ny')).toBeNull();
	});
});

describe("a visit to a card's notes", () => {
	// Design risk 2: a whitespace-only line, a lazy line, and lines indented with a tab and with
	// four spaces, in a CRLF file without a final newline.
	test('a change to one line rewrites that file line only, and keeps its own indent', () => {
		const text = crlf(`${FRONTMATTER}- [ ] a\n\tone\nlazy\n \t\n    four\n\ttab\n- [ ] b`);
		const state = editing(text, 3);
		const notes = editor(state, 'item');
		expect(notes.text).toBe('one\nlazy\n\nfour\ntab');
		notes.type('one\nlazy\n\nfour!\ntab');
		expect(state.text).toBe(text.replace('    four', '    four!'));
		notes.type('one\nlazy\n\nfour!\ntab!');
		expect(state.text).toBe(text.replace('    four', '    four!').replace('\ttab', '\ttab!'));
	});

	test('a touched line keeps a tab that reaches past the notes\' column', () => {
		const state = editing(`${FRONTMATTER}- [ ] a\n  one\n\ttwo\n- [ ] b\n`, 3);
		const notes = editor(state, 'item');
		expect(notes.text).toBe('one\n  two');
		notes.type('one\n  two!');
		expect(state.text).toBe(`${FRONTMATTER}- [ ] a\n  one\n\ttwo!\n- [ ] b\n`);
	});

	test("a touched lazy line takes the notes' indent, so a list marker typed on it stays in the notes", () => {
		const state = editing(`${FRONTMATTER}- [ ] a\n\tone\nlazy\n- [ ] b\n`, 3);
		expect(saved(editor(state, 'item').type('one\n- lazy'))).toBe(true);
		expect(state.text).toBe(`${FRONTMATTER}- [ ] a\n\tone\n\t- lazy\n- [ ] b\n`);
	});

	test('Enter at the end of a line, then text on the new line, writes it between the two', () => {
		const state = editing(`${FRONTMATTER}- [ ] t\n\tx\n\ta\n    y\n- [ ] u\n`, 3);
		const notes = editor(state, 'item');
		notes.type('x\na\n\ny');
		notes.type('x\na\nb\ny');
		expect(state.text).toBe(`${FRONTMATTER}- [ ] t\n\tx\n\ta\n\tb\n    y\n- [ ] u\n`);
	});

	test("erasing a line's text leaves an empty file line in its place", () => {
		const state = editing(`${FRONTMATTER}- [ ] t\n\tx\n\ta\n    y\n- [ ] u\n`, 3);
		editor(state, 'item').type('x\n\ny');
		expect(state.text).toBe(`${FRONTMATTER}- [ ] t\n\tx\n\n    y\n- [ ] u\n`);
	});

	test('Enter at the start of the first line puts an empty line there, and the next keystroke lands on the text', () => {
		const state = editing(`${FRONTMATTER}- [ ] t\n\ta\n\tb\n- [ ] u\n`, 3);
		const notes = editor(state, 'item');
		notes.type('\na\nb');
		notes.type('\na!\nb');
		expect(state.text).toBe(`${FRONTMATTER}- [ ] t\n\n\ta!\n\tb\n- [ ] u\n`);
	});

	test('Enter in the middle of a line, then a keystroke on the new line, lands each on its own line', () => {
		const state = editing(`${FRONTMATTER}- [ ] t\n\tabcd\n- [ ] u\n`, 3);
		const notes = editor(state, 'item');
		expect(state.notesPieceRange()).toEqual({ start: 4, end: 5 });
		notes.type('ab\ncd');
		notes.type('ab\ncdX');
		expect(state.text).toBe(`${FRONTMATTER}- [ ] t\n\tab\n\tcdX\n- [ ] u\n`);
		expect(state.notesPieceRange()).toEqual({ start: 4, end: 6 });
	});

	// Design risk 3, each as the editor sends it: the block's text selected and deleted.
	test.each([
		['in the middle', 'p1\n\n\n\np3', `\tp1\n\n\n\n\tp3`],
		['at the end', 'p1\n\np2\n\n', `\tp1\n\n\tp2\n\n`],
		['at the start', '\n\np2\n\np3', `\n\n\tp2\n\n\tp3`],
	])('emptying a block %s changes only its line, and the notes read back as the editor holds them', (_, typed, notesLines) => {
		const state = editing(`${FRONTMATTER}- [ ] t\n\tp1\n\n\tp2\n\n\tp3\n- [ ] u\n`, 3);
		editor(state, 'item').type(typed);
		expect(state.text).toBe(`${FRONTMATTER}- [ ] t\n${notesLines}\n- [ ] u\n`);
		const { lines, item } = list(state.text);
		expect(getItemNotes(lines, item(0))).toBe(trimmed(typed));
	});

	test('the first text in empty notes gets one empty line under the title, which erasing it takes again', () => {
		const text = `${FRONTMATTER}- [ ] a\n- [ ] b\n`;
		const state = editing(text, 3);
		const notes = editor(state, 'item');
		expect(notes.text).toBe('');
		notes.type('x');
		expect(state.text).toBe(`${FRONTMATTER}- [ ] a\n\n\tx\n- [ ] b\n`);
		expect(state.notesPieceRange()).toEqual({ start: 5, end: 6 });
		notes.type('');
		expect(state.text).toBe(text);
		notes.type('y');
		expect(state.text).toBe(`${FRONTMATTER}- [ ] a\n\n\ty\n- [ ] b\n`);
	});

	test('Enter in empty notes, then text on the second line, writes both lines under the empty one', () => {
		const state = editing(`${FRONTMATTER}- [ ] a\n- [ ] b\n`, 3);
		const notes = editor(state, 'item');
		notes.type('\n');
		notes.type('\nx');
		expect(state.text).toBe(`${FRONTMATTER}- [ ] a\n\n\n\tx\n- [ ] b\n`);
		expect(state.visitText()).toBe(notes.text);
	});

	// Design risk 4.
	test("an empty line typed at the end, then text on it, writes the text there and leaves the next item's title", () => {
		const state = editing(`${FRONTMATTER}- [ ] t\n\ta\n- [ ] u\n`, 3);
		const notes = editor(state, 'item');
		notes.type('a\n');
		expect(state.text).toBe(`${FRONTMATTER}- [ ] t\n\ta\n\n- [ ] u\n`);
		notes.type('a\nb');
		expect(state.text).toBe(`${FRONTMATTER}- [ ] t\n\ta\n\tb\n- [ ] u\n`);
	});

	// The file can't keep empty lines at its end without a final newline, so the visit counts them
	// past it, and the text typed after them writes them back.
	test('at the end of a file without a final newline, empty lines typed at the end come back with the text after them', () => {
		const state = editing(`${FRONTMATTER}- [ ] t\n\ta`, 3);
		const notes = editor(state, 'item');
		notes.type('a\n');
		expect(state.text).toBe(`${FRONTMATTER}- [ ] t\n\ta`);
		notes.type('a\n\n');
		notes.type('a\n\nb');
		expect(state.text).toBe(`${FRONTMATTER}- [ ] t\n\ta\n\n\tb`);
		expect(state.visitText()).toBe(notes.text);
	});
});

describe('a visit to the list note', () => {
	test.each([
		['in the middle', 'p1\n\n\n\np3'],
		['at the end', 'p1\n\np2\n\n'],
		['at the start', '\n\np2\n\np3'],
	])('emptying a block %s changes only its line, and the note reads back as the editor holds it', (_, typed) => {
		const state = editing(`${FRONTMATTER}p1\n\np2\n\np3\n\n- [ ] a\n`);
		editor(state, 'listNote').type(typed);
		expect(state.text).toBe(`${FRONTMATTER}${typed}\n\n- [ ] a\n`);
		expect(editing(state.text).openNotes('listNote')).toBe(trimmed(typed));
	});

	test('an empty line typed at the end, then text on it, writes the blank line after the note once', () => {
		const state = editing(`${FRONTMATTER}x\n- [ ] u\n`);
		const notes = editor(state, 'listNote');
		notes.type('x\n');
		expect(state.text).toBe(`${FRONTMATTER}x\n\n- [ ] u\n`);
		notes.type('x\nb');
		expect(state.text).toBe(`${FRONTMATTER}x\nb\n\n- [ ] u\n`);
	});

	test('a change above its last line writes no blank line after it', () => {
		const state = editing(`${FRONTMATTER}x\ny\n- [ ] u\n`);
		editor(state, 'listNote').type('x!\ny');
		expect(state.text).toBe(`${FRONTMATTER}x!\ny\n- [ ] u\n`);
	});

	test('a change is a change at the line above the lines it writes', () => {
		const state = editing(`${FRONTMATTER}x\ny\n\n- [ ] u\n`);
		expect(editor(state, 'listNote').type('x\ny!')).toEqual({ edit: { start: 3, delta: 0, kind: 'change' }, note: 'x\ny!' });
	});

	test.each([
		['LF', (text: string) => text],
		['CRLF', crlf],
	])('Enter at the end of a note that ends a file without a final newline, then text, saves (%s)', (_, endings) => {
		const state = editing(endings(`${FRONTMATTER}x`));
		const notes = editor(state, 'listNote');
		notes.type('x\n');
		expect(saved(notes.type('x\nb'))).toBe(true);
		expect(state.text).toBe(endings(`${FRONTMATTER}x\nb`));
		expect(state.visitText()).toBe(notes.text);
	});

	test('the first text in an empty note writes a blank line before the items, and erasing it takes both again', () => {
		const text = `${FRONTMATTER}- [ ] a\n`;
		const state = editing(text);
		const notes = editor(state, 'listNote');
		notes.type('N');
		expect(state.text).toBe(`${FRONTMATTER}N\n\n- [ ] a\n`);
		notes.type('');
		expect(state.text).toBe(text);
	});

	test('starts at its first line with text, and a change leaves the empty lines above it', () => {
		const state = editing(`${FRONTMATTER}\n\nNote\n\n- [ ] a\n`);
		const notes = editor(state, 'listNote');
		expect(notes.text).toBe('Note');
		notes.type('Note!');
		expect(state.text).toBe(`${FRONTMATTER}\n\nNote!\n\n- [ ] a\n`);
	});
});
