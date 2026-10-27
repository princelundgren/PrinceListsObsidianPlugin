import { Notice, setIcon } from 'obsidian';
import type { TrackedLine } from '../core/editing';
import { planRemoval, type InsertedItem } from '../core/empty-item';
import { parseItemLine, setTitle } from '../core/item-line';
import { splitLines } from '../core/lines';
import { planItemDelete, planItemInsert, planItemLineEdit, type ItemPlace, type PlannedDelete } from '../core/list-actions';
import { keepStar, splitStar } from '../core/star';
import { contentStartLine } from '../obsidian/marker';
import { followPlace } from './add-button';
import { showUndoNotice } from './delete';
import { fitHeight } from './dom';
import { FIELD_CLASS } from './fields';
import type { ListBlock } from './list-block';
import { ITEM_CLASS, LINE_ATTR } from './render-list';
import { CHANGED_ELSEWHERE_NOTICE, tryEdit } from './write';

export const BLOCK_TRASH_CLASS = 'princelists-block-trash';
export const BLOCK_FIELD_CLASS = 'princelists-block-field';

/** A title being edited in a block. Its line follows the block's writes and outside changes. */
export interface BlockField {
	line: TrackedLine;
	el: HTMLTextAreaElement;
	/** Set when the block's own insert added the item, so closing an empty field removes it again. */
	inserted: InsertedItem | null;
}

// Puts a field in place of the row's title, holding the title without its star (spec, "A list inside
// another note").
export function openBlockField(block: ListBlock, titleLine: number, inserted: InsertedItem | null): void {
	closeBlockField(block, true);
	const titleEl = block.rowsEl.querySelector(`.${ITEM_CLASS}[${LINE_ATTR}="${titleLine}"] .princelists-item-title`);
	if (!titleEl) return;
	const title = parseItemLine(splitLines(block.editing.text)[titleLine]?.text ?? '')?.title ?? '';
	const wrapper = createDiv({ cls: BLOCK_FIELD_CLASS });
	const el = wrapper.createEl('textarea', { cls: FIELD_CLASS, attr: { rows: 1 } });
	el.value = splitStar(title).plain;
	const trash = wrapper.createEl('button', { cls: BLOCK_TRASH_CLASS, attr: { 'aria-label': 'Delete item' } });
	setIcon(trash, 'trash-2');
	titleEl.replaceWith(wrapper);
	block.field = { line: block.editing.track(titleLine), el, inserted };
	fitHeight(el);
	el.focus();
}

// Saves the typed title, or not, then removes an item the field's insert added if it's still empty.
// The block draws again at once, and again once the write lands.
export function closeBlockField(block: ListBlock, save: boolean): void {
	const field = block.field;
	if (!field) return;
	block.field = null;
	const typed = field.el.value.replace(/\s*\n\s*/g, ' ');
	block.draw();
	void block.enqueue(async () => {
		try {
			const line = field.line.line;
			if (line === null) {
				if (save) new Notice(CHANGED_ELSEWHERE_NOTICE);
				return;
			}
			if (save) await saveTitle(block, line, typed);
			if (field.inserted && field.line.line !== null) await removeIfEmpty(block, field.line.line, field.inserted);
		} finally {
			block.editing.untrack(field.line);
			if (!block.field) block.draw();
		}
	});
}

// Saves an open field, then adds an empty item at `place` and opens its field.
export function addBlockItem(block: ListBlock, place: ItemPlace): void {
	const anchor = place === 'first' ? null : 'after' in place ? place.after : place.firstUnder;
	const pending = anchor === null ? null : block.editing.track(anchor);
	closeBlockField(block, true);
	void block.enqueue(async () => {
		try {
			const followed = followPlace(place, pending?.line ?? null);
			const text = block.editing.text;
			const planned = followed && tryEdit(() => planItemInsert(text, contentStartLine(text), followed));
			if (!planned || (await block.write(planned.next, text, planned.edit)) !== 'written') return;
			block.draw();
			openBlockField(block, planned.line, planned.inserted);
		} finally {
			if (pending) block.editing.untrack(pending);
		}
	});
}

// Shift+Enter: on an empty item the field added, it only closes the field, which removes the item.
export function addBlockItemBelow(block: ListBlock): void {
	const field = block.field;
	const line = field?.line.line;
	if (!field || line === null || line === undefined) return;
	if (field.inserted && field.el.value.trim() === '') closeBlockField(block, true);
	else addBlockItem(block, { after: line });
}

// The field's typed title isn't saved first **(call)**: the item goes, and Undo brings back the item as
// it was in the file.
export function deleteBlockItem(block: ListBlock, titleLine: number): void {
	const field = block.field;
	if (field?.line.line === titleLine) {
		if (field.inserted) {
			closeBlockField(block, false);
			return;
		}
		block.field = null;
		block.editing.untrack(field.line);
	}
	const pending = block.editing.track(titleLine);
	const file = block.file;
	void block.enqueue(async () => {
		try {
			const line = pending.line;
			const text = block.editing.text;
			if (line === null || block.file !== file) {
				new Notice(CHANGED_ELSEWHERE_NOTICE);
				return;
			}
			const deleted = tryEdit(() => planItemDelete(text, contentStartLine(text), line));
			if (!deleted || (await block.write(deleted.next, text, deleted.edit)) !== 'written') return;
			showUndoNotice('Item deleted.', () => void block.enqueue(() => undoDelete(block, file, deleted.undo)));
		} finally {
			block.editing.untrack(pending);
			if (!block.field) block.draw();
		}
	});
}

async function saveTitle(block: ListBlock, titleLine: number, typed: string): Promise<void> {
	const text = block.editing.text;
	const planned = tryEdit(() =>
		planItemLineEdit(text, contentStartLine(text), titleLine, (line) => setTitle(line, keepStar(parseItemLine(line)?.title ?? '', typed))),
	);
	if (planned) await block.write(planned.next, text, planned.edit);
}

async function removeIfEmpty(block: ListBlock, titleLine: number, inserted: InsertedItem): Promise<void> {
	const text = block.editing.text;
	const removal = tryEdit(() => planRemoval(text, contentStartLine(text), titleLine, inserted));
	if (removal) await block.write(removal.next, removal.expected, removal.edit);
}

// Only while the list still holds what the delete left, as in the list view.
async function undoDelete(block: ListBlock, file: ListBlock['file'], undo: PlannedDelete['undo']): Promise<void> {
	if (block.file !== file || block.editing.text !== undo.expected) {
		new Notice("This list changed since the delete, so it can't be undone.");
		return;
	}
	if ((await block.write(undo.next, undo.expected, undo.edit)) === 'written') block.draw();
}
