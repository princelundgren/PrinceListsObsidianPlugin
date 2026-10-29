import { Notice, type Menu } from 'obsidian';
import type { TrackedLine } from '../core/editing';
import type { PrinceListView } from './list-view';
import { CHANGED_ELSEWHERE_NOTICE } from './write';

/**
 * Follows `line` through the view's edits while `menu` shows: on mobile, the tap that opened it also
 * closed the card, which can remove an empty item above it meanwhile.
 */
export function trackWhileShown(view: PrinceListView, line: number, menu: Menu): TrackedLine {
	const anchor = view.editing.track(line);
	menu.onHide(() => view.editing.untrack(anchor));
	return anchor;
}

/** A menu entry's action on the anchor's line, or a notice when an outside change took the line. */
export function atLine(anchor: TrackedLine, action: (line: number) => void): () => void {
	return () => {
		if (anchor.line === null) new Notice(CHANGED_ELSEWHERE_NOTICE);
		else action(anchor.line);
	};
}
