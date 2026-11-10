import type { HistoryWrite } from '../core/history';
import { closeCard, isNewEmptyItem } from './card';
import { TAG_INPUT_CLASS } from './card-tags';
import { targetOf } from './dom';
import { stepField } from './field-undo';
import type { PrinceListView } from './list-view';
import { enqueueAt, writeAction } from './write';

/** Said when the list's last edit can't be taken back. */
export const CANT_UNDO_NOTICE = "This list changed elsewhere, so it can't be undone.";

// Cmd+Z and Cmd+Shift+Z while the view has focus (spec, "Saving, outside changes, sync conflicts,
// undo"). Each returns false, so Obsidian cancels the key's default, or true to leave the key to a
// field.
export function undoKey(view: PrinceListView, evt: KeyboardEvent): boolean {
	if (stepFieldAt(evt, 'undo')) return false;
	if (isInField(evt)) return true;
	// Closing the card removes the item, which is the undo of adding it.
	if (isNewEmptyItem(view)) closeCard(view);
	else undoStep(view);
	return false;
}

/** Takes the list's last edit back, as Cmd+Z does outside a field, on the view's write queue. */
export function undoStep(view: PrinceListView): void {
	writeStep(view, (text) => view.editing.history.undo(text), CANT_UNDO_NOTICE);
}

export function redoKey(view: PrinceListView, evt: KeyboardEvent): boolean {
	if (stepFieldAt(evt, 'redo')) return false;
	if (isInField(evt)) return true;
	writeStep(view, (text) => view.editing.history.redo(text), "This list changed elsewhere, so it can't be redone.");
	return false;
}

function stepFieldAt(evt: KeyboardEvent, direction: 'undo' | 'redo'): boolean {
	const target = targetOf(evt);
	return target?.instanceOf(HTMLTextAreaElement) === true && stepField(target, direction);
}

// A field keeps the browser's undo: the view's fields, and Obsidian's under the same scope, such as the pane's title.
// An empty tag input has no typing to undo, so the key undoes the list's last edit, such as a tag it added.
function isInField(evt: KeyboardEvent): boolean {
	const target = targetOf(evt);
	if (!target) return false;
	if (target.instanceOf(HTMLInputElement)) return target.type !== 'checkbox' && !isEmptyTagInput(target);
	return target.instanceOf(HTMLTextAreaElement) || target.isContentEditable;
}

function isEmptyTagInput(input: HTMLInputElement): boolean {
	return input.hasClass(TAG_INPUT_CLASS) && input.value === '';
}

function writeStep(view: PrinceListView, step: (text: string) => HistoryWrite | null, notice: string): void {
	enqueueAt(view, null, async () => {
		const write = step(view.text);
		if (!write) return;
		const result = await writeAction(view, write.next, view.text, notice, write.edit);
		// Obsidian's echo of the write returns early in setViewData, so the view draws the change.
		if (result === 'written') view.render();
	});
}
