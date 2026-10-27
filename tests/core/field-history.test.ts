import { describe, expect, test } from 'vitest';
import { FieldHistory, type FieldState } from '../../src/core/field-history';
import { HISTORY_LIMIT } from '../../src/core/history';

// A field holding `value` with the caret at its end.
function at(value: string): FieldState {
	return { value, start: value.length, end: value.length };
}

describe('FieldHistory', () => {
	test('undoes a run of typing in one step, and redoes it', () => {
		const history = new FieldHistory();
		history.changed(at(''), at('a'), 'insertText');
		history.changed(at('a'), at('ab'), 'insertText');
		expect(history.undo(at('ab'))).toEqual(at(''));
		expect(history.undo(at(''))).toBeNull();
		expect(history.redo(at(''))).toEqual(at('ab'));
		expect(history.redo(at('ab'))).toBeNull();
	});

	test('starts a new step when the kind of change differs', () => {
		const history = new FieldHistory();
		history.changed(at(''), at('ab'), 'insertText');
		history.changed(at('ab'), at('a'), 'deleteContentBackward');
		expect(history.undo(at('a'))).toEqual(at('ab'));
		expect(history.undo(at('ab'))).toEqual(at(''));
	});

	test('starts a new step when typing goes on somewhere else', () => {
		const history = new FieldHistory();
		history.changed(at(''), at('ab'), 'insertText');
		const moved = { value: 'ab', start: 0, end: 0 };
		history.changed(moved, { value: 'xab', start: 1, end: 1 }, 'insertText');
		expect(history.undo({ value: 'xab', start: 1, end: 1 })).toEqual(moved);
		expect(history.undo(moved)).toEqual(at(''));
	});

	test('keeps each format a step of its own', () => {
		const history = new FieldHistory();
		history.changed(at('a'), at('**a**'), 'format');
		history.changed(at('**a**'), at('**a**b'), 'format');
		expect(history.undo(at('**a**b'))).toEqual(at('**a**'));
	});

	test('drops what could be redone once something new changes', () => {
		const history = new FieldHistory();
		history.changed(at(''), at('a'), 'insertText');
		history.undo(at('a'));
		history.changed(at(''), at('b'), 'insertText');
		expect(history.redo(at('b'))).toBeNull();
	});

	test('starts a new step for typing after a redo', () => {
		const history = new FieldHistory();
		history.changed(at(''), at('a'), 'insertText');
		history.undo(at('a'));
		history.redo(at(''));
		history.changed(at('a'), at('ab'), 'insertText');
		expect(history.undo(at('ab'))).toEqual(at('a'));
	});

	test('pairs a change announced before it with the state after it', () => {
		const history = new FieldHistory();
		history.willChange(at('a'), 'insertText');
		history.didChange(at('ab'));
		expect(history.undo(at('ab'))).toEqual(at('a'));
	});

	test('keeps as many steps as the list history, dropping the oldest', () => {
		const history = new FieldHistory();
		for (let i = 0; i <= HISTORY_LIMIT; i++) history.changed(at(String(i)), at(String(i + 1)), 'script');
		let state: FieldState | null = at(String(HISTORY_LIMIT + 1));
		let undone = 0;
		while ((state = history.undo(state ?? at(''))) !== null) {
			undone++;
			expect(state).toEqual(at(String(HISTORY_LIMIT + 1 - undone)));
		}
		expect(undone).toBe(HISTORY_LIMIT);
	});

	test('records a change the view makes as one step, even after an announced change that never happened', () => {
		const history = new FieldHistory();
		history.willChange(at(''), 'deleteContentBackward');
		history.changed(at(''), at('**a**'), 'script');
		history.didChange(at('**a**'));
		expect(history.undo(at('**a**'))).toEqual(at(''));
		expect(history.undo(at(''))).toBeNull();
	});

	test('forgets a change that was announced but never happened', () => {
		// A Backspace at the start of a field sends beforeinput with no input after it.
		const history = new FieldHistory();
		history.changed(at(''), at('abc'), 'insertText');
		history.willChange({ value: 'abc', start: 0, end: 0 }, 'deleteContentBackward');
		expect(history.undo(at('abc'))).toEqual(at(''));
		history.didChange(at(''));
		expect(history.redo(at(''))).toEqual(at('abc'));
		expect(history.undo(at('abc'))).toEqual(at(''));
	});

	test('records nothing for a change that leaves the field as it was', () => {
		const history = new FieldHistory();
		history.changed(at('a'), at('a'), 'insertText');
		expect(history.undo(at('a'))).toBeNull();
	});
});
