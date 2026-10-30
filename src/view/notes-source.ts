import { getItemNotes, notesStartLine } from '../core/edit-items';
import { listNoteStartLine } from '../core/edit-list-note';
import type { Typed } from '../core/editing';
import type { NotesChange } from '../core/notes-lines';
import type { NotesVisit } from '../core/notes-visit';
import { itemAt } from '../core/parse';
import type { Card } from './card';
import { closeListNote, visitListNote, warnListNote } from './fields';
import type { PrinceListView } from './list-view';

/** The notes an editor holds: the open card's, or the list note. */
export interface NotesSource {
	kind: NotesVisit['notes'];
	/** The notes as parsed, without their indent, and their first line; null once they're gone. */
	read(): { markdown: string; start: number } | null;
	/** Starts a visit to the notes and returns their text, or null once they're gone. */
	open(): string | null;
	/** The visit's own lines as the editor holds them, or null outside a visit. */
	visitText(): string | null;
	/** The file line of the visit's first editor line, or null outside a visit. */
	visitStart(): number | null;
	/** Whether the visit's notes can take `change`. It changes nothing. */
	fits(change: NotesChange): boolean;
	/** Saves `change` to the visit's notes. */
	save(change: NotesChange): Typed;
	/** Ends the visit, with focus going to `focusing`, which a redraw keeps in place. */
	close(focusing: Element | null): void;
}

export function cardNotesSource(view: PrinceListView, card: Card): NotesSource {
	return {
		kind: 'item',
		read: () => {
			const { lines, model } = view.parse();
			const item = card.lostAt === null && view.selected !== null ? itemAt(model, view.selected) : undefined;
			return item ? { markdown: getItemNotes(lines, item), start: notesStartLine(lines, item) } : null;
		},
		open: () => view.editing.openNotes('item'),
		visitText: () => view.editing.visitText(),
		visitStart: () => view.editing.notesPieceRange()?.start ?? null,
		fits: (change) => view.editing.notesChangeFits(change),
		save: (change) => view.editing.saveNotes(change),
		close: () => view.editing.closeNotes(),
	};
}

/**
 * The list note, from its first line with text. A save shows the note's warnings, and leaving it draws
 * the whole list again once one showed (closeListNote).
 */
export function listNoteSource(view: PrinceListView): NotesSource {
	return {
		kind: 'listNote',
		read: () => {
			const { lines, model } = view.parse();
			const start = listNoteStartLine(lines, model);
			const markdown = lines
				.slice(start, model.listNote.end)
				.map((line) => line.text)
				.join('\n');
			return { markdown, start };
		},
		open: () => visitListNote(view),
		visitText: () => view.editing.visitText(),
		visitStart: () => view.editing.listNoteRange()?.start ?? null,
		fits: (change) => view.editing.notesChangeFits(change),
		save: (change) => {
			const typed = view.editing.saveListNote(change);
			if (!('edit' in typed)) return typed;
			warnListNote(view, typed.note);
			return { edit: typed.edit };
		},
		close: (focusing) => closeListNote(view, focusing),
	};
}
