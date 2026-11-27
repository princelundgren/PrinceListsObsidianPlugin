import { EditorState } from '@codemirror/state';
import { EditorView, type DecorationSet } from '@codemirror/view';
import { describe, expect, test } from 'vitest';
import { FIND_MARK_CLASS, notesFind, notesFindEffect } from '../../src/view/notes-find';
import { findOf } from './find-helpers';

// The marked spans, as [from, to, class].
function marks(state: EditorState): [number, number, string][] {
	const out: [number, number, string][] = [];
	for (const source of state.facet(EditorView.decorations)) {
		const set = source as DecorationSet;
		set.between(0, state.doc.length, (from, to, value) => {
			out.push([from, to, (value.spec as { class: string }).class]);
		});
	}
	return out;
}

const notes = (doc: string) => EditorState.create({ doc, extensions: [notesFind()] });

describe('notesFind', () => {
	test('marks nothing until Find holds text', () => {
		expect(marks(notes('Pesto and pesto'))).toEqual([]);
	});

	test('marks every place each word appears', () => {
		const state = notes('Pesto with basil\nmore pesto').update({ effects: notesFindEffect.of(findOf('pesto basil')) }).state;
		expect(marks(state)).toEqual([
			[0, 5, FIND_MARK_CLASS],
			[11, 16, FIND_MARK_CLASS],
			[22, 27, FIND_MARK_CLASS],
		]);
	});

	test('marks a word typed after Find got its text', () => {
		const found = notes('basil').update({ effects: notesFindEffect.of(findOf('pesto')) }).state;
		const typed = found.update({ changes: { from: 5, insert: ' pesto' } }).state;
		expect(marks(typed)).toEqual([[6, 11, FIND_MARK_CLASS]]);
	});

	test('takes every mark away once Find is emptied', () => {
		const found = notes('pesto').update({ effects: notesFindEffect.of(findOf('pesto')) }).state;
		expect(marks(found.update({ effects: notesFindEffect.of(null) }).state)).toEqual([]);
	});
});
