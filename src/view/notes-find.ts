import { StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import type { Find } from '../core/display';
import { findSpans } from '../core/find-spans';

/** The class of a mark over a word Find matches in the notes editor; `styles.css` gives its color. */
export const FIND_MARK_CLASS = 'princelists-find-match';
const FIND_MARK = Decoration.mark({ class: FIND_MARK_CLASS });

/** Gives the notes editor Find's query, or null while Find holds no text. */
export const notesFindEffect = StateEffect.define<Find | null>();

interface NotesFind {
	find: Find | null;
	marks: DecorationSet;
}

const notesFindField = StateField.define<NotesFind>({
	create: () => ({ find: null, marks: Decoration.none }),
	update(value, tr) {
		let find = value.find;
		for (const effect of tr.effects) if (effect.is(notesFindEffect)) find = effect.value;
		if (find === value.find && !tr.docChanged) return value;
		return { find, marks: marksOf(tr.state, find) };
	},
	provide: (field) => EditorView.decorations.from(field, (value) => value.marks),
});

/** Marks each word Find matches in the notes, once `showNotesFind` gives the editor the query. */
export function notesFind(): Extension {
	return notesFindField;
}

/** Gives `editor`, a notes editor, Find's query, unless it already has one with the same text. */
export function showNotesFind(editor: EditorView, find: Find | null): void {
	if (editor.state.field(notesFindField).find?.text === find?.text) return;
	editor.dispatch({ effects: notesFindEffect.of(find) });
}

function marksOf(state: EditorState, find: Find | null): DecorationSet {
	if (!find) return Decoration.none;
	return Decoration.set(findSpans(state.doc.toString(), find.words).map(([from, to]) => FIND_MARK.range(from, to)));
}
