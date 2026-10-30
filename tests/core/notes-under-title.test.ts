import { Parser } from 'commonmark';
import { describe, expect, test } from 'vitest';
import { ListEditing } from '../../src/core/editing';
import { splitLines } from '../../src/core/lines';
import { contentStartOf, crlf, notesEditor as editor } from './edit-helpers';

const UNDER_TITLE = '- [ ] c\n\tnote\n- [ ] d\n';
const titleBlock = (text: string) => new Parser().parse(text).firstChild?.firstChild?.firstChild?.type;
const saved = (typed: unknown) => typeof typed === 'object' && typed !== null && 'edit' in typed;

function editing(text: string): ListEditing {
	const state = new ListEditing((t) => contentStartOf(splitLines(t)));
	state.text = text;
	state.open(0);
	return state;
}

// Each text in turn, as the editor holds it after a change, from the item's first line.
function typedInTurn(text: string, ...steps: string[]): ListEditing {
	const state = editing(text);
	const notes = editor(state, 'item');
	for (const step of steps) expect(saved(notes.type(step))).toBe(true);
	return state;
}

describe('notes directly under the title', () => {
	test.each([
		['a --- below a line', 'note\n---', '- [ ] c\n\n\tnote\n\t---\n- [ ] d\n'],
		['a ===', 'note\n===', '- [ ] c\n\n\tnote\n\t===\n- [ ] d\n'],
		['a --- in place of the only line', '---', '- [ ] c\n\n\t---\n- [ ] d\n'],
	])('%s writes the empty line under the title, which stays a paragraph', (_, typed, expected) => {
		const state = editing(UNDER_TITLE);
		expect(saved(editor(state, 'item').type(typed))).toBe(true);
		expect(state.text).toBe(expected);
		expect(titleBlock(state.text)).toBe('paragraph');
	});

	test('a change that leaves the title as it is writes only its own line', () => {
		const state = editing(UNDER_TITLE);
		editor(state, 'item').type('note!');
		expect(state.text).toBe('- [ ] c\n\tnote!\n- [ ] d\n');
	});

	test('the lines between the title and the change keep every byte', () => {
		const text = '- [ ] c\n\tone\r\n    two\n- [ ] d\n';
		const state = editing(text);
		editor(state, 'item').type('one\ntwo\n---');
		expect(state.text).toBe('- [ ] c\n\n\tone\r\n    two\n\t---\n- [ ] d\n');
	});

	test('the visit follows its lines down, and emptying the notes takes the empty line again', () => {
		const state = editing(UNDER_TITLE);
		const notes = editor(state, 'item');
		notes.type('note\n---');
		expect(state.notesPieceRange()).toEqual({ start: 2, end: 4 });
		expect(state.visitText()).toBe(notes.text);
		notes.type('note\n---\nmore');
		expect(state.text).toBe('- [ ] c\n\n\tnote\n\t---\n\tmore\n- [ ] d\n');
		notes.type('');
		expect(state.text).toBe('- [ ] c\n- [ ] d\n');
	});

	test('the edit counts the empty line, which takes the file\'s ending', () => {
		const state = editing(crlf(UNDER_TITLE));
		const typed = editor(state, 'item').type('note\n---');
		expect(state.text).toBe(crlf('- [ ] c\n\n\tnote\n\t---\n- [ ] d\n'));
		expect(typed).toEqual({ edit: { start: 0, delta: 2, kind: 'change' } });
	});

	test.each([
		['Enter at the start, then the empty line taken back', ['\nnote', '\nnote\n---', 'note\n---'], '- [ ] c\n\n\tnote\n\t---\n- [ ] d\n'],
		['a paste over the empty line Enter made', ['\nnote', '---\nnote'], '- [ ] c\n\n\t---\n\tnote\n- [ ] d\n'],
		['a paste into emptied notes', ['', 'a\n---'], '- [ ] c\n\n\ta\n\t---\n- [ ] d\n'],
	])('%s still leaves the title a paragraph', (_, steps, expected) => {
		const state = typedInTurn(UNDER_TITLE, ...steps);
		expect(state.text).toBe(expected);
		expect(titleBlock(state.text)).toBe('paragraph');
	});

	test('a lone - is an underline too, so the first key of a bullet writes the empty line', () => {
		expect(typedInTurn(UNDER_TITLE, 'note\n-').text).toBe('- [ ] c\n\n\tnote\n\t-\n- [ ] d\n');
	});

	test.each([
		['a lazy line', '- [ ] c\nlazy\n- [ ] d\n', 'lazy\n-', '- [ ] c\n\n\tlazy\n\t-\n- [ ] d\n'],
		['only the first of two lazy lines', '- [ ] c\none\ntwo\n', 'one\ntwo\n---', '- [ ] c\n\n\tone\ntwo\n\t---\n'],
		['a line short of an ordered item\'s column', '10. [ ] c\n  note\n', 'note\n---', '10. [ ] c\n\n\tnote\n\t---\n'],
	])('%s takes the notes\' indent, so it stays in the item', (_, text, typed, expected) => {
		expect(typedInTurn(text, typed).text).toBe(expected);
	});

	test.each([
		['the end of a file without a final newline', '- [ ] c\nlazy', 'lazy\n-', '- [ ] c\n\n\tlazy\n\t-'],
		['the same in CRLF', '- [ ] c\r\nlazy', 'lazy\n---', '- [ ] c\r\n\r\n\tlazy\r\n\t---'],
		['a line with its own ending', '- [ ] c\r\nlazy\n- [ ] d\r\n- [ ] e\r\n', 'lazy\n---', '- [ ] c\r\n\r\n\tlazy\n\t---\r\n- [ ] d\r\n- [ ] e\r\n'],
	])('a lazy line at %s saves, with the right ending', (_, text, typed, expected) => {
		expect(typedInTurn(text, typed).text).toBe(expected);
	});

	test('a file without a final newline stays so, and emptying takes the line again', () => {
		const state = typedInTurn('- [ ] c\n\tnote', 'note\n---');
		expect(state.text).toBe('- [ ] c\n\n\tnote\n\t---');
		editor(state, 'item').type('');
		expect(state.text).toBe('- [ ] c');
	});

	test('a --- after an empty line is a rule, so it writes only its own lines', () => {
		expect(typedInTurn(UNDER_TITLE, 'note\n\n', 'note\n\n---').text).toBe('- [ ] c\n\tnote\n\n\t---\n- [ ] d\n');
	});

	test('a title already a heading gets the empty line with the next save that keeps it one', () => {
		expect(typedInTurn('- [ ] c\n\tnote\n\t---\n', 'note!\n---').text).toBe('- [ ] c\n\n\tnote!\n\t---\n');
	});
});
