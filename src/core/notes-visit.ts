import { UnsafeEditError } from './edit-check';
import { notesStartLine } from './edit-items';
import type { RunEdit } from './follow';
import type { Line } from './lines';
import { saveItemNotesLines, saveListNoteLines, spanLines, type NotesChange, type NotesSpan } from './notes-lines';
import { isBlank, type ItemBlock, type ListModel } from './parse';

/** A visit to a card's notes or to the list note, while its editor has focus. */
export interface NotesVisit {
	notes: 'item' | 'listNote';
	piece: NotesSpan;
	refused: boolean;
	visit: true;
}

/** A save in a visit: where its edit starts and of what kind, and for the list note the whole note. */
export interface VisitSave {
	lines: Line[];
	span: NotesSpan;
	start: number;
	kind: RunEdit['kind'];
	note: string | null;
}

/**
 * A visit over the notes as parsed: a card's from notesStartLine, the list note's from its first line
 * with text. `item` is the card's item, or null for the list note. A card's empty notes start under
 * the title, where their first text writes the empty line that keeps it a block of its own.
 */
export function openVisit(lines: readonly Line[], model: ListModel, item: ItemBlock | null): NotesVisit {
	if (item) {
		const start = notesStartLine(lines, item);
		const span = { range: { start, end: item.endLine }, indent: item.notesIndent, separator: start === item.endLine, blankAfter: false };
		return { notes: 'item', piece: span, refused: false, visit: true };
	}
	const { end } = model.listNote;
	let start = model.listNote.start;
	while (start < end && isBlank((lines[start] as Line).text)) start++;
	return { notes: 'listNote', piece: { range: { start, end }, indent: '', separator: false, blankAfter: false }, refused: false, visit: true };
}

/** The visit's notes as its editor holds them. */
export function visitText(lines: readonly Line[], visit: NotesVisit): string {
	return spanLines(lines, visit.piece).join('\n');
}

/**
 * Saves `change` in the visit, without keeping it: `item` is the card's item, or null for the list
 * note. Throws UnsafeEditError when the list's layout can't take it.
 */
export function saveInVisit(lines: readonly Line[], model: ListModel, item: ItemBlock | null, visit: NotesVisit, change: NotesChange): VisitSave {
	if (item) return { ...saveItemNotesLines(lines, model, item, visit.piece, change), start: item.titleLine, kind: 'change', note: null };
	const saved = saveListNoteLines(lines, model, visit.piece, change);
	// As typeListNote's: from the line above the lines it wrote, or before whatever is at their start.
	const isAbove = saved.from > model.contentStart;
	return { lines: saved.lines, span: saved.span, start: isAbove ? saved.from - 1 : saved.from, kind: isAbove ? 'change' : 'insert', note: saved.note };
}

/** Whether the visit's notes can take `change`, by saving it without keeping it. */
export function fitsInVisit(lines: readonly Line[], model: ListModel, item: ItemBlock | null, visit: NotesVisit, change: NotesChange): boolean {
	try {
		saveInVisit(lines, model, item, visit, change);
		return true;
	} catch (error) {
		if (!(error instanceof UnsafeEditError)) throw error;
		return false;
	}
}
