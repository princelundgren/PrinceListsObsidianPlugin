import { Notice } from 'obsidian';
import { guardedApply } from '../core/guard';
import { RepeatingItemError, UnsafeEditError } from '../core/edit-items';
import type { Line } from '../core/lines';
import type { PrinceListView } from './list-view';

// A one-off action's write (spec, "Saving, outside changes, sync conflicts, undo"). Pending typing
// is saved first, so the guard doesn't refuse over the view's own text. Resolves to whether the file
// now holds `next`.
export async function writeAction(
	view: PrinceListView,
	next: string,
	expected = view.text,
	refusedNotice: string | null = 'This list changed elsewhere. Try again.',
): Promise<boolean> {
	const file = view.file;
	if (!file) return false;
	await view.save();
	let written = false;
	await view.app.vault.process(file, (current) => {
		const result = guardedApply(current, expected, next);
		written = result === next;
		// Set here, before Obsidian's modify echo reaches setViewData, so its early return holds. Not
		// when the view moved to another file meanwhile: it would save this text into that file.
		if (written && view.file === file) view.text = next;
		return result;
	});
	if (!written && refusedNotice !== null) new Notice(refusedNotice);
	return written;
}

// The edited lines, or null when the core refused the edit, which writes nothing and says why.
// Any other error is a bug, so it is thrown.
export function tryEdit(edit: () => Line[]): Line[] | null {
	try {
		return edit();
	} catch (error) {
		if (error instanceof RepeatingItemError) {
			new Notice("Repeating items can't be ticked here yet.");
		} else if (error instanceof UnsafeEditError) {
			new Notice("This list's layout can't take that change. Make it in Markdown instead.");
		} else {
			throw error;
		}
		return null;
	}
}
