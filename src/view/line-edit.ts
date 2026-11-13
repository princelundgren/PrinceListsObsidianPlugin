import { Notice } from 'obsidian';
import { splitLines } from '../core/lines';
import { planItemLineEdit } from '../core/list-actions';
import { removeWhen } from '../core/repeat-line';
import { contentStartLine } from '../obsidian/marker';
import type { PrinceListView } from './list-view';
import { CHANGED_ELSEWHERE_NOTICE, enqueueAt, writePlanned } from './write';

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

/** What a draft was made from: the item's line as it read, and the view's outside changes then. */
export interface DraftBase {
	text: string;
	seen: number;
}

// queueLineEdit for a change made from a draft of the line. If the line no longer reads as the draft's
// `base` did, or an outside change came since, nothing is written: the notice says so and `refused` runs.
export function queueDraftEdit(
	view: PrinceListView,
	titleLine: number,
	base: DraftBase,
	change: (line: string) => string,
	then: { written?: () => void; refused?: (line: number) => void },
): void {
	enqueueAt(view, titleLine, async (pending) => {
		let stale = false;
		let staleAt = 0;
		const written = await writePlanned(view, (text) => {
			if (pending?.line == null) return null;
			staleAt = pending.line;
			stale = view.outsideChanges !== base.seen || splitLines(text)[pending.line]?.text !== base.text;
			return stale ? null : planItemLineEdit(text, contentStartLine(text), pending.line, change);
		});
		if (stale) {
			new Notice(CHANGED_ELSEWHERE_NOTICE);
			then.refused?.(staleAt);
		} else if (written) {
			view.render();
			then.written?.();
		}
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
