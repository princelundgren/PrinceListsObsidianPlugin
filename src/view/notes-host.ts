import type { Component } from 'obsidian';
import { listNoteChecklist, type ChecklistLine } from '../core/checklist';
import { getListNote } from '../core/edit-list-note';
import type { Typed } from '../core/editing';
import type { LineRange } from '../core/follow';
import { closeListNote, LIST_NOTE_AREA_CLASS, openListNote, warnListNote } from './fields';
import type { PrinceListView } from './list-view';
import type { Notes } from './note-piece-state';

/** Notes drawn a piece at a time, one piece open in a field: the list note. */
export interface NotesHost {
	/** The element the pieces are drawn in. */
	area: HTMLElement;
	/** Whose notes these are: the open card's item, or the list note. */
	kind: 'card' | 'listNote';
	/** The notes as they read now, with the checklist lines their boxes tick; null once they're gone. */
	notes(): { notes: Notes; checklist: ChecklistLine[] | null } | null;
	/** The lines the open piece writes, while one is open. */
	range(): LineRange | null;
	/** Opens the piece at `range`, as ListEditing's openNotesPiece does, and returns its text. */
	open(range: LineRange, isNew: boolean, indent?: string): string | null;
	outdent(text: string): string | null;
	type(markdown: string): Typed;
	/** Ends the session once its last field has lost focus to `focusing`. */
	close(focusing: Element | null): void;
	/** Keeps the drawn notes' Component, unloading the one it replaces. */
	keep(drawn: Component): void;
}

/** The list note's notes when `el` is in them, or null. */
export function notesHostOf(view: PrinceListView, el: Element): NotesHost | null {
	const noteArea = el.closest<HTMLElement>(`.${LIST_NOTE_AREA_CLASS}`);
	if (noteArea && view.listNoteEl?.contains(noteArea)) return listNoteHost(view, noteArea);
	return null;
}

export function listNoteHost(view: PrinceListView, area: HTMLElement): NotesHost {
	return {
		area,
		kind: 'listNote',
		notes: () => {
			const { lines, model } = view.parse();
			return { notes: { markdown: getListNote(lines, model), start: model.listNote.start }, checklist: listNoteChecklist(lines, model) };
		},
		range: () => view.editing.listNoteRange(),
		open: (range, isNew, indent) => openListNote(view, range, isNew, indent),
		outdent: (text) => view.editing.listNoteOutdent(text),
		type: (markdown) => {
			const typed = view.editing.typeListNote(markdown);
			if ('edit' in typed) warnListNote(view, typed.note);
			return typed;
		},
		close: (focusing) => closeListNote(view, focusing),
		keep: (drawn) => {
			if (view.listNoteNotes && view.listNoteNotes !== drawn) view.removeChild(view.listNoteNotes);
			view.listNoteNotes = drawn;
		},
	};
}
