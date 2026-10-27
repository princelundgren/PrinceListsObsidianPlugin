import type { HistoryWrite } from '../core/history';
import { closeCard, isNewEmptyItem } from './card';
import { targetOf } from './dom';
import type { PrinceListView } from './list-view';
import { enqueueAt, writeAction } from './write';

// Cmd+Z and Cmd+Shift+Z while the view has focus (spec, "Saving, outside changes, sync conflicts,
// undo"). Each returns false, so Obsidian cancels the key's default, or true to leave the key to a
// field.
export function undoKey(view: PrinceListView, evt: KeyboardEvent): boolean {
	if (isInField(evt)) return true;
	// Closing the card removes the item, which is the undo of adding it.
	if (isNewEmptyItem(view)) closeCard(view);
	else writeStep(view, (text) => view.editing.history.undo(text), "This list changed elsewhere, so it can't be undone.");
	return false;
}

export function redoKey(view: PrinceListView, evt: KeyboardEvent): boolean {
	if (isInField(evt)) return true;
	writeStep(view, (text) => view.editing.history.redo(text), "This list changed elsewhere, so it can't be redone.");
	return false;
}

// A field keeps the browser's undo: the view's fields, and Obsidian's under the same scope, such as the pane's title.
function isInField(evt: KeyboardEvent): boolean {
	const target = targetOf(evt);
	if (!target) return false;
	if (target.instanceOf(HTMLInputElement)) return target.type !== 'checkbox';
	return target.instanceOf(HTMLTextAreaElement) || target.isContentEditable;
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
