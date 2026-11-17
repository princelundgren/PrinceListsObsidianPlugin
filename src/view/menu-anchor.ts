import { Notice, type Menu } from 'obsidian';
import type { TrackedLine } from '../core/editing';
import { whenHidden } from '../core/hide-actions';
import type { PrinceListView } from './list-view';
import { CHANGED_ELSEWHERE_NOTICE } from './write';

/**
 * Follows `line` through the view's edits while `menu` shows: on mobile, the tap that opened it also
 * closed the card, which can remove an empty item above it meanwhile.
 */
export function trackWhileShown(view: PrinceListView, line: number, menu: Menu): TrackedLine {
	const anchor = view.editing.track(line);
	onMenuHide(menu, () => view.editing.untrack(anchor));
	return anchor;
}

/**
 * Runs `action` when `menu` hides, or at once if it already hid, beside the menu's other hide actions:
 * `Menu.onHide` keeps only one.
 */
export function onMenuHide(menu: Menu, action: () => void): void {
	whenHidden(menu, (callback) => menu.onHide(callback), action);
}

/** A menu entry's action on the anchor's line, or a notice when an outside change took the line. */
export function atLine(anchor: TrackedLine, action: (line: number) => void): () => void {
	return () => {
		if (anchor.line === null) new Notice(CHANGED_ELSEWHERE_NOTICE);
		else action(anchor.line);
	};
}
