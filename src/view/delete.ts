import { Notice, type TFile } from 'obsidian';
import { planHeadingDelete, planItemDelete, type PlannedDelete } from '../core/list-actions';
import { contentStartLine } from '../obsidian/marker';
import { closeCard, isNewEmptyItem } from './card';
import type { PrinceListView } from './list-view';
import { enqueueAt, writeAction, writePlanned } from './write';

// Delete on an item. An empty item the open card added is closed instead, which removes it: that is a
// cancel, with no Undo (spec, "Selecting and adding").
export function deleteItemAt(view: PrinceListView, titleLine: number): void {
	if (isNewEmptyItem(view, titleLine)) closeCard(view);
	else deleteWithUndo(view, titleLine, planItemDelete, 'Item deleted.');
}

export function deleteHeadingAt(view: PrinceListView, headingLine: number): void {
	deleteWithUndo(view, headingLine, planHeadingDelete, 'Heading deleted.');
}

function deleteWithUndo(
	view: PrinceListView,
	line: number,
	plan: (text: string, contentStart: number, line: number) => PlannedDelete | null,
	message: string,
): void {
	const file = view.file;
	enqueueAt(view, line, async (pending) => {
		const deleted = await writePlanned(view, (text) => {
			const at = pending?.line ?? null;
			return at === null ? null : plan(text, contentStartLine(text), at);
		});
		if (!deleted || !file) return;
		// Obsidian's echo of the write returns early in setViewData, so the view draws the change.
		view.render();
		offerUndo(view, file, deleted.undo, message);
	});
}

function offerUndo(view: PrinceListView, file: TFile, undo: PlannedDelete['undo'], message: string): void {
	showUndoNotice(message, () => void view.enqueue(() => undoDelete(view, file, undo)));
}

// A notice with an Undo button for a few seconds (spec, "Item actions").
export function showUndoNotice(message: string, onUndo: () => void): void {
	const fragment = createFragment();
	fragment.createSpan({ text: message });
	const button = fragment.createEl('button', { cls: 'princelists-undo', text: 'Undo' });
	new Notice(fragment, 6000);
	// Not delegated or registered: the notice isn't in a view, and this listener goes with its button.
	button.addEventListener('click', onUndo, { once: true });
}

// Writes the text from before the delete back, only while the file still holds what the delete left.
// Any refusal gets this notice rather than writeAction's: trying again can't succeed once the list has
// changed, and typing that lands while it writes has changed it too. A write that failed has said so.
async function undoDelete(view: PrinceListView, file: TFile, undo: PlannedDelete['undo']): Promise<void> {
	const sameFile = !view.viewClosed && view.file === file;
	// Cmd+Z already undid the delete.
	if (sameFile && view.text === undo.next) return;
	const result = sameFile ? await writeAction(view, undo.next, undo.expected, null, undo.edit) : 'refused';
	if (result === 'written') view.render();
	else if (result === 'refused') new Notice("This list changed since the delete, so it can't be undone.");
}
