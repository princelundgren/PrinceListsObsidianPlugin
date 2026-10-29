import { Parser, type Node } from 'commonmark';
import type { FormatEdit } from './format';
import type { LineRange } from './follow';
import type { NotesChange } from './notes-lines';
import { splitLines } from './lines';
import { columnOf, documentBlocks, isBlank, maskBlocks, nonBlankRuns } from './parse';

export type PieceEnter =
	| { kind: 'newline' }
	| { kind: 'edit'; edit: FormatEdit }
	| { kind: 'nextItem'; marker: string }
	| { kind: 'outdent' }
	| { kind: 'endList' };

// Indent, marker, the space after it, and a checkbox with the space after that.
const ITEM_START = /^([ \t]*)([-*+]|\d{1,9}[.)])(?:([ \t]+)(?:(\[.\])([ \t]+|$))?|$)/;
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;

/** Whether every piece of the notes lies within `range`, the lines of the piece open for typing. */
export function holdsOnly(markdown: string, range: LineRange): boolean {
	return notePieces(markdown).every((piece) => piece.start >= range.start && piece.end <= range.end);
}

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

export function itemPieces(markdown: string, piece: LineRange): LineRange[] {
	const lines = splitLines(markdown).slice(piece.start, piece.end);
	const walker = new Parser().parse(maskBlocks(lines, 0).text).walker();
	const items: LineRange[] = [];
	for (let event = walker.next(); event; event = walker.next()) {
		const { node, entering } = event;
		if (!entering || node.type !== 'item' || isInQuote(node)) continue;
		const start = node.sourcepos[0][0] - 1;
		let end = Math.min(node.sourcepos[1][0], lines.length);
		while (end > start + 1 && isBlank(lines[end - 1]?.text ?? '')) end--;
		items.push({ start: piece.start + start, end: piece.start + end });
	}
	return items;
}

export function pieceText(markdown: string, range: LineRange): { text: string; indent: string } {
	const lines = splitLines(markdown).slice(range.start, range.end);
	const indent = leadingSpace(lines[0]?.text ?? '');
	const text = lines.map(({ text }) => (text.startsWith(indent) ? text.slice(indent.length) : text)).join('\n');
	return { text, indent };
}

export function nextItemMarker(line: string): string | null {
	const match = itemStart(line);
	if (!match) return null;
	const [, indent = '', marker = '', space = ' ', checkbox, checkboxSpace] = match;
	const number = /^\d+/.exec(marker)?.[0];
	const next = number === undefined ? marker : `${Number(number) + 1}${marker.slice(number.length)}`;
	return indent + next + space + (checkbox ? `[ ]${checkboxSpace || ' '}` : '');
}

export function pieceEnter(text: string, caret: number, nested: boolean): PieceEnter {
	const lines = text.split('\n');
	const before = text.slice(0, caret).split('\n');
	const lineIndex = before.length - 1;
	const lineStart = caret - (before[lineIndex] as string).length;
	const line = lines[lineIndex] as string;
	const isLast = lineIndex === lines.length - 1;
	const atLineEnd = caret === lineStart + line.length;
	const ownIndent = columnOf(leadingSpace(lines.find((text) => text.trim() !== '') ?? ''));
	const item = itemStart(line);
	if (!item || caret < lineStart + item[0].length || !isListLine(text, lineIndex)) return { kind: 'newline' };
	const isEmpty = !line.slice(item[0].length).trim();
	const indent = columnOf(item[1] ?? '');
	if (isEmpty && indent <= ownIndent) {
		if (!isLast) return { kind: 'newline' };
		return { kind: nested ? 'outdent' : 'endList' };
	}
	if (isEmpty) {
		const marker = outerItemMarker(lines.slice(0, lineIndex), indent);
		return marker === null ? { kind: 'newline' } : caretAfter(lineStart, line.length, marker);
	}
	if (!atLineEnd) return { kind: 'newline' };
	const marker = nextItemMarker(line) as string;
	if (isLast) return { kind: 'nextItem', marker };
	return caretAfter(caret, 0, `\n${marker}`);
}

// Up is the nearest start above the current one's, which from a first child is its parent. Down is
// the first start past the current piece, so past the items nested in it, which its field holds.
export function neighborPiece(ranges: readonly LineRange[], current: LineRange, direction: 'up' | 'down'): LineRange | null {
	let best: LineRange | null = null;
	for (const range of ranges) {
		if (direction === 'up' ? range.start >= current.start : range.start < current.end) continue;
		if (!best || (direction === 'up' ? range.start > best.start : range.start < best.start)) best = range;
	}
	return best;
}

/**
 * The marker, in the file's indent, that moves an item one level out of its list; null at the list's
 * top level. `notes` is the notes' Markdown, `fileLines` the same lines as in the file, `item` the
 * item's lines, empty where a new one would go, and `firstLine` its line as in the file.
 */
export function outdentMarker(notes: string, fileLines: readonly string[], item: LineRange, firstLine: string): string | null {
	const list = pieceAround(notePieces(notes), item);
	return outerItemMarker(fileLines.slice(list?.start ?? item.start, item.start), columnOf(leadingSpace(firstLine)));
}

/**
 * The line, in the notes, where a block added after the open lines goes: after the piece holding
 * them, which is the whole list for an item, and after any pieces that follow with no empty line
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
export function pieceAround(pieces: readonly LineRange[], range: LineRange): LineRange | undefined {
	const at = range.start;
	const ended = range.start === range.end ? pieces.find((piece) => piece.end === at) : undefined;
	return ended ?? pieces.find((piece) => piece.start <= at && at < piece.end) ?? pieces.find((piece) => piece.end === at);
}

// The item after the nearest earlier item indented less than `indent`: its parent.
function outerItemMarker(earlier: readonly string[], indent: number): string | null {
	for (const line of [...earlier].reverse()) {
		const item = itemStart(line);
		if (item && columnOf(item[1] ?? '') < indent) return nextItemMarker(line);
	}
	return null;
}

function itemStart(line: string): RegExpExecArray | null {
	return THEMATIC_BREAK.test(line) ? null : ITEM_START.exec(line);
}

function caretAfter(from: number, length: number, insert: string): PieceEnter {
	const caret = from + insert.length;
	return { kind: 'edit', edit: { from, to: from + length, insert, selectionStart: caret, selectionEnd: caret } };
}

// Whether the field holds a list and the line isn't code inside it, so a line that only looks like an
// item, in a fence or a paragraph, takes Enter as a new line.
function isListLine(text: string, lineIndex: number): boolean {
	const doc = new Parser().parse(maskBlocks(splitLines(text), 0).text);
	if (doc.firstChild?.type !== 'list') return false;
	const walker = doc.walker();
	for (let event = walker.next(); event; event = walker.next()) {
		const { node } = event;
		if (node.type === 'code_block' && node.sourcepos[0][0] - 1 <= lineIndex && lineIndex < node.sourcepos[1][0]) return false;
	}
	return true;
}

function isInQuote(node: Node): boolean {
	for (let parent = node.parent; parent; parent = parent.parent) if (parent.type === 'block_quote') return true;
	return false;
}

function leadingSpace(text: string): string {
	return (/^[ \t]*/.exec(text) as RegExpExecArray)[0];
}
