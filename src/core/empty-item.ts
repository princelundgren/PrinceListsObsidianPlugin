import { deleteItem, getItemNotes } from './edit-items';
import { ownEdit, type OwnEdit } from './follow';
import { parseItemLine } from './item-line';
import { joinLines, splitLines, type Line } from './lines';
import { itemAt, parseList, type ItemBlock } from './parse';

/** The file's text on either side of the insert that created a card's item. */
export interface InsertedItem {
	textBefore: string;
	textAfter: string;
}

export interface Removal {
	next: string;
	/** The text the write's guard expects to find. */
	expected: string;
	edit: OwnEdit;
}

// Nothing after the checkbox and no notes. A typed tag or date counts as typed, though the item line
// reads it as the tail.
export function isEmptyItem(lines: readonly Line[], item: ItemBlock): boolean {
	const parts = parseItemLine((lines[item.titleLine] as Line).text);
	return parts !== null && (parts.title + parts.marks + parts.tail).trim() === '' && getItemNotes(lines, item) === '';
}

// How closing the card removes the empty item it created at `titleLine` (spec, "Selecting and
// adding"). While the text is still what the insert left, it goes back to the text from before the
// insert, which also takes away an empty line the insert wrote and deleteItem would leave. Once
// anything changed, or after that restore was refused, the item is deleted from `text`. null when the
// item isn't there or isn't empty. Throws UnsafeEditError when deleting it would change how the rest
// reads.
export function planRemoval(
	text: string,
	contentStart: number,
	titleLine: number,
	inserted: InsertedItem,
	restore = true,
): Removal | null {
	const lines = splitLines(text);
	const model = parseList(lines, contentStart);
	const item = itemAt(model, titleLine);
	if (!item || !isEmptyItem(lines, item)) return null;
	const next = restore && text === inserted.textAfter ? inserted.textBefore : joinLines(deleteItem(lines, model, item));
	return { next, expected: text, edit: { ...ownEdit(titleLine, text, next, 'delete'), history: 'cancel' } };
}
