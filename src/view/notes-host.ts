import type { Component } from 'obsidian';
import { checklistOf, listNoteChecklist, type ChecklistLine } from '../core/checklist';
import { getItemNotes, notesStartLine } from '../core/edit-items';
import { getListNote } from '../core/edit-list-note';
import type { Typed } from '../core/editing';
import type { LineRange } from '../core/follow';
import { itemAt } from '../core/parse';
import { CARD_NOTES_CLASS, type Card } from './card';
import { closeListNote, LIST_NOTE_AREA_CLASS, openListNote, warnListNote } from './fields';
import type { PrinceListView } from './list-view';
import type { Notes } from './note-piece-state';

/** Notes drawn a piece at a time, one piece open in a field: the open card's, or the list note. */
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

/** The notes `el` is in, or null when it is in neither the open card's nor the list note. */
export function notesHostOf(view: PrinceListView, el: Element): NotesHost | null {
	const card = view.card;
	const cardArea = el.closest<HTMLElement>(`.${CARD_NOTES_CLASS}`);
	if (card && cardArea && card.el.contains(cardArea)) return cardNotesHost(view, card, cardArea);
	const noteArea = el.closest<HTMLElement>(`.${LIST_NOTE_AREA_CLASS}`);
	if (noteArea && view.listNoteEl?.contains(noteArea)) return listNoteHost(view, noteArea);
	return null;
}

export function cardNotesHost(view: PrinceListView, card: Card, area: HTMLElement): NotesHost {
	return {
		area,
		kind: 'card',
		notes: () => {
			const { lines, model } = view.parse();
			const item = card.lostAt === null && view.selected !== null ? itemAt(model, view.selected) : undefined;
			if (!item) return null;
			return { notes: { markdown: getItemNotes(lines, item), start: notesStartLine(lines, item) }, checklist: checklistOf(lines, item) };
		},
		range: () => view.editing.notesPieceRange(),
		open: (range, isNew, indent) => view.editing.openNotesPiece(range, isNew, indent),
		outdent: (text) => view.editing.notesPieceOutdent(text),
		type: (markdown) => view.editing.typeNotesPiece(markdown),
		close: () => view.editing.closeNotes(),
		keep: (drawn) => {
			if (card.notes && card.notes !== drawn) view.removeChild(card.notes);
			card.notes = drawn;
		},
	};
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
