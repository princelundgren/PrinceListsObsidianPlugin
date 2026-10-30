import { normalizePath, Notice, type TFile } from 'obsidian';
import { getListNote, listNoteUnclosedBlock, listNoteWouldRestructure } from '../core/edit-list-note';
import { nameTaken } from '../core/file-name';
import type { LineRange } from '../core/follow';
import { oneLineTitle } from '../core/title-field';
import { fitHeight } from './dom';
import type { PrinceListView } from './list-view';
import { showNotesEditor } from './notes-editor';
import { listNoteSource } from './notes-source';

export const TITLE_CLASS = 'princelists-title';
export const NOTE_CLASS = 'princelists-list-note';
// Where the list note's pieces are drawn, apart from its warnings.
export const LIST_NOTE_AREA_CLASS = 'princelists-list-note-text';
// Every textarea in the view, which styles.css makes read as the text it edits.
export const FIELD_CLASS = 'princelists-field';

/** The list title while it has focus: the file it renames and the name it showed then. */
export interface ListTitleSession {
	file: TFile;
	before: string;
}

/** The list note while it is being edited. */
export interface ListNoteSession {
	warnings: { restructure: HTMLElement; unclosed: HTMLElement };
	/** Whether a warning showed while it was open, so the list may now parse differently. */
	warned: boolean;
}

export function buildListTitle(view: PrinceListView, parent: HTMLElement): HTMLTextAreaElement {
	const field = parent.createEl('textarea', {
		cls: [FIELD_CLASS, TITLE_CLASS],
		attr: { rows: 1, spellcheck: 'false', placeholder: 'List title' },
	});
	field.value = view.file?.basename ?? '';
	return field;
}

// The field took focus: what it renames, and the name to compare with when it loses focus. Focus that
// comes back from another window finds the session still open, and keeps it.
export function beginListTitle(view: PrinceListView, field: HTMLTextAreaElement): void {
	if (view.listTitle) return;
	view.listTitle = view.file ? { file: view.file, before: field.value } : null;
}

// A file name is one line, as a title is.
export function keepOneLine(field: HTMLTextAreaElement): void {
	const oneLine = oneLineTitle(field.value);
	if (oneLine !== field.value) {
		const { selectionStart, selectionEnd } = field;
		// A textarea's value has only \n line breaks, so the replacement keeps every offset.
		field.value = oneLine;
		field.setSelectionRange(selectionStart, selectionEnd);
	}
	fitHeight(field);
}

// On Enter or when the field loses focus, not on every keystroke (spec, "Editing"). A name the user
// didn't change isn't written back, so a rename from elsewhere while the field had focus stands. The
// rename waits on the view's write queue, so the first item Enter adds to an empty list lands after it.
export function commitListTitle(view: PrinceListView, field: HTMLTextAreaElement): void {
	const session = view.listTitle;
	view.listTitle = null;
	if (session && session.file === view.file && field.value !== session.before) {
		const typed = field.value;
		void view.enqueue(() => renameList(view, session.file, field, typed));
	} else if (view.file) {
		field.value = view.file.basename;
	}
}

async function renameList(view: PrinceListView, file: TFile, field: HTMLTextAreaElement, typed: string): Promise<void> {
	// Like any queued action, moot once the view closed or shows another file.
	if (view.viewClosed || view.file !== file) return;
	const name = oneLineTitle(typed).trim();
	const keepName = (notice?: string) => {
		if (notice) new Notice(notice);
		if (view.file === file) field.value = file.basename;
	};
	if (name === '') return keepName();
	// A separator would move the list into another folder rather than rename it.
	if (/[\\/]/.test(name)) return keepName("A list name can't contain / or \\.");
	// Only the name is normalized: an outside note's path isn't a vault path. The current name is too,
	// so retyping it doesn't rename a file whose name is in another Unicode form.
	const fileName = normalizePath(`${name}.${file.extension}`);
	if (fileName === normalizePath(file.name)) return keepName();
	// In the list's own folder, which keeps a note from outside the vault where it is (spec, "Notes
	// outside the vault").
	const path = `${file.path.slice(0, file.path.length - file.name.length)}${fileName}`;
	if (isTaken(view, file, fileName, path)) return keepName('A note with that name already exists.');
	try {
		// Updates links as the user's settings say. The view's title follows through onRename.
		await view.app.fileManager.renameFile(file, path);
	} catch (error) {
		console.error(error);
		keepName("The list couldn't be renamed.");
	}
}

// Another note in the list's folder has the name. A note outside the vault has no parent (observed in
// 1.14.4), so for one, only a file Obsidian finds at that exact path counts.
function isTaken(view: PrinceListView, file: TFile, fileName: string, path: string): boolean {
	if (file.parent) return nameTaken(file.parent.children.map((child) => child.name), file.name, fileName);
	const other = view.app.vault.getAbstractFileByPath(path);
	return other !== null && other !== file;
}

// The list note's editor, with its warnings under it while it is being edited.
export function buildListNote(view: PrinceListView, parent: HTMLElement): HTMLElement {
	const el = parent.createDiv({ cls: NOTE_CLASS });
	view.listNoteEditor = showNotesEditor(view, listNoteSource(view), el);
	return el;
}

// After a redraw, which keeps the list note: its editor syncs to the note.
export function refreshListNote(view: PrinceListView): void {
	if (view.listNoteEl) view.listNoteEditor = showNotesEditor(view, listNoteSource(view), view.listNoteEl);
}

/** Starts a visit to the list note, as ListEditing's openNotes does, with the note's warnings. */
export function visitListNote(view: PrinceListView): string | null {
	beginListNote(view);
	const text = view.editing.openNotes('listNote');
	const { lines, model } = view.parse();
	warnListNote(view, getListNote(lines, model));
	return text;
}

/** Opens one piece of the list note, as ListEditing's openListNote does, with the note's warnings. */
export function openListNote(view: PrinceListView, range: LineRange, isNew: boolean, indent?: string): string {
	const text = view.editing.openListNote(range, isNew, indent);
	beginListNote(view);
	warnListNote(view, view.editing.listNoteAsTyped(text));
	return text;
}

function beginListNote(view: PrinceListView): void {
	const el = view.listNoteEl;
	if (view.listNote || !el) return;
	const warning = (text: string) => el.createDiv({ cls: 'princelists-field-warning', text });
	const warnings = {
		restructure: warning('A heading or checkbox line here becomes a section or item when saved.'),
		unclosed: warning('An unclosed block here hides the items below it.'),
	};
	view.listNote = { warnings, warned: false };
}

// After a warning the note's lines may have become sections or items, or hidden the ones below, and a
// redraw while it was open held back rows inside it, so then the whole list is drawn again, keeping
// `focusing`, where focus is going.
export function closeListNote(view: PrinceListView, focusing: Element | null): void {
	const session = view.listNote;
	view.endListNote();
	if (!session) return;
	session.warnings.restructure.remove();
	session.warnings.unclosed.remove();
	if (session.warned || view.rowsHeldBack) view.render(focusing);
}

// Checked on the whole note as saved, or as it reads with a piece just opened. While either shows,
// the note still saves, so typing is never lost (spec, "The list note").
export function warnListNote(view: PrinceListView, note: string | null): void {
	const session = view.listNote;
	if (!session || note === null) return;
	const restructure = listNoteWouldRestructure(note);
	const unclosed = listNoteUnclosedBlock(note);
	session.warnings.restructure.toggle(restructure);
	session.warnings.unclosed.toggle(unclosed);
	session.warned ||= restructure || unclosed;
}
