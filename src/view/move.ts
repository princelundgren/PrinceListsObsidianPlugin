import { Notice } from 'obsidian';
import type { Drop, ShownRow } from '../core/drop';
import { planItemMove, type ItemPlace } from '../core/list-actions';
import { contentStartLine } from '../obsidian/marker';
import { followPlace } from './add-button';
import type { PrinceListView } from './list-view';
import { HEADING_CLASS, ITEM_CLASS, LINE_ATTR, lineOf } from './render-list';
import { CHANGED_ELSEWHERE_NOTICE, writePlanned } from './write';

const DROP_ABOVE = 'princelists-drop-above';
const DROP_BELOW = 'princelists-drop-below';

// In the order they show. Every row and heading carries its line, and hidden rows aren't drawn.
export function shownRows(listEl: HTMLElement): ShownRow[] {
	return Array.from(listEl.querySelectorAll<HTMLElement>(`[${LINE_ATTR}]`), (el) => ({
		line: lineOf(el) as number,
		kind: el.hasClass(HEADING_CLASS) ? 'heading' : el.hasClass(ITEM_CLASS) ? 'item' : 'untouched',
	}));
}

// Takes the drop line off `marked` and shows it for `drop`. Returns the element that shows it now.
export function markDrop(listEl: HTMLElement, marked: HTMLElement | null, drop: Drop | null): HTMLElement | null {
	marked?.removeClass(DROP_ABOVE, DROP_BELOW);
	if (!drop) return null;
	const next = listEl.querySelector<HTMLElement>(`[${LINE_ATTR}="${drop.line}"]`);
	next?.addClass(drop.above ? DROP_ABOVE : DROP_BELOW);
	return next;
}

// The move waits on the view's write queue, and its item and place follow the edits that land before
// it runs.
export function queueMove(view: PrinceListView, line: number, place: ItemPlace): void {
	const file = view.file;
	if (!file) return;
	const item = view.editing.track(line);
	const anchor = place === 'first' ? null : view.editing.track('after' in place ? place.after : place.firstUnder);
	void view.enqueue(async () => {
		try {
			if (view.viewClosed || view.file !== file) return;
			if (item.line === null || anchor?.line === null) {
				new Notice(CHANGED_ELSEWHERE_NOTICE);
				return;
			}
			const moved = await writePlanned(view, (text) => {
				const to = followPlace(place, anchor?.line ?? null);
				return item.line === null || !to ? null : planItemMove(text, contentStartLine(text), item.line, to);
			});
			// Obsidian's echo of the write returns early in setViewData, so the view draws the move.
			if (moved) view.render();
		} finally {
			view.editing.untrack(item);
			if (anchor) view.editing.untrack(anchor);
		}
	});
}
