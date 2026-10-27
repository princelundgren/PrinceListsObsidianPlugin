import { Parser } from 'commonmark';
import { getItemNotes, notesStartLine } from './edit-items';
import { joinItemLine, parseItemLine } from './item-line';
import type { PlannedLineEdit } from './list-actions';
import { joinLines, spliceLines, splitLines, type Line } from './lines';
import { itemAt, parseList, type ItemBlock } from './parse';

export interface ChecklistLine {
	line: number;
	ticked: boolean;
}

// The notes as CommonMark reads them, so a fenced line isn't a box. A list item in a blockquote or
// callout starts with `>`, which parseItemLine doesn't read, so it isn't counted either.
export function checklistOf(lines: readonly Line[], item: ItemBlock): ChecklistLine[] {
	const notesStart = notesStartLine(lines, item);
	const notes = getItemNotes(lines, item);
	if (notes === '') return [];
	const checklist: ChecklistLine[] = [];
	const walker = new Parser().parse(notes).walker();
	for (let event = walker.next(); event; event = walker.next()) {
		if (!event.entering || event.node.type !== 'item') continue;
		const line = notesStart + event.node.sourcepos[0][0] - 1;
		const parts = parseItemLine(lines[line]?.text ?? '');
		if (parts) checklist.push({ line, ticked: parts.status !== ' ' });
	}
	return checklist;
}

export function toggleChecklistLine(text: string): string {
	const parts = parseItemLine(text);
	if (!parts) return text;
	return joinItemLine({ ...parts, status: parts.status === ' ' ? 'x' : ' ' });
}

// The browser flips a box before its click is handled, and the view cancels that, so the box's state
// says nothing: the file decides which way the line goes. `lineText` is the line as it was at the click: if it reads differently now, the box no
// longer stands for it.
export function planChecklistTick(
	text: string,
	contentStart: number,
	titleLine: number,
	index: number,
	lineText: string,
): PlannedLineEdit | null {
	const lines = splitLines(text);
	const item = itemAt(parseList(lines, contentStart), titleLine);
	if (!item) return null;
	const entry = checklistOf(lines, item)[index];
	const line = entry ? lines[entry.line] : undefined;
	if (!entry || !line || line.text !== lineText) return null;
	const next = joinLines(spliceLines(lines, entry.line, 1, [{ text: toggleChecklistLine(line.text), eol: line.eol }]));
	return { next, edit: { start: entry.line, delta: 0, kind: 'change' } };
}
