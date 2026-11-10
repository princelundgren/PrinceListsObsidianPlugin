import { Notice } from 'obsidian';
import type { PlannedGroupEdit } from '../core/group-actions';
import { contentStartLine } from '../obsidian/marker';
import { showUndoNotice } from './delete';
import type { PrinceListView } from './list-view';
import { CANT_UNDO_NOTICE, undoNow } from './undo';
import { CHANGED_ELSEWHERE_NOTICE, writePlanned } from './write';

/**
 * Shows `message` with an Undo button that takes the list's last edit back, as Cmd+Z does, while that
 * edit is still the action's: the list holds `after`, the text the action left, and Cmd+Z would bring
 * back `before`. It does nothing once the list holds `before` again, as after Cmd+Z, and on any other
 * change, a later edit that left the same text included, says it can't be undone. The check and the
 * undo run in one slot of the view's write queue, so a write queued before the click lands first.
 */
export function offerGroupUndo(view: PrinceListView, message: string, before: string, after: string): void {
	const file = view.file;
	showUndoNotice(message, () =>
		void view.enqueue(async () => {
			const sameFile = !view.viewClosed && view.file === file;
			if (sameFile && view.text === before) return;
			if (sameFile && view.text === after && view.editing.history.undo(after)?.next === before) await undoNow(view);
			else new Notice(CANT_UNDO_NOTICE);
		}),
	);
}

/**
 * Runs an action on several rows on the view's write queue, as one write. `rows` follow the view's
 * own edits and outside changes while it waits, and `plan` gets them at their lines then; a row that
 * went writes nothing and says so. After a write the view draws it and offers `message(written)`
 * with an Undo button.
 */
export function queueGroupAction<T extends PlannedGroupEdit>(
	view: PrinceListView,
	rows: readonly number[],
	plan: (text: string, contentStart: number, rows: readonly number[]) => T | null,
	message: (written: T) => string,
): void {
	const file = view.file;
	if (!file) return;
	const tracked = rows.map((line) => view.editing.track(line));
	const linesNow = () => {
		const lines = tracked.map((row) => row.line);
		return lines.includes(null) ? null : (lines as number[]);
	};
	void view.enqueue(async () => {
		try {
			if (view.viewClosed || view.file !== file) return;
			if (!linesNow()) {
				new Notice(CHANGED_ELSEWHERE_NOTICE);
				return;
			}
			// The text the written plan was made from: a rerun after typing plans again.
			let before = view.text;
			const written = await writePlanned(view, (text) => {
				before = text;
				const lines = linesNow();
				return lines && plan(text, contentStartLine(text), lines);
			});
			if (!written) return;
			// Obsidian's echo of the write returns early in setViewData, so the view draws the change.
			view.render();
			offerGroupUndo(view, message(written), before, written.next);
		} finally {
			for (const row of tracked) view.editing.untrack(row);
		}
	});
}
