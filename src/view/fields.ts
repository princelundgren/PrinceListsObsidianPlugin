import { Notice, type TFile } from 'obsidian';
import { getListNote, listNoteUnclosedBlock, listNoteWouldRestructure } from '../core/edit-list-note';
import { nameTaken } from '../core/file-name';
import type { Line } from '../core/lines';
import type { ListModel } from '../core/parse';
import { oneLineTitle } from '../core/title-field';
import { fitHeight } from './dom';
import type { PrinceListView } from './list-view';
import { renderNotes } from './notes';

export const TITLE_CLASS = 'princelists-title';
export const NOTE_CLASS = 'princelists-list-note';
export const NOTE_EDITOR_CLASS = 'princelists-list-note-editor';
// Every textarea in the view, which styles.css makes read as the text it edits.
export const FIELD_CLASS = 'princelists-field';

/** The list title while it has focus: the file it renames and the name it showed then. */
export interface ListTitleSession {
	file: TFile;
	before: string;
}

export interface ListNoteSession {
	editor: HTMLTextAreaElement;
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
	if (name === '' || name === file.basename) return keepName();
	// A separator would move the list into another folder rather than rename it.
	if (/[\\/]/.test(name)) return keepName("A list name can't contain / or \\.");
	// In the list's own folder, which keeps a note from outside the vault where it is (spec, "Notes
	// outside the vault").
	const fileName = `${name}.${file.extension}`;
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

// The list note as rendered Markdown, or, while it is empty, a gray "Notes" to click to add one.
export function buildListNote(view: PrinceListView, parent: HTMLElement, lines: readonly Line[], model: ListModel): HTMLElement {
	const area = parent.createDiv({ cls: NOTE_CLASS });
	const note = getListNote(lines, model);
	if (note === '') area.createDiv({ cls: 'princelists-placeholder', text: 'Notes' });
	else view.blocks.set(area, renderNotes(view, area.createDiv({ cls: 'princelists-list-note-text' }), note));
	return area;
}

export function openListNote(view: PrinceListView): void {
	const area = view.listNoteEl;
	if (!area || view.listNote) return;
	view.dropBlock(area);
	area.empty();
	const editor = area.createEl('textarea', {
		cls: [FIELD_CLASS, NOTE_EDITOR_CLASS],
		attr: { placeholder: 'Notes' },
	});
	editor.value = view.editing.openListNote();
	const warnings = {
		restructure: area.createDiv({
			cls: 'princelists-field-warning',
			text: 'A heading or checkbox line here becomes a section or item when saved.',
		}),
		unclosed: area.createDiv({ cls: 'princelists-field-warning', text: 'An unclosed block here hides the items below it.' }),
	};
	view.listNote = { editor, warnings, warned: false };
	showWarnings(view.listNote);
	editor.focus();
	fitHeight(editor);
}

export function typeListNote(view: PrinceListView): void {
	const session = view.listNote;
	if (!session) return;
	fitHeight(session.editor);
	showWarnings(session);
	view.handleTyped(view.editing.typeListNote(session.editor.value));
}

// After a warning the note's lines may have become sections or items, or hidden the ones below, and a
// redraw while it was open held back rows inside it, so then the whole list is drawn again, keeping
// `focusing`, where focus is going. Otherwise only the note is.
export function closeListNote(view: PrinceListView, focusing: Element | null): void {
	const session = view.listNote;
	const area = view.listNoteEl;
	if (!session || !area) return;
	view.listNote = null;
	view.editing.closeListNote();
	if (session.warned || view.rowsHeldBack) {
		view.render(focusing);
		return;
	}
	const { lines, model } = view.parse();
	view.listNoteEl = buildListNote(view, createDiv(), lines, model);
	area.replaceWith(view.listNoteEl);
}

// An outside change moved the note's lines so the field can't tell where they are.
export function rereadListNote(view: PrinceListView, text: string): void {
	const session = view.listNote;
	if (!session) return;
	session.editor.value = text;
	fitHeight(session.editor);
	showWarnings(session);
}

// While either shows, the note still saves, so typing is never lost (spec, "The list note").
function showWarnings(session: ListNoteSession): void {
	const markdown = session.editor.value;
	const restructure = listNoteWouldRestructure(markdown);
	const unclosed = listNoteUnclosedBlock(markdown);
	session.warnings.restructure.toggle(restructure);
	session.warnings.unclosed.toggle(unclosed);
	session.warned ||= restructure || unclosed;
}
