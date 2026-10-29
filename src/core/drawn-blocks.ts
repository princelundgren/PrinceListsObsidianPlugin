import { Parser, type Node } from 'commonmark';
import type { LineRange } from './follow';
import { splitLines } from './lines';
import { isBlank, maskBlocks } from './parse';
import { pictureLinks } from './picture-links';
import { wikiLinks } from './wiki-links';

/** A block of the notes that Obsidian's renderer draws whole, and its lines. */
export interface DrawnBlock {
	lines: LineRange;
	kind: 'table' | 'code' | 'callout' | 'math' | 'embed' | 'html';
}

const CALLOUT = /^[ \t]*>[ \t]*\[![^\]]+\]/;
const HTML_COMMENT = /^[ \t]*<!--/;
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
	const texts = splitLines(markdown).map((line) => line.text);
	return [...blocksIn(new Parser().parse(maskBlocks(splitLines(markdown), 0).text), texts)];
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
		if (kind) yield { lines, kind };
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

// As @lezer/markdown reads one, a table runs to the paragraph's end, and starts on its first line, or on
// a later one when the first has no pipe.
function* blocksInParagraph(texts: readonly string[], paragraph: LineRange, startsItsLine: boolean): Generator<DrawnBlock> {
	const isFirstLinePiped = hasPipe(texts[paragraph.start] as string);
	for (let i = startsItsLine ? paragraph.start : paragraph.start + 1; i < paragraph.end; i++) {
		const text = texts[i] as string;
		const next = texts[i + 1];
		const mayStartTable = i === paragraph.start || !isFirstLinePiped;
		if (mayStartTable && next !== undefined && i + 1 < paragraph.end && isTableStart(text, next)) {
			yield { lines: { start: i, end: paragraph.end }, kind: 'table' };
			return;
		}
		if (isEmbedLine(text)) yield { lines: { start: i, end: i + 1 }, kind: 'embed' };
	}
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
