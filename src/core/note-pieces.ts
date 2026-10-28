import { Parser, type Node } from 'commonmark';
import type { FormatEdit } from './format';
import type { LineRange } from './follow';
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
	const lines = splitLines(markdown);
	const walker = new Parser().parse(maskBlocks(lines, 0).text).walker();
	const items: LineRange[] = [];
	for (let event = walker.next(); event; event = walker.next()) {
		const { node, entering } = event;
		if (!entering || node.type !== 'item' || isInQuote(node)) continue;
		const start = node.sourcepos[0][0] - 1;
		if (start < piece.start || start >= piece.end) continue;
		let end = Math.min(node.sourcepos[1][0], piece.end);
		while (end > start + 1 && isBlank(lines[end - 1]?.text ?? '')) end--;
		items.push({ start, end });
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
	const ownIndent = columnOf(leadingSpace(lines[0] as string));
	const item = itemStart(line);
	if (!item || caret < lineStart + item[0].length) return { kind: 'newline' };
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

// Down is the smallest start after the current one's: a parent's first child, else the next piece.
export function neighborPiece(ranges: readonly LineRange[], current: LineRange, direction: 'up' | 'down'): LineRange | null {
	let best: LineRange | null = null;
	for (const range of ranges) {
		if (direction === 'up' ? range.start >= current.start : range.start <= current.start) continue;
		if (!best || (direction === 'up' ? range.start > best.start : range.start < best.start)) best = range;
	}
	return best;
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

function isInQuote(node: Node): boolean {
	for (let parent = node.parent; parent; parent = parent.parent) if (parent.type === 'block_quote') return true;
	return false;
}

function leadingSpace(text: string): string {
	return (/^[ \t]*/.exec(text) as RegExpExecArray)[0];
}
