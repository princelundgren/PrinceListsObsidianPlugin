import { Notice } from 'obsidian';
import { NO_LINES_MOVED, type OwnEdit } from '../core/follow';
import { guardedWrite } from '../core/action-write';
import { RepeatingItemError, UnsafeEditError } from '../core/edit-items';
import type { PrinceListView } from './list-view';

export const UNSAFE_EDIT_NOTICE = "This list's layout can't take that change. Make it in Markdown instead.";
export const CHANGED_ELSEWHERE_NOTICE = 'This list changed elsewhere. Try again.';
export const LOST_TYPING_NOTICE = 'This list changed elsewhere, and your typing in this item may not be in it.';

// A one-off action's write, through guardedWrite. Resolves to whether the file now holds `next`. A
// write that moves lines passes its `edit`, so the view's line-based state follows it. Typing that
// landed while it waited refuses it with no notice: the caller runs the action again on the new text.
export async function writeAction(
	view: PrinceListView,
	next: string,
	expected = view.text,
	refusedNotice: string | null = CHANGED_ELSEWHERE_NOTICE,
	edit: OwnEdit = NO_LINES_MOVED,
): Promise<boolean> {
	const file = view.file;
	if (!file) return false;
	const outcome = await guardedWrite(
		{
			get text() {
				return view.text;
			},
			save: () => view.save(),
			process: (fn) => view.app.vault.process(file, fn),
			sameFile: () => view.file === file,
			took: (text) => view.applyOwnText(text, edit),
		},
		next,
		expected,
	);
	if (outcome === 'refused' && refusedNotice !== null) new Notice(refusedNotice);
	return outcome === 'written';
}

// What the edit returns, or null when the core refused the edit, which writes nothing and says why.
// Any other error is a bug, so it is thrown.
export function tryEdit<T>(edit: () => T): T | null {
	try {
		return edit();
	} catch (error) {
		if (error instanceof RepeatingItemError) {
			new Notice("Repeating items can't be ticked here yet.");
		} else if (error instanceof UnsafeEditError) {
			new Notice(UNSAFE_EDIT_NOTICE);
		} else {
			throw error;
		}
		return null;
	}
}
