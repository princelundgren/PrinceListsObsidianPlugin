// @vitest-environment jsdom
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, test } from 'vitest';
import { FIND_MARK_CLASS, notesFind, showNotesFind } from '../../src/view/notes-find';
import { findOf } from './find-helpers';

const editors: EditorView[] = [];
const notesEditor = (doc: string) => {
	const editor = new EditorView({ doc, extensions: [notesFind()], parent: document.body });
	editors.push(editor);
	return editor;
};
const shown = (editor: EditorView) => [...editor.contentDOM.querySelectorAll(`.${FIND_MARK_CLASS}`)].map((el) => el.textContent);

afterEach(() => {
	for (const editor of editors.splice(0)) editor.destroy();
});

describe('showNotesFind', () => {
	test('marks each word Find matches in the editor\'s text', () => {
		const editor = notesEditor('Pesto with basil');
		showNotesFind(editor, findOf('pesto'));
		expect(shown(editor)).toEqual(['Pesto']);
	});

	test('marks the new words when the query changes', () => {
		const editor = notesEditor('Pesto with basil');
		showNotesFind(editor, findOf('pesto'));
		showNotesFind(editor, findOf('basil'));
		expect(shown(editor)).toEqual(['basil']);
	});

	test('takes the marks away when Find is emptied', () => {
		const editor = notesEditor('Pesto with basil');
		showNotesFind(editor, findOf('pesto'));
		showNotesFind(editor, null);
		expect(shown(editor)).toEqual([]);
	});

	test('changes nothing for the same query again, as a redraw gives it', () => {
		const editor = notesEditor('Pesto with basil');
		showNotesFind(editor, findOf('pesto'));
		const state = editor.state;
		showNotesFind(editor, findOf('pesto'));
		expect(editor.state).toBe(state);
	});
});
