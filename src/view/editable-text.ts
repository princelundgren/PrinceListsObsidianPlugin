import { selectAll } from '@codemirror/commands';
import type { EditorView } from '@codemirror/view';
import type { Format } from '../core/format';
import { changeField } from './field-undo';
import { applyFormat } from './format';
import type { PrinceListView } from './list-view';
import { runNotesBarAction } from './notes-keys';
import { pastePictures } from './pictures';

/** The card's title, or notes, a card's or the list's, as the right-click menu and the format bar's links edit them. */
export interface EditableText {
	readonly isReadOnly: boolean;
	/** The notes take list formats; a title is one line of an item. */
	readonly takesLists: boolean;
	selectedText(): string;
	/** Returns a function that puts back the selection as it is now, for an action that takes focus away first. */
	holdSelection(): () => void;
	/** Replaces the selection as typing would: one undo step, saved as the field saves its typing. */
	replaceSelection(text: string): void;
	/** Adds the pictures to the notes, as a paste would; the title takes none. */
	pastePictures(pictures: File[]): void;
	selectAll(): void;
	format(format: Format): void;
	focus(): void;
}

export function notesText(view: PrinceListView, editor: EditorView): EditableText {
	return {
		isReadOnly: editor.state.readOnly,
		takesLists: true,
		selectedText: () => editor.state.sliceDoc(editor.state.selection.main.from, editor.state.selection.main.to),
		// The editor keeps its selection while it has no focus, mapped through any change.
		holdSelection: () => () => undefined,
		replaceSelection: (insert) => editor.dispatch(editor.state.replaceSelection(insert), { userEvent: insert ? 'input.paste' : 'delete.cut' }),
		pastePictures: (pictures) => {
			pastePictures(view, pictures);
		},
		selectAll: () => selectAll(editor),
		format: (format) => runNotesBarAction(editor, format),
		focus: () => editor.focus(),
	};
}

export function fieldText(field: HTMLTextAreaElement): EditableText {
	return {
		isReadOnly: field.readOnly,
		takesLists: false,
		selectedText: () => field.value.slice(field.selectionStart, field.selectionEnd),
		holdSelection: () => {
			const { selectionStart, selectionEnd } = field;
			return () => field.setSelectionRange(selectionStart, selectionEnd);
		},
		replaceSelection: (insert) => {
			changeField(field, () => field.setRangeText(insert, field.selectionStart, field.selectionEnd, 'end'));
			// setRangeText sends no input event, and the view saves a field's text from that event.
			field.dispatchEvent(new Event('input', { bubbles: true }));
		},
		pastePictures: () => undefined,
		selectAll: () => field.select(),
		format: (format) => applyFormat(field, format),
		focus: () => field.focus(),
	};
}
