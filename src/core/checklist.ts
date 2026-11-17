import { commentBlocks, drawnBlocks } from './drawn-blocks';
import { joinItemLine, parseItemLine } from './item-line';
import type { PlannedLineEdit } from './list-actions';
import { joinLines, spliceLines, splitLines, type Line } from './lines';
import { columnOf, itemAt, maskBlocks, parseList, stripIndent, type ItemBlock } from './parse';

export function toggleChecklistLine(text: string): string {
	const parts = parseItemLine(text);
	if (!parts) return text;
	return joinItemLine({ ...parts, status: parts.status === ' ' ? 'x' : ' ' });
}

/** The column of a checklist line's status, the character between its `[` and `]`, or null for any other line. */
export function checklistStatusAt(text: string): number | null {
	return parseItemLine(text)?.before.length ?? null;
}

/**
 * Ticks file line `line`, a box the notes editor drew, in the notes of the item at title line
 * `notesOf` or in the list note. null when the line no longer reads `lineText`, lies outside those
 * notes or isn't a checklist line. The line is found by its number, not by counting boxes, so `%%`
 * and `$$` in the notes don't stop it.
 */
export function planNotesLineTick(
	text: string,
	contentStart: number,
	notesOf: number | 'listNote',
	line: number,
	lineText: string,
): PlannedLineEdit | null {
	const lines = splitLines(text);
	const model = parseList(lines, contentStart);
	const item = notesOf === 'listNote' ? undefined : itemAt(model, notesOf);
	const notes = notesOf === 'listNote' ? model.listNote : item && { start: item.titleLine + 1, end: item.endLine };
	if (!notes || line < notes.start || line >= notes.end || !parseItemLine(lineText)) return null;
	return tickLine(lines, line, lineText);
}

function tickLine(lines: readonly Line[], at: number, lineText: string): PlannedLineEdit | null {
	const line = lines[at];
	if (!line || line.text !== lineText) return null;
	const next = joinLines(spliceLines(lines, at, 1, [{ text: toggleChecklistLine(line.text), eol: line.eol }]));
	return { next, edit: { start: at, delta: 0, kind: 'change' } };
}

/**
 * The lines with every checklist line in the item's notes unticked, so each repeat starts its
 * checklist fresh. A line in a block the notes editor draws whole, such as a code fence or a
 * callout, or one inside a `%%` or `$$` region or an HTML comment, stays as it is.
 */
export function untickChecklist(lines: readonly Line[], item: ItemBlock): Line[] {
	const result = lines.slice();
	for (const at of plainNotesLines(lines, item)) {
		const line = lines[at] as Line;
		const parts = parseItemLine(line.text);
		if (parts && parts.status !== ' ') result[at] = { text: joinItemLine({ ...parts, status: ' ' }), eol: line.eol };
	}
	return result;
}

/**
 * The file lines of the item's notes that are plain Markdown: outside the blocks the notes editor
 * draws whole, such as a code fence or a callout, `%%` and `$$` regions and HTML comments.
 */
export function plainNotesLines(lines: readonly Line[], item: ItemBlock): number[] {
	const first = item.titleLine + 1;
	const notes = notesAtMargin(lines, item);
	const kept = new Set<number>();
	const text = joinLines(notes);
	for (const block of [...drawnBlocks(text).map((b) => b.lines), ...commentBlocks(text)]) {
		for (let i = block.start; i < block.end; i++) kept.add(i);
	}
	for (const [from, to] of maskBlocks(notes, 0).runs) {
		for (let i = from; i <= to; i++) kept.add(i);
	}
	return notes.flatMap((_, i) => (kept.has(i) ? [] : [first + i]));
}

/** The item's notes lines as the notes editor reads them, at the left margin; the first is the line after the title. */
export function notesAtMargin(lines: readonly Line[], item: ItemBlock): Line[] {
	const width = columnOf(item.notesIndent);
	return lines.slice(item.titleLine + 1, item.endLine).map((line) => ({ text: stripIndent(line.text, width), eol: line.eol }));
}
