import { defaultKeymap, historyKeymap, indentLess, indentMore, redo, undo } from '@codemirror/commands';
import { deleteMarkupBackward, insertNewlineContinueMarkupCommand } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import type { EditorState, Extension, SelectionRange } from '@codemirror/state';
import { keymap, type Command, type EditorView } from '@codemirror/view';
import { formatSelection, type Format } from '../core/format';
import type { BarAction } from './format';

// Cmd+Enter stays the list's add, and Escape the view's, which closes the card; only Tab indents.
const LIST_KEYS = new Set(['Mod-Enter', 'Escape', 'Mod-[', 'Mod-]']);

/** The notes editor's keys, then CodeMirror's history and default keys without the list's. */
export function notesKeymap(): Extension {
	return keymap.of([
		{ key: 'Enter', run: insertNewlineContinueMarkupCommand({ nonTightLists: false }) },
		{ key: 'Backspace', run: deleteMarkupBackward },
		// historyKeymap binds it only on macOS and Linux.
		{ key: 'Mod-Shift-z', run: redo, preventDefault: true },
		// On other lines Tab leaves the editor, as from any field.
		{ key: 'Tab', run: onListItems(indentMore), shift: onListItems(indentLess) },
		{ key: 'Mod-b', run: formatCommand('bold') },
		{ key: 'Mod-i', run: formatCommand('italic') },
		{ key: 'Mod-k', run: formatCommand('link') },
		...historyKeymap,
		...defaultKeymap.filter((binding) => binding.key === undefined || !LIST_KEYS.has(binding.key)),
	]);
}

/** Runs a format bar button in the editor: Undo and Redo through its history, the rest as the keys do. */
export function runNotesBarAction(editor: EditorView, action: BarAction): void {
	if (action === 'undo') undo(editor);
	else if (action === 'redo') redo(editor);
	else applyNotesFormat(editor, action);
}

function formatCommand(format: Format): Command {
	return (editor) => {
		applyNotesFormat(editor, format);
		return true;
	};
}

// One change, as typing it would be.
function applyNotesFormat(editor: EditorView, format: Format): void {
	const { state } = editor;
	if (state.readOnly) return;
	const { from, to } = state.selection.main;
	const edit = formatSelection(state.doc.toString(), from, to, format);
	editor.dispatch({
		changes: { from: edit.from, to: edit.to, insert: edit.insert },
		selection: { anchor: edit.selectionStart, head: edit.selectionEnd },
		userEvent: 'input.format',
	});
}

function onListItems(command: Command): Command {
	return (editor) => editor.state.selection.ranges.every((range) => isOnListItems(editor.state, range)) && command(editor);
}

// Every line the range is on starts with a list marker. A range ending at the start of a line leaves
// that line out, as indentMore does.
function isOnListItems(state: EditorState, range: SelectionRange): boolean {
	const tree = syntaxTree(state);
	const first = state.doc.lineAt(range.from).number;
	const last = state.doc.lineAt(range.empty ? range.to : range.to - 1).number;
	for (let number = first; number <= last; number++) {
		const line = state.doc.line(number);
		const indent = line.text.length - line.text.trimStart().length;
		if (tree.resolveInner(line.from + indent, 1).name !== 'ListMark') return false;
	}
	return true;
}
