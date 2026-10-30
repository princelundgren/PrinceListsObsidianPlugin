import { joinItemLine, parseItemLine } from './item-line';
import type { PlannedLineEdit } from './list-actions';
import { joinLines, spliceLines, splitLines, type Line } from './lines';
import { itemAt, parseList } from './parse';

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
