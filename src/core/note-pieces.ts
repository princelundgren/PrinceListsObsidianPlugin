import type { LineRange } from './follow';
import type { NotesChange } from './notes-lines';
import { splitLines } from './lines';
import { documentBlocks, isBlank, nonBlankRuns } from './parse';

export function notePieces(markdown: string): LineRange[] {
	const lines = splitLines(markdown);
	const pieces: LineRange[] = [];
	let covered = 0;
	for (const { start, end } of documentBlocks(lines, 0)) {
		// Non-empty lines no block covers, such as link definitions, which commonmark drops.
		pieces.push(...nonBlankRuns(lines, covered, start), { start, end });
		covered = end;
	}
	pieces.push(...nonBlankRuns(lines, covered, lines.length));
	return pieces;
}

export function pieceText(markdown: string, range: LineRange): { text: string; indent: string } {
	const lines = splitLines(markdown).slice(range.start, range.end);
	const indent = leadingSpace(lines[0]?.text ?? '');
	const text = lines.map(({ text }) => (text.startsWith(indent) ? text.slice(indent.length) : text)).join('\n');
	return { text, indent };
}

/**
 * The line, in the notes, where a block added after the lines in `range` goes: after the piece
 * holding them, which is the whole list for an item, and after any pieces that follow with no empty line
 * between, so the new block never runs into the next.
 */
export function blockAfter(markdown: string, range: LineRange): number {
	const pieces = notePieces(markdown);
	let end = pieceAround(pieces, range)?.end ?? range.end;
	for (let next = pieces.find((piece) => piece.start === end); next; next = pieces.find((piece) => piece.start === end)) end = next.end;
	return end;
}

/**
 * The change that adds `block`'s lines as a block of their own below `line`, one of the lines of
 * `markdown`, the notes as the editor holds them, with `\n` line breaks: after that line's block, as
 * `blockAfter` places one, or in place of an empty line between blocks. Also the line the caret goes
 * to, an empty one right below the block, which is a new one at the end of the notes.
 */
export function blockBelow(markdown: string, line: number, block: readonly string[]): { change: NotesChange; caret: number } {
	const lines = markdown.split('\n');
	const isBlankAt = (i: number) => isBlank(lines[i] ?? '');
	const replacesLine = isBlankAt(line) && !notePieces(markdown).some((piece) => piece.start <= line && line < piece.end);
	const from = replacesLine ? line : blockAfter(markdown, { start: line, end: line + 1 });
	const to = replacesLine ? line + 1 : from;
	const before = isBlankAt(from - 1) ? [] : [''];
	const after = to < lines.length && isBlankAt(to) ? [] : [''];
	return { change: { from, to, lines: [...before, ...block, ...after] }, caret: from + before.length + block.length };
}

/** The piece holding `range`; for an empty range, the piece it ends, before one starting there. */
function pieceAround(pieces: readonly LineRange[], range: LineRange): LineRange | undefined {
	const at = range.start;
	const ended = range.start === range.end ? pieces.find((piece) => piece.end === at) : undefined;
	return ended ?? pieces.find((piece) => piece.start <= at && at < piece.end) ?? pieces.find((piece) => piece.end === at);
}

function leadingSpace(text: string): string {
	return (/^[ \t]*/.exec(text) as RegExpExecArray)[0];
}
