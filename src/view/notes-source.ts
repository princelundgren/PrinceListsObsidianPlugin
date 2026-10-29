import { getItemNotes, notesStartLine } from '../core/edit-items';
import type { Typed } from '../core/editing';
import type { NotesChange } from '../core/notes-lines';
import type { NotesVisit } from '../core/notes-visit';
import { itemAt } from '../core/parse';
import type { Card } from './card';
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
	/** Ends the visit. */
	close(): void;
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
