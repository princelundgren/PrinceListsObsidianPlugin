import { deleteHeading, insertHeading } from './edit-headings';
import { deleteItem, insertItem, insertItemInSection } from './edit-items';
import type { InsertedItem } from './empty-item';
import { ownEdit, type OwnEdit } from './follow';
import { joinLines, splitLines, type Line } from './lines';
import { itemAt, parseList, type ListModel, type Section } from './parse';

/** Where a new item goes: after the item whose title is on a line, first under the heading on a line, or first in the list. */
export type ItemPlace = { after: number } | { firstUnder: number } | 'first';

/** Where a new heading goes: after the item whose title is on a line, or after the section whose heading is on a line. */
export type HeadingPlace = { afterItem: number } | { afterSection: number };

export interface PlannedInsert {
	next: string;
	/** The new item's titleLine, or the new heading's line. */
	line: number;
	edit: OwnEdit;
	inserted: InsertedItem;
}

export interface PlannedDelete {
	next: string;
	edit: OwnEdit;
	/** Writes the text from before the delete back, while the file still holds `next`. */
	undo: { next: string; expected: string; edit: OwnEdit };
}

// The empty item "+", Enter and the menus add, opened next with the cursor in its title. Each returns
// null when nothing is on the place's line any more, and throws UnsafeEditError as the edit does.
export function planItemInsert(text: string, contentStart: number, place: ItemPlace): PlannedInsert | null {
	const { lines, model } = parse(text, contentStart);
	let result: { lines: Line[]; titleLine: number };
	if (place === 'first') {
		result = insertItem(lines, model, null, '');
	} else if ('after' in place) {
		const item = itemAt(model, place.after);
		if (!item) return null;
		result = insertItem(lines, model, item, '');
	} else {
		const section = sectionAt(model, place.firstUnder);
		if (!section) return null;
		result = insertItemInSection(lines, model, section, '');
	}
	return insertPlan(text, result.lines, result.titleLine);
}

// The empty heading New heading below adds, before its field opens.
export function planHeadingInsert(text: string, contentStart: number, place: HeadingPlace): PlannedInsert | null {
	const { lines, model } = parse(text, contentStart);
	let at: Parameters<typeof insertHeading>[2];
	if ('afterItem' in place) {
		const item = itemAt(model, place.afterItem);
		if (!item) return null;
		at = { afterItem: item };
	} else {
		const section = sectionAt(model, place.afterSection);
		if (!section) return null;
		at = { afterSection: section };
	}
	const result = insertHeading(lines, model, at, '');
	return insertPlan(text, result.lines, result.headingLine);
}

export function planItemDelete(text: string, contentStart: number, titleLine: number): PlannedDelete | null {
	const { lines, model } = parse(text, contentStart);
	const item = itemAt(model, titleLine);
	return item ? deletePlan(text, deleteItem(lines, model, item), titleLine) : null;
}

export function planHeadingDelete(text: string, contentStart: number, headingLine: number): PlannedDelete | null {
	const { lines, model } = parse(text, contentStart);
	const section = sectionAt(model, headingLine);
	return section ? deletePlan(text, deleteHeading(lines, model, section), headingLine) : null;
}

function parse(text: string, contentStart: number): { lines: Line[]; model: ListModel } {
	const lines = splitLines(text);
	return { lines, model: parseList(lines, contentStart) };
}

function sectionAt(model: ListModel, headingLine: number): Section | undefined {
	return model.sections.find((section) => section.headingLine === headingLine);
}

function insertPlan(text: string, lines: readonly Line[], line: number): PlannedInsert {
	const next = joinLines(lines);
	return { next, line, edit: ownEdit(line, text, next, 'insert'), inserted: { textBefore: text, textAfter: next } };
}

// Both run from the line where the deleted lines started.
function deletePlan(text: string, lines: readonly Line[], start: number): PlannedDelete {
	const next = joinLines(lines);
	return {
		next,
		edit: ownEdit(start, text, next, 'delete'),
		undo: { next: text, expected: next, edit: ownEdit(start, next, text, 'insert') },
	};
}
