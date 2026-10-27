import { Platform, type Component } from 'obsidian';
import type { TrackedLine } from '../core/editing';
import { closeCard } from './card';
import type { PrinceListView } from './list-view';
import { queueDrop, type RowDrop } from './move';

/** What dragging rows needs from the list view or a block showing a list. */
export interface RowDragHost {
	/** Owns the drag's listeners. */
	readonly component: Component;
	/** Holds every row and heading that drags. */
	readonly rowsEl: HTMLElement;
	/** The scroller a touch drag scrolls at its edges, and the element whose top is where it stops being visible. */
	readonly edgeScroll: { scrollEl: HTMLElement; visibleBottomEl: HTMLElement } | null;
	readonly dragsHeadings: boolean;
	/** Set when a row lifts, so the click that ends the press isn't a tap. */
	swallowNextClick: boolean;
	beforeLift(): void;
	track(line: number): TrackedLine;
	untrack(tracked: TrackedLine): void;
	drop(line: number, drop: RowDrop): void;
}

// Only the touch drag scrolls at the edges, so only mobile gets the element that marks the bottom one.
export function listDragHost(view: PrinceListView): RowDragHost {
	return {
		component: view,
		rowsEl: view.listScrollEl,
		edgeScroll: Platform.isMobile ? { scrollEl: view.listScrollEl, visibleBottomEl: visibleBottom(view) } : null,
		dragsHeadings: true,
		get swallowNextClick() {
			return view.swallowNextClick;
		},
		set swallowNextClick(value: boolean) {
			view.swallowNextClick = value;
		},
		beforeLift: () => closeCard(view),
		track: (line) => view.editing.track(line),
		untrack: (tracked) => view.editing.untrack(tracked),
		drop: (line, drop) => queueDrop(view, line, drop),
	};
}

// Its top is where the list stops being visible: mobile's floating navbar covers the bottom of the
// view, and Obsidian puts its height in --view-bottom-spacing.
function visibleBottom(view: PrinceListView): HTMLElement {
	return view.containerEl.createDiv({ cls: 'princelists-visible-bottom' });
}
