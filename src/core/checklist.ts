import { drawnBlocks } from './drawn-blocks';
import { stripIndent } from './edit-items';
import { joinItemLine, parseItemLine } from './item-line';
import type { PlannedLineEdit } from './list-actions';
import { joinLines, spliceLines, splitLines, type Line } from './lines';
import { columnOf, itemAt, maskBlocks, parseList, type ItemBlock } from './parse';

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
 * callout, or one that `%%` or `$$` masks, stays as it is.
 */
export function untickChecklist(lines: readonly Line[], item: ItemBlock): Line[] {
	const first = item.titleLine + 1;
	const width = columnOf(item.notesIndent);
	// As the notes editor reads them, at the left margin.
	const notes = lines.slice(first, item.endLine).map((line) => ({ text: stripIndent(line.text, width), eol: line.eol }));
	const kept = new Set<number>();
	for (const { lines: block } of drawnBlocks(joinLines(notes))) {
		for (let i = block.start; i < block.end; i++) kept.add(i);
	}
	for (const [from, to] of maskedRuns(notes)) {
		for (let i = from; i <= to; i++) kept.add(i);
	}
	const result = lines.slice();
	notes.forEach((_, i) => {
		const line = lines[first + i] as Line;
		const parts = kept.has(i) ? null : parseItemLine(line.text);
		if (parts && parts.status !== ' ') result[first + i] = { text: joinItemLine({ ...parts, status: ' ' }), eol: line.eol };
	});
	return result;
}

// The runs of lines `maskBlocks` masks, each from its opening line to its closing one, which an
// unclosed run lacks. It rewrites only a run's two delimiter lines.
function maskedRuns(notes: readonly Line[]): [from: number, to: number][] {
	const masked = splitLines(maskBlocks(notes, 0).text);
	const delimiters = notes.flatMap((line, i) => (masked[i]?.text === line.text ? [] : [i]));
	const runs: [number, number][] = [];
	for (let i = 0; i < delimiters.length; i += 2) runs.push([delimiters[i] as number, delimiters[i + 1] ?? notes.length - 1]);
	return runs;
}
