import { Parser, type Node } from 'commonmark';
import type { LineRange } from './follow';
import { splitLines } from './lines';
import { pieceText } from './note-pieces';
import { isBlank, maskBlocks } from './parse';
import { pictureLinks } from './picture-links';
import { wikiLinks } from './wiki-links';

/**
 * A block of the notes that Obsidian's renderer draws whole: its lines, and the Markdown it draws:
 * those lines less the first line's indent, so a block in a list item draws as at the left margin,
 * or for indented code, the code as CommonMark reads it, indented four spaces.
 */
export interface DrawnBlock {
	lines: LineRange;
	kind: 'table' | 'code' | 'callout' | 'math' | 'embed' | 'html';
	markdown: string;
}

const CALLOUT = /^[ \t]*>[ \t]*\[![^\]]+\]/;
const HTML_COMMENT = /^[ \t]*<!--/;
const CODE_INDENT = '    ';
// GFM's delimiter row, as @lezer/markdown, the notes editor's parser, reads it.
const TABLE_DELIMITER = /^\s*\|?(\s*:?-+:?\s*\|)+(\s*:?-+:?\s*)?$/;

/**
 * The tables, code blocks, callouts, `$$` blocks, embeds alone on their line other than pictures, and
 * HTML blocks other than comments of `markdown`, the notes, in order: at any depth of list, but none
 * inside another, none inside a plain quote and none that starts on a list item's own line. The
 * notes are read through `maskBlocks`, as the save reads them, so a `$$` block is one where that
 * finds one, and a `%%` comment is none.
 */
export function drawnBlocks(markdown: string): DrawnBlock[] {
	const lines = splitLines(markdown);
	return [...blocksIn(new Parser().parse(maskBlocks(lines, 0).text), lines.map((line) => line.text))];
}

/**
 * The HTML comments of `markdown`, the notes, at any depth: CommonMark's HTML blocks that open with
 * `<!--`, which `drawnBlocks` leaves out because the renderer draws them as nothing.
 */
export function commentBlocks(markdown: string): LineRange[] {
	const lines = splitLines(markdown);
	const texts = lines.map((line) => line.text);
	const found: LineRange[] = [];
	const walker = new Parser().parse(maskBlocks(lines, 0).text).walker();
	for (let step = walker.next(); step; step = walker.next()) {
		const { node, entering } = step;
		if (!entering || node.type !== 'html_block') continue;
		const [[startLine], [endLine]] = node.sourcepos;
		if (HTML_COMMENT.test(node.literal ?? '')) found.push({ start: startLine - 1, end: endOfBlock(texts, startLine - 1, endLine) });
	}
	return found;
}

function* blocksIn(parent: Node, texts: readonly string[]): Generator<DrawnBlock> {
	for (let node = parent.firstChild; node; node = node.next) {
		if (node.type === 'list' || node.type === 'item') {
			yield* blocksIn(node, texts);
			continue;
		}
		const [[startLine, startColumn], [endLine]] = node.sourcepos;
		const lines = { start: startLine - 1, end: endOfBlock(texts, startLine - 1, endLine) };
		const first = texts[lines.start] ?? '';
		const startsItsLine = first.slice(0, startColumn - 1).trim() === '';
		if (node.type === 'paragraph') yield* blocksInParagraph(texts, lines, startsItsLine);
		if (!startsItsLine) continue;
		const kind = kindOf(node.type, first);
		if (kind) yield { lines, kind, markdown: isIndentedCode(node) ? indentedCode(node) : blockText(texts, lines) };
	}
}

function kindOf(type: string, firstLine: string): DrawnBlock['kind'] | null {
	switch (type) {
		case 'code_block':
			// A masked `%%` comment or `$$` block reads as code.
			if (firstLine.startsWith('%%')) return null;
			return firstLine.startsWith('$$') ? 'math' : 'code';
		case 'html_block':
			// The renderer draws a comment as nothing, which would hide its text.
			return HTML_COMMENT.test(firstLine) ? null : 'html';
		case 'block_quote':
			return CALLOUT.test(firstLine) ? 'callout' : null;
		default:
			return null;
	}
}

function* blocksInParagraph(texts: readonly string[], paragraph: LineRange, startsItsLine: boolean): Generator<DrawnBlock> {
	const first = startsItsLine ? paragraph.start : paragraph.start + 1;
	const table = tableStart(texts.slice(paragraph.start, paragraph.end), first - paragraph.start);
	const tableLine = table === undefined ? paragraph.end : paragraph.start + table;
	for (let i = first; i < tableLine; i++) {
		const line = { start: i, end: i + 1 };
		if (isEmbedLine(texts[i] as string)) yield { lines: line, kind: 'embed', markdown: blockText(texts, line) };
	}
	if (table === undefined) return;
	const lines = { start: tableLine, end: paragraph.end };
	yield { lines, kind: 'table', markdown: blockText(texts, lines) };
}

/**
 * The index in `paragraph`, one paragraph's lines, of the first line from `from` on where a table
 * starts, or undefined. As @lezer/markdown reads one, a table runs to the paragraph's end, and starts
 * on its first line, or on a later one when the first has no pipe.
 */
export function tableStart(paragraph: readonly string[], from: number): number | undefined {
	const isFirstLinePiped = hasPipe(paragraph[0] ?? '');
	for (let i = from; i + 1 < paragraph.length; i++) {
		if ((i === 0 || !isFirstLinePiped) && isTableStart(paragraph[i] as string, paragraph[i + 1] as string)) return i;
	}
	return undefined;
}

function isTableStart(header: string, delimiter: string): boolean {
	return hasPipe(header) && TABLE_DELIMITER.test(delimiter) && cellCount(header) === cellCount(delimiter);
}

function isEmbedLine(text: string): boolean {
	const trimmed = text.trim();
	const [link] = wikiLinks(trimmed);
	return link !== undefined && link.embed && link.from === 0 && link.to === trimmed.length && pictureLinks([trimmed]).length === 0;
}

function hasPipe(text: string): boolean {
	for (let i = 0; i < text.length; i++) {
		if (text[i] === '|') return true;
		if (text[i] === '\\') i++;
	}
	return false;
}

// A row's cells, as @lezer/markdown counts them: an outer pipe adds none.
function cellCount(row: string): number {
	let count = 0;
	let isFirst = true;
	let hasCell = false;
	let isEscaped = false;
	for (const char of row) {
		if (char === '|' && !isEscaped) {
			if (!isFirst || hasCell) count++;
			isFirst = false;
			hasCell = false;
		} else if (isEscaped || (char !== ' ' && char !== '\t')) {
			hasCell = true;
		}
		isEscaped = !isEscaped && char === '\\';
	}
	return hasCell ? count + 1 : count;
}

// A block's last line is never empty, as when an unclosed fence runs on past empty lines.
function endOfBlock(texts: readonly string[], start: number, endLine: number): number {
	let end = Math.min(endLine, texts.length);
	while (end > start + 1 && isBlank(texts[end - 1] as string)) end--;
	return end;
}

/**
 * The first of `spans`, in order, that a caret moving from `from` to `to` crosses into: going down, the
 * first whose start is past `from` and no further than `to`; going up, the first whose end is before
 * `from` and no further than `to`. Undefined when it crosses none.
 */
export function spanCrossed<S extends { from: number; to: number }>(spans: readonly S[], from: number, to: number): S | undefined {
	if (to > from) return spans.find((span) => span.from > from && span.from <= to);
	return [...spans].reverse().find((span) => span.to < from && span.to >= to);
}

function blockText(texts: readonly string[], lines: LineRange): string {
	return pieceText(texts.slice(lines.start, lines.end).join('\n'), { start: 0, end: lines.end - lines.start }).text;
}

// CommonMark gives a fenced block's info string, and null for indented code.
function isIndentedCode(node: Node): boolean {
	return node.type === 'code_block' && node.info === null;
}

// As CommonMark read the code, so its lines keep their own indents, and four spaces make it code again.
function indentedCode(node: Node): string {
	return (node.literal ?? '')
		.replace(/\n$/, '')
		.split('\n')
		.map((line) => CODE_INDENT + line)
		.join('\n');
}
