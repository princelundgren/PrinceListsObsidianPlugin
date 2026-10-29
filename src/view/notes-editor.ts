import { history } from '@codemirror/commands';
import { markdownLanguage } from '@codemirror/lang-markdown';
import { indentUnit } from '@codemirror/language';
import { Annotation, Compartment, EditorState, Transaction, type ChangeSpec, type Text } from '@codemirror/state';
import { EditorView, placeholder } from '@codemirror/view';
import { Notice } from 'obsidian';
import { checklistStatusAt } from '../core/checklist';
import { changedLines, type NotesChange } from '../core/notes-lines';
import { notesBoxClick } from './checklist';
import { targetOf } from './dom';
import { buildFormatBar } from './format';
import type { PrinceListView } from './list-view';
import { NOTES_DRAWN_CHECKBOX_SELECTOR } from './notes';
import { drawnBlocksField, NOTES_BLOCK_CLASS } from './notes-blocks';
import { notesDrawing } from './notes-drawing';
import { notesKeymap } from './notes-keys';
import type { NotesSource } from './notes-source';
import { UNSAFE_EDIT_NOTICE } from './write';

export const NOTES_CODEMIRROR_CLASS = 'princelists-notes-codemirror';

const isSync = Annotation.define<true>();
const historySlot = new Compartment();
const lockSlot = new Compartment();

// Each editor's sync, for the next redraw's source.
const resyncs = new WeakMap<EditorView, (source: NotesSource) => void>();

/**
 * Creates the notes editor in `area`, showing the notes as parsed, with the format bar under it; or,
 * for the editor already there, syncs it to `source`. Each change the editor makes is saved through
 * `source`, and one the list's layout can't take never lands.
 */
export function showNotesEditor(view: PrinceListView, source: NotesSource, area: HTMLElement): EditorView {
	const dom = area.querySelector<HTMLElement>(`.${NOTES_CODEMIRROR_CLASS}`);
	const existing = dom ? EditorView.findFromDOM(dom) : null;
	if (existing) {
		resyncs.get(existing)?.(source);
		return existing;
	}
	let current = source;
	// Step one's notice that the layout can't take a change shows once per visit.
	let warned = false;
	const openVisit = (): string | null => {
		warned = false;
		return current.open();
	};
	// The visit's own lines while one lasts; with focus and none, a new visit's; otherwise the notes as parsed.
	const sourceText = (editor: EditorView): string | null => {
		if (current.visitStart() !== null) return current.visitText();
		return editor.hasFocus ? openVisit() : (current.read()?.markdown ?? null);
	};
	const sync = (editor: EditorView): void => {
		const markdown = sourceText(editor);
		if (markdown !== null) syncNotesEditor(editor, markdown);
	};
	// A change can come without a focus event, as a drop from another app does: it opens the visit it
	// saves in, which ends with the change unless the editor has focus by then.
	let isVisitFromChange = false;
	const blocks = drawnBlocksField(view, view.sourcePath);
	const editor = new EditorView({
		parent: area,
		state: EditorState.create({
			doc: current.read()?.markdown ?? '',
			extensions: [
				historySlot.of(history()),
				lockSlot.of([]),
				markdownLanguage,
				indentUnit.of('\t'),
				notesKeymap(),
				blocks,
				notesDrawing(view, view.sourcePath, blocks),
				placeholder('Notes'),
				EditorView.lineWrapping,
				EditorView.editorAttributes.of({ class: NOTES_CODEMIRROR_CLASS }),
				// A textarea's defaults, which CodeMirror turns off.
				EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'on', autocapitalize: 'on', writingsuggestions: 'true' }),
				EditorState.changeFilter.of((tr) => {
					if (!tr.docChanged) return true;
					if (current.visitStart() === null) {
						isVisitFromChange = true;
						// The notes changed since the editor last showed them: the sync after the change shows them.
						if (openVisit() !== tr.startState.doc.toString()) {
							current.close();
							return false;
						}
					}
					const change = changedLines(tr.startState.doc.toString(), tr.newDoc.toString());
					if (!change || current.fits(change)) return true;
					if (!warned) new Notice(UNSAFE_EDIT_NOTICE);
					warned = true;
					return false;
				}),
				// From the DOM's own focus and blur, which come before any keystroke: CodeMirror's
				// focusChangeEffect can come after the first one.
				EditorView.domEventHandlers({
					focus: (_evt, editor) => sync(editor),
					blur: (_evt, editor) => {
						// Moving to another window or app keeps the visit, and focus comes back to it.
						if (!editor.dom.doc.hasFocus()) return;
						current.close();
						sync(editor);
					},
					// A drawn link follows on its click, through the view's own listener, as in Live Preview, and
					// a box ticks on its own: the caret stays where it was, and a phone's keyboard stays down. So
					// does a button that Obsidian's renderer draws in a block, such as a code block's copy button.
					// Elsewhere on a drawn block, the caret goes to its start, which shows its Markdown.
					mousedown: (evt, editor) => {
						const target = targetOf(evt);
						if (target?.closest(`a, button, ${NOTES_DRAWN_CHECKBOX_SELECTOR}`)) {
							evt.preventDefault();
							return true;
						}
						const block = target?.closest(`.${NOTES_BLOCK_CLASS}`);
						// Only the main button, as CodeMirror's own mouse selection.
						if (!block || evt.button !== 0) return false;
						evt.preventDefault();
						editor.dispatch({ selection: { anchor: editor.posAtDOM(block) } });
						editor.focus();
						return true;
					},
					// During a visit, a tick is the editor's own change, in its history, and changes only the
					// status, so the caret stays; outside one, it's the list's.
					click: (evt, editor) => {
						const box = targetOf(evt)?.closest<HTMLInputElement>(NOTES_DRAWN_CHECKBOX_SELECTOR);
						if (!box) return false;
						evt.preventDefault();
						const line = editor.state.doc.lineAt(editor.posAtDOM(box));
						const at = checklistStatusAt(line.text);
						if (at === null) return true;
						if (editor.hasFocus || current.visitStart() !== null) {
							const status = line.text[at] === ' ' ? 'x' : ' ';
							editor.dispatch({ changes: { from: line.from + at, to: line.from + at + 1, insert: status }, userEvent: 'input' });
						} else {
							notesBoxClick(view, current, editor.state.doc.toString(), line.number - 1);
						}
						return true;
					},
					// A file is never text in the notes: pictures go through the view's own listeners.
					paste: (evt) => !evt.clipboardData?.getData('text/plain') && (evt.clipboardData?.files.length ?? 0) > 0,
					drop: (evt) => (evt.dataTransfer?.files.length ?? 0) > 0,
				}),
			],
		}),
		// A save that is lost or refused syncs the editor, which an update listener can't do.
		dispatchTransactions: (trs, editor) => {
			editor.update(trs);
			const changes = trs.filter((tr) => tr.docChanged && !tr.annotation(isSync));
			for (const tr of changes) {
				const change = changedLines(tr.startState.doc.toString(), tr.state.doc.toString());
				if (!change) continue;
				const typed = current.save(change);
				view.handleTyped(typed);
				if ('edit' in typed) continue;
				sync(editor);
				break;
			}
			if (!isVisitFromChange) return;
			isVisitFromChange = false;
			if (!editor.hasFocus) current.close();
			sync(editor);
		},
	});
	resyncs.set(editor, (next) => {
		current = next;
		sync(editor);
	});
	buildFormatBar(editor.dom);
	return editor;
}

/**
 * Shows `markdown` in the editor, unless it already holds it, as a change its selection maps through.
 * A sync is never saved, and it clears the editor's history, so its undo never takes back a change
 * the editor didn't make.
 */
export function syncNotesEditor(editor: EditorView, markdown: string): void {
	const { doc } = editor.state;
	const change = changedLines(doc.toString(), markdown);
	if (!change) return;
	editor.dispatch({ changes: lineChange(doc, change), annotations: [isSync.of(true), Transaction.addToHistory.of(false)], filter: false });
	// Both in one transaction would leave the history in place.
	editor.dispatch({ effects: historySlot.reconfigure([]) });
	editor.dispatch({ effects: historySlot.reconfigure(history()) });
}

/** Takes no more typing: the notes' item is gone, and what the editor holds can only be copied. */
export function lockNotesEditor(editor: EditorView): void {
	editor.dispatch({ effects: lockSlot.reconfigure(EditorState.readOnly.of(true)) });
}

/**
 * Focuses the editor and adds `markdown` as a block of its own at the end of the notes, in place of
 * notes that are only blank, so it's saved as typing is. False when the notes didn't take it.
 */
export function appendNotesBlock(editor: EditorView, markdown: string): boolean {
	editor.focus();
	const { doc } = editor.state;
	const text = doc.toString();
	const from = text.trim() === '' ? 0 : doc.length;
	const gap = from === 0 || text.endsWith('\n\n') ? '' : text.endsWith('\n') ? '\n' : '\n\n';
	const insert = gap + markdown;
	editor.dispatch({ changes: { from, to: doc.length, insert }, selection: { anchor: from + insert.length }, userEvent: 'input.paste' });
	return editor.state.doc.toString() === text.slice(0, from) + insert;
}

// Lines [from, to) of `doc` become `change.lines`, as character positions.
function lineChange(doc: Text, { from, to, lines }: NotesChange): ChangeSpec {
	const insert = lines.join('\n');
	if (to > from && lines.length > 0) return { from: doc.line(from + 1).from, to: doc.line(to).to, insert };
	if (to > from) return to < doc.lines ? { from: doc.line(from + 1).from, to: doc.line(to + 1).from } : { from: doc.line(from).to, to: doc.length };
	return from < doc.lines ? { from: doc.line(from + 1).from, insert: insert + '\n' } : { from: doc.length, insert: '\n' + insert };
}
