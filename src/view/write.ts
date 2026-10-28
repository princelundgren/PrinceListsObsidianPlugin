import { Notice } from 'obsidian';
import { NO_LINES_MOVED, type OwnEdit } from '../core/follow';
import { guardedWrite, planAndWrite, type WriteResult } from '../core/action-write';
import type { TrackedLine } from '../core/editing';
import { RepeatingItemError, UnsafeEditError } from '../core/edit-items';
import type { PrinceListView } from './list-view';

export const UNSAFE_EDIT_NOTICE = "This list's layout can't take that change. Make it in Markdown instead.";
export const CHANGED_ELSEWHERE_NOTICE = 'This list changed elsewhere. Try again.';
export const SAVE_FAILED_NOTICE = "Couldn't save the change to this list.";
export const LOST_TYPING_NOTICE = 'This list changed elsewhere, and what you typed may not be in it.';

// Obsidian hides a notice on any click, so the whole message copies, not only the button.
export function showLostTypingNotice(win: Window, typed: string): void {
	const message = createFragment((fragment) => {
		const content = fragment.createDiv();
		content.createEl('p', { text: LOST_TYPING_NOTICE });
		content.createEl('button', { text: 'Copy text' });
		content.addEventListener(
			'click',
			() => {
				win.navigator.clipboard.writeText(typed).then(
					() => new Notice('Copied.'),
					() => new Notice("Couldn't copy the text."),
				);
			},
			{ once: true },
		);
	});
	new Notice(message, 0);
}

// A one-off action's write, through guardedWrite. `written`: the file now holds `next`. A write that
// moves lines passes its `edit`, so the view's line-based state follows it. Typing that landed while
// it waited refuses it with no notice: the caller runs the action again on the new text, but not an
// undo or a redo. A write that fails says so, and the view reads the file again if it still holds the
// text it took; the caller doesn't run it again.
export async function writeAction(
	view: PrinceListView,
	next: string,
	expected = view.text,
	refusedNotice: string | null = CHANGED_ELSEWHERE_NOTICE,
	edit: OwnEdit = NO_LINES_MOVED,
): Promise<WriteResult> {
	const file = view.file;
	if (!file) return 'refused';
	const outcome = await guardedWrite(
		{
			get text() {
				return view.text;
			},
			save: () => view.save(),
			process: (fn) => view.app.vault.process(file, fn),
			sameFile: () => view.file === file,
			took: (text) => view.applyOwnText(text, edit),
			reread: async () => {
				const text = await view.app.vault.read(file);
				if (!view.viewClosed && view.file === file) view.setViewData(text, false);
			},
		},
		next,
		expected,
	).catch((error: unknown) => {
		console.error(error);
		new Notice(SAVE_FAILED_NOTICE);
		return 'failed' as const;
	});
	if (outcome === 'refused' && refusedNotice !== null) new Notice(refusedNotice);
	return outcome === 'typed' ? 'refused' : outcome;
}

// Runs an action on the view's write queue. `line`, its item or heading, follows the view's own edits
// and outside changes while it waits. With another file in the view, or none, the action is moot and
// nothing runs. A line an outside change took shows the notice, as a silent drop would look like a
// lost tap.
export function enqueueAt(view: PrinceListView, line: number | null, task: (pending: TrackedLine | null) => Promise<void>): void {
	const file = view.file;
	if (!file) return;
	const pending = line === null ? null : view.editing.track(line);
	void view.enqueue(async () => {
		try {
			if (view.viewClosed || view.file !== file) return;
			if (pending?.line === null) {
				new Notice(CHANGED_ELSEWHERE_NOTICE);
				return;
			}
			await task(pending);
		} finally {
			if (pending) view.editing.untrack(pending);
		}
	});
}

// planAndWrite, for the file the view shows now.
export function writePlanned<T extends { next: string; edit: OwnEdit }>(
	view: PrinceListView,
	plan: (text: string) => T | null,
): Promise<T | null> {
	const file = view.file;
	return planAndWrite(
		{
			get text() {
				return view.text;
			},
			sameFile: () => view.file === file,
			write: (planned, expected) => writeAction(view, planned.next, expected, undefined, planned.edit),
		},
		(text) => tryEdit(() => plan(text)),
	);
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
