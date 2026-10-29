import { Parser } from 'commonmark';
import { getItemNotes, notesStartLine } from './edit-items';
import { getListNote } from './edit-list-note';
import { joinItemLine, parseItemLine } from './item-line';
import type { PlannedLineEdit } from './list-actions';
import { joinLines, spliceLines, splitLines, type Line } from './lines';
import { itemAt, parseList, type ItemBlock, type ListModel } from './parse';

export interface ChecklistLine {
	line: number;
	ticked: boolean;
}

// The notes as CommonMark reads them, so a fenced line isn't a box. A list item in a blockquote or
// callout starts with `>`, which parseItemLine doesn't read, so it isn't counted either. null when
// the notes hold `%%` or `$$`: Obsidian hides the boxes inside them, and an embed's or a callout's
// box could make up the count, so no box can be lined up with its line.
export function checklistOf(lines: readonly Line[], item: ItemBlock): ChecklistLine[] | null {
	return checklistIn(lines, getItemNotes(lines, item), notesStartLine(lines, item));
}

/** As checklistOf, for the list note: its checkbox lines, which are nested, since a top-level one is an item. */
export function listNoteChecklist(lines: readonly Line[], model: ListModel): ChecklistLine[] | null {
	return checklistIn(lines, getListNote(lines, model), model.listNote.start);
}

function checklistIn(lines: readonly Line[], notes: string, notesStart: number): ChecklistLine[] | null {
	if (notes === '') return [];
	if (notes.includes('%%') || notes.includes('$$')) return null;
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

// Whether a card's rendered boxes, by their checked state, line up with its checklist. A box in a
// callout, an embed or a `%%` comment puts them out of step.
export function boxesMatchChecklist(checked: readonly boolean[], checklist: readonly ChecklistLine[] | null): boolean {
	return checklist !== null && checked.length === checklist.length && checked.every((ticked, index) => ticked === checklist[index]?.ticked);
}

export function toggleChecklistLine(text: string): string {
	const parts = parseItemLine(text);
	if (!parts) return text;
	return joinItemLine({ ...parts, status: parts.status === ' ' ? 'x' : ' ' });
}

/** The column of a checklist line's status, the character between its `[` and `]`, or null for any other line. */
export function checklistStatusAt(text: string): number | null {
	return parseItemLine(text)?.before.length ?? null;
}

// The browser flips a box before its click is handled, and the view cancels that, so the box's
// state says nothing: the file decides which way the line goes. `lineText` is the line as it was at
// the click; if it reads differently now, the box no longer stands for it.
export function planChecklistTick(
	text: string,
	contentStart: number,
	titleLine: number,
	index: number,
	lineText: string,
): PlannedLineEdit | null {
	const lines = splitLines(text);
	const item = itemAt(parseList(lines, contentStart), titleLine);
	return item ? tickIn(lines, checklistOf(lines, item), index, lineText) : null;
}

/** As planChecklistTick, for a box in the list note. */
export function planListNoteTick(text: string, contentStart: number, index: number, lineText: string): PlannedLineEdit | null {
	const lines = splitLines(text);
	return tickIn(lines, listNoteChecklist(lines, parseList(lines, contentStart)), index, lineText);
}

/**
 * Ticks file line `line`, a box the notes editor drew, in the notes of the item at title line
 * `notesOf` or in the list note. null when the line no longer reads `lineText`, lies outside those
 * notes or isn't a checklist line. Nothing is counted, so `%%` and `$$` in the notes don't stop it.
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

function tickIn(lines: readonly Line[], checklist: ChecklistLine[] | null, index: number, lineText: string): PlannedLineEdit | null {
	const entry = checklist?.[index];
	return entry ? tickLine(lines, entry.line, lineText) : null;
}

function tickLine(lines: readonly Line[], at: number, lineText: string): PlannedLineEdit | null {
	const line = lines[at];
	if (!line || line.text !== lineText) return null;
	const next = joinLines(spliceLines(lines, at, 1, [{ text: toggleChecklistLine(line.text), eol: line.eol }]));
	return { next, edit: { start: at, delta: 0, kind: 'change' } };
}
