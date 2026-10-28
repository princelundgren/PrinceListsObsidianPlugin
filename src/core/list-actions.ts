import { deleteHeading, insertHeading } from './edit-headings';
import { deleteItem, insertItem, insertItemInSection, moveItemWithLineMap, type MoveTarget } from './edit-items';
import type { InsertedItem } from './empty-item';
import { moveEdit, ownEdit, type OwnEdit } from './follow';
import { joinLines, spliceLines, splitLines, type Line } from './lines';
import { moveSectionWithLineMap } from './move-section';
import { itemAt, parseList, type ListModel, type Section } from './parse';

/**
 * Where a new or dragged item goes: after the item whose title is on a line, first under the heading
 * on a line, or first in the list.
 */
export type ItemPlace = { after: number } | { firstUnder: number } | 'first';

/**
 * Where a new heading goes: after the item whose title is on a line, after the section whose heading is
 * on a line, or after the part before the first heading.
 */
export type HeadingPlace = { afterItem: number } | { afterSection: number } | 'top';

export interface PlannedInsert {
	next: string;
	/** The new item's titleLine, or the new heading's line. */
	line: number;
	edit: OwnEdit;
	inserted: InsertedItem;
}

export interface PlannedMove {
	next: string;
	edit: OwnEdit;
}

export interface PlannedLineEdit {
	next: string;
	edit: OwnEdit;
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
	if (place === 'top') {
		at = { afterSection: model.sections[0] as Section };
	} else if ('afterItem' in place) {
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

// After the section's last item, which keeps a new item off any text below it that it would join.
export function endOfSection(section: Section): ItemPlace {
	const last = section.items.at(-1);
	if (last) return { after: last.titleLine };
	return section.headingLine === null ? 'first' : { firstUnder: section.headingLine };
}

export function sectionLastLine(lines: readonly Line[], section: Section, contentStart: number): number {
	const first = section.headingLine ?? contentStart;
	for (let line = section.endLine - 1; line > first; line--) {
		if (lines[line]?.text.trim()) return line;
	}
	return first;
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

// A drop. null when the item or the place is gone, or when the move would change nothing; throws
// UnsafeEditError as moveItem does.
export function planItemMove(text: string, contentStart: number, titleLine: number, place: ItemPlace): PlannedMove | null {
	const { lines, model } = parse(text, contentStart);
	const item = itemAt(model, titleLine);
	const target = moveTarget(model, place);
	if (!item || !target) return null;
	const moved = moveItemWithLineMap(lines, model, item, target);
	const next = joinLines(moved.lines);
	return next === text ? null : { next, edit: moveEdit(moved.moved) };
}

// null when either heading is gone, or the section would stay where it is. Throws UnsafeEditError as
// the move does.
export function planSectionMove(text: string, contentStart: number, headingLine: number, before: number | null): PlannedMove | null {
	const { lines, model } = parse(text, contentStart);
	const sectionAt = (line: number) => model.sections.find((section) => section.headingLine === line);
	const section = sectionAt(headingLine);
	const target = before === null ? null : sectionAt(before);
	if (!section || target === undefined) return null;
	const moved = moveSectionWithLineMap(lines, model, section, target);
	const next = joinLines(moved.lines);
	return next === text ? null : { next, edit: moveEdit(moved.moved) };
}

// A change to one item's title line, such as a star. The edit carries `change` as its `retitle`, so a
// title field with focus makes the same change to its saved line.
export function planItemLineEdit(
	text: string,
	contentStart: number,
	titleLine: number,
	change: (line: string) => string,
): PlannedLineEdit | null {
	const { lines, model } = parse(text, contentStart);
	const line = lines[titleLine];
	if (!line || !itemAt(model, titleLine)) return null;
	const changed = change(line.text);
	if (changed === line.text) return null;
	const next = joinLines(spliceLines(lines, titleLine, 1, [{ text: changed, eol: line.eol }]));
	return { next, edit: { start: titleLine, delta: 0, kind: 'change', retitle: change } };
}

function parse(text: string, contentStart: number): { lines: Line[]; model: ListModel } {
	const lines = splitLines(text);
	return { lines, model: parseList(lines, contentStart) };
}

function sectionAt(model: ListModel, headingLine: number): Section | undefined {
	return model.sections.find((section) => section.headingLine === headingLine);
}

function moveTarget(model: ListModel, place: ItemPlace): MoveTarget | null {
	if (place === 'first') return { firstIn: model.sections[0] as Section };
	if ('after' in place) {
		const item = itemAt(model, place.after);
		return item ? { after: item } : null;
	}
	const section = sectionAt(model, place.firstUnder);
	return section ? { firstIn: section } : null;
}

function insertPlan(text: string, lines: readonly Line[], line: number): PlannedInsert {
	const next = joinLines(lines);
	return { next, line, edit: { ...ownEdit(line, text, next, 'insert'), history: 'new' }, inserted: { textBefore: text, textAfter: next } };
}

// Both run from the line where the deleted lines started.
function deletePlan(text: string, lines: readonly Line[], start: number): PlannedDelete {
	const next = joinLines(lines);
	return {
		next,
		edit: ownEdit(start, text, next, 'delete'),
		undo: { next: text, expected: next, edit: { ...ownEdit(start, next, text, 'insert'), history: 'undo' } },
	};
}
