import { Notice } from 'obsidian';
import { planItemLineEdit } from '../core/list-actions';
import { removeWhen } from '../core/repeat-line';
import { contentStartLine } from '../obsidian/marker';
import type { PrinceListView } from './list-view';
import { enqueueAt, writePlanned } from './write';

// A change to one item's title line, such as a star, on the view's write queue.
export function queueLineEdit(view: PrinceListView, titleLine: number, change: (line: string) => string, afterWrite?: () => void): void {
	enqueueAt(view, titleLine, async (pending) => {
		const written = await writePlanned(view, (text) =>
			pending?.line == null ? null : planItemLineEdit(text, contentStartLine(text), pending.line, change),
		);
		// Obsidian's echo of the write returns early in setViewData, so the view draws the change.
		if (!written) return;
		view.render();
		afterWrite?.();
	});
}

export const REPEAT_REMOVED_NOTICE = 'The repeat was removed with the date.';

// Clearing an item's date, which also ends a repeat left with no date to repeat from.
export function queueRemoveWhen(view: PrinceListView, titleLine: number): void {
	// Set by the last planning run of `change`, and read only after that write succeeded.
	let repeatRemoved = false;
	queueLineEdit(
		view,
		titleLine,
		(text) => {
			const removed = removeWhen(text);
			repeatRemoved = removed.repeatRemoved;
			return removed.line;
		},
		() => {
			if (repeatRemoved) new Notice(REPEAT_REMOVED_NOTICE);
		},
	);
}
