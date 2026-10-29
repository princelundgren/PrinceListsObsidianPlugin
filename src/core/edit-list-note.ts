import { blockKeys, modelBlockKeys, replaceRun } from './edit-check';
import { isBlankAt, typedLines, withoutSeparatorLine } from './edit-lines';
import type { PieceSession } from './edit-piece';
import { dominantEol, spliceLines, splitLines, type Line } from './lines';
import { isBlank, maskBlocks, parseList, type ListModel } from './parse';

export function getListNote(lines: readonly Line[], model: ListModel): string {
	const { start, end } = model.listNote;
	return lines
		.slice(start, end)
		.map((line) => line.text)
		.join('\n');
}

/**
 * One open piece of the list note. `blankAfter`: the line under it is the blank line its last save
 * wrote, which goes again while it is still blank and the piece is erased.
 */
export interface ListNotePiece extends PieceSession {
	blankAfter: boolean;
}

// As setNotesPiece, with the list note's own rules (spec, "The list note"). The caller passes the
// range the previous save wrote, followed through outside changes: re-parsing can't stand in for it,
// since a note that opens a block, or turns a line into a setext underline, changes where the parse
// ends the list note. A range that isn't in these lines throws for the same reason. It returns the
// whole note as saved, which the note's warnings check.
export function setListNotePiece(
	lines: readonly Line[],
	model: ListModel,
	piece: ListNotePiece,
	typed: string,
): { lines: Line[]; piece: ListNotePiece; note: string } {
	const { range } = piece;
	if (!(model.contentStart <= range.start && range.start <= range.end && range.end <= lines.length)) {
		throw new Error('The list note piece is not in these lines; open it again from the model');
	}
	const save = planSave(lines, model, piece, typed);
	const next = { ...piece, range: save.written, blankAfter: save.writesBlank };
	const replaced = lines.slice(range.start, range.end).map((line) => line.text).join('\n');
	const edited = replaceListNoteRun(lines, model, save.from, save.to, save.run, save.note, [typed, replaced]);
	return { lines: edited, piece: next, note: noteText(save.note.after) };
}

/** The whole list note as it reads once `typed` is saved in the piece, which its warnings check. */
export function listNoteWithPiece(lines: readonly Line[], model: ListModel, piece: ListNotePiece, typed: string): string {
	return noteText(planSave(lines, model, piece, typed).note.after);
}

/** The list note's lines before and after lines [from, to) become `run`, up to the end of both. */
export function listNoteAround(
	lines: readonly Line[],
	model: ListModel,
	from: number,
	to: number,
	run: readonly Line[],
): { before: Line[]; after: Line[] } {
	const noteEnd = Math.max(model.listNote.end, to);
	return {
		before: lines.slice(model.listNote.start, noteEnd),
		after: [...lines.slice(model.listNote.start, from), ...run, ...lines.slice(to, noteEnd)],
	};
}

/**
 * Writes `run` in place of lines [from, to) of the list note, which reads `note` before and after,
 * through replaceRun's check. Throws UnsafeEditError as replaceRun does.
 */
export function replaceListNoteRun(
	lines: readonly Line[],
	model: ListModel,
	from: number,
	to: number,
	run: Line[],
	note: { before: readonly Line[]; after: readonly Line[] },
	pieces: readonly string[] = [],
): Line[] {
	// The owner's exception: while the note, as saved or as it was, or a piece of it leaves a block
	// open, what follows is hidden or reads differently, so the run saves without the check. Only the
	// run's lines change, so closing the block brings back what follows as it was.
	if ([...pieces, joinTexts(note.before), joinTexts(note.after)].some(listNoteUnclosedBlock)) {
		return spliceLines(lines, from, to - from, run);
	}
	const noteEnd = model.listNote.start + note.before.length;
	const noteBlocks = modelBlockKeys(lines, model).filter((b) => b.start >= model.listNote.start && b.end <= noteEnd);
	return replaceRun(lines, model, from, to, run, {
		removed: noteBlocks.map((b) => b.key),
		added: blockKeys(note.after, 0).map((b) => b.key),
	});
}

/**
 * Whether a save that ends at line `to`, with `last` its last line, writes one blank line after it:
 * it is the note's last, and an item or heading follows directly (owner, 2026-10-20), since a note
 * that ends in an HTML block such as <div> would take in the item.
 */
export function writesBlankAfter(
	lines: readonly Line[],
	model: ListModel,
	piece: { range: { end: number }; blankAfter: boolean },
	to: number,
	last: string | undefined,
): boolean {
	// A block the piece leaves open runs the note to the end of the file, so the blank line it wrote marks it last.
	const isLast = piece.blankAfter || piece.range.end >= model.listNote.end;
	const following = lines[to];
	return last !== undefined && !isBlank(last) && isLast && following !== undefined && !isBlank(following.text);
}

/** The note as saved, without the blank lines at its end, which its warnings check. */
export function noteText(note: readonly Line[]): string {
	const texts = note.map((line) => line.text);
	while (texts.length > 0 && isBlank(texts[texts.length - 1] as string)) texts.pop();
	return texts.join('\n');
}

// The lines a save replaces, [from, to), and the run it writes there: a new piece's empty line before
// it, and the blank line writesBlankAfter asks for after it.
function planSave(lines: readonly Line[], model: ListModel, piece: ListNotePiece, typed: string) {
	const { range, indent, separator, blankAfter } = piece;
	const eol = dominantEol(lines);
	// A blank line stays as typed, without the indent.
	const texts = typedLines(separator ? withoutSeparatorLine(typed) : typed).map((text) => (isBlank(text) ? text : indent + text));
	const from = separator && range.end > range.start && isBlankAt(lines, range.start - 1) ? range.start - 1 : range.start;
	const to = blankAfter && isBlankAt(lines, range.end) ? range.end + 1 : range.end;
	const writesBlank = writesBlankAfter(lines, model, piece, to, texts[texts.length - 1]);
	const before = separator && texts.length > 0 ? [''] : [];
	const run = [...before, ...texts, ...(writesBlank ? [''] : [])].map((text) => ({ text, eol }));
	const start = from + before.length;
	return { from, to, run, writesBlank, written: { start, end: start + texts.length }, note: listNoteAround(lines, model, from, to, run) };
}

const joinTexts = (lines: readonly Line[]) => lines.map((line) => line.text).join('\n');

export function listNoteWouldRestructure(markdown: string): boolean {
	const model = parseList(splitLines(markdown), 0);
	return model.sections.length > 1 || (model.sections[0]?.items.length ?? 0) > 0;
}

export function listNoteUnclosedBlock(markdown: string): boolean {
	return maskBlocks(splitLines(markdown), 0).unclosedStart !== null;
}
