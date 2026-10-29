import { blockKey, replaceRun } from './edit-check';
import { isBlankAt, typedLines, withoutSeparatorLine } from './edit-lines';
import { mapRange, type LineRange } from './follow';
import { dominantEol, type Line } from './lines';
import { isBlank, type ItemBlock, type ListModel } from './parse';

/**
 * One open piece of an item's notes, in file lines. `indent` is the item's notes indent plus the
 * piece's own. A new piece (`separator`) has an empty line before it while it holds text, so it stays
 * a block of its own.
 */
export interface PieceSession {
	range: LineRange;
	indent: string;
	separator: boolean;
}

export function setNotesPiece(
	lines: readonly Line[],
	model: ListModel,
	item: ItemBlock,
	piece: PieceSession,
	typed: string,
): { lines: Line[]; piece: PieceSession } {
	const { range, indent, separator } = piece;
	const texts = typedLines(separator ? withoutSeparatorLine(typed) : typed).map((text) => (isBlank(text) ? '' : indent + text));
	const ownsSeparator = separator && range.end > range.start && isBlankAt(lines, range.start - 1);
	const from = ownsSeparator ? range.start - 1 : range.start;
	const run = separator && texts.length > 0 ? ['', ...texts] : texts;
	const eol = dominantEol(lines);
	const edited = replaceRun(lines, model, from, range.end, run.map((text) => ({ text, eol })), itemNotesKeys(lines, item, from, range.end, run));
	const start = from + run.length - texts.length;
	return { lines: edited, piece: { ...piece, range: { start, end: start + texts.length } } };
}

/** The item's block, as replaceRun names it, before and after lines [from, to) become `run`. */
export function itemNotesKeys(
	lines: readonly Line[],
	item: ItemBlock,
	from: number,
	to: number,
	run: readonly string[],
): { removed: string[]; added: string[] } {
	const before = lines.slice(item.titleLine, item.endLine).map((line) => line.text);
	const after = lines.slice(item.titleLine, Math.max(item.endLine, to)).map((line) => line.text);
	after.splice(from - item.titleLine, to - from, ...run);
	while (after.length > 1 && isBlank(after[after.length - 1] as string)) after.pop();
	return { removed: [blockKey('item', before)], added: [blockKey('item', after)] };
}

// After an outside change: the piece's lines where it put them, or null when it changed any of them.
export function mapPieceRange(oldLines: readonly Line[], newLines: readonly Line[], range: LineRange): LineRange | null {
	const mapped = mapRange(oldLines, newLines, range);
	if (!mapped || mapped.end - mapped.start !== range.end - range.start) return null;
	const isKept = newLines.slice(mapped.start, mapped.end).every((line, i) => line.text === oldLines[range.start + i]?.text);
	return isKept ? mapped : null;
}
