import { blockKeys, modelBlockKeys, replaceRun } from './edit-check';
import { isBlankAt, typedLines, withoutSeparatorLine } from './edit-lines';
import type { PieceSession } from './edit-piece';
import type { LineRange } from './follow';
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
 * wrote, which goes again while it is still blank and the piece is erased; or, once the piece is
 * erased, the one it took, which typing writes again.
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
	const next = { ...piece, range: save.written, separator: save.separator, blankAfter: save.ownsBlankAfter };
	const note = noteText(save.noteAfter);
	// The owner's exception: while the note, as saved or as it was, or the piece leaves a block open,
	// what follows is hidden or reads differently, so the piece saves without the check. Only the
	// piece's lines change, so closing the block brings back what follows as it was.
	const replaced = lines.slice(range.start, range.end).map((line) => line.text).join('\n');
	if ([typed, replaced, joinTexts(save.noteBefore), joinTexts(save.noteAfter)].some(listNoteUnclosedBlock)) {
		return { lines: spliceLines(lines, save.from, save.to - save.from, save.run), piece: next, note };
	}
	const noteEnd = model.listNote.start + save.noteBefore.length;
	const noteBlocks = modelBlockKeys(lines, model).filter((b) => b.start >= model.listNote.start && b.end <= noteEnd);
	const edited = replaceRun(lines, model, save.from, save.to, save.run, {
		removed: noteBlocks.map((b) => b.key),
		added: blockKeys(save.noteAfter, 0).map((b) => b.key),
	});
	return { lines: edited, piece: next, note };
}

/** The whole list note as it reads once `typed` is saved in the piece, which its warnings check. */
export function listNoteWithPiece(lines: readonly Line[], model: ListModel, piece: ListNotePiece, typed: string): string {
	return noteText(planSave(lines, model, piece, typed).noteAfter);
}

function noteText(note: readonly Line[]): string {
	const texts = note.map((line) => line.text);
	while (texts.length > 0 && isBlank(texts[texts.length - 1] as string)) texts.pop();
	return texts.join('\n');
}

// The lines a save replaces, [from, to), and the run it writes there: a new piece's empty line before
// it, and one blank line after it when it is the note's last and an item or heading follows directly
// (owner, 2026-10-20), since a note that ends in an HTML block such as <div> would take in the item.
function planSave(lines: readonly Line[], model: ListModel, piece: ListNotePiece, typed: string) {
	const { range, indent } = piece;
	const eol = dominantEol(lines);
	// A blank line stays as typed, without the indent.
	const texts = typedLines(piece.separator ? withoutSeparatorLine(typed) : typed).map((text) => (isBlank(text) ? text : indent + text));
	// An erased block takes one blank line with it, so typing in it again puts that line back: the one
	// below when it is the block's own, or the first block's; otherwise the one above, as a new piece has.
	const separator = piece.separator || (texts.length === 0 && !piece.blankAfter && takesLineAbove(lines, range));
	const blankAfter = piece.blankAfter || (texts.length === 0 && !separator && takesLineBelow(lines, model, range));
	const from = separator && range.end > range.start && isBlankAt(lines, range.start - 1) ? range.start - 1 : range.start;
	const to = blankAfter && isBlankAt(lines, range.end) ? range.end + 1 : range.end;
	// A block the piece leaves open runs the note to the end of the file, so the blank line it wrote marks it last.
	const isLast = blankAfter || range.end >= model.listNote.end;
	const following = lines[to];
	const writesBlank = texts.length > 0 && isLast && following !== undefined && !isBlank(following.text);
	const before = separator && texts.length > 0 ? [''] : [];
	const run = [...before, ...texts, ...(writesBlank ? [''] : [])].map((text) => ({ text, eol }));
	const noteEnd = Math.max(model.listNote.end, to);
	const start = from + before.length;
	return {
		from,
		to,
		run,
		separator,
		ownsBlankAfter: writesBlank || (texts.length === 0 && to > range.end),
		written: { start, end: start + texts.length },
		noteBefore: lines.slice(model.listNote.start, noteEnd),
		noteAfter: [...lines.slice(model.listNote.start, from), ...run, ...lines.slice(to, noteEnd)],
	};
}

// One empty line still separates the blocks around an erased one.
function takesLineAbove(lines: readonly Line[], range: LineRange): boolean {
	return range.end > range.start && isBlankAt(lines, range.start - 1) && isBlankAt(lines, range.end);
}

// A first block with more of the note after it takes the line between them; one with only items after
// it leaves its blank line above them, as erasing the whole note does.
function takesLineBelow(lines: readonly Line[], model: ListModel, range: LineRange): boolean {
	const followedByNote = lines.slice(range.end, model.listNote.end).some((line) => !isBlank(line.text));
	return range.end > range.start && range.start === model.listNote.start && isBlankAt(lines, range.end) && followedByNote;
}

const joinTexts = (lines: readonly Line[]) => lines.map((line) => line.text).join('\n');

export function listNoteWouldRestructure(markdown: string): boolean {
	const model = parseList(splitLines(markdown), 0);
	return model.sections.length > 1 || (model.sections[0]?.items.length ?? 0) > 0;
}

export function listNoteUnclosedBlock(markdown: string): boolean {
	return maskBlocks(splitLines(markdown), 0).unclosedStart !== null;
}
