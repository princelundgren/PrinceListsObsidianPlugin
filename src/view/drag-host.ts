import { Platform, type Component } from 'obsidian';
import type { TrackedLine } from '../core/editing';
import { closeCard } from './card';
import type { PrinceListView } from './list-view';
import { queueDrop, type RowDrop } from './move';
import { clearSelection, selectOnHold } from './select';

/** On the row a dragged selection lifts: how many rows it carries, which styles.css draws. */
export const COUNT_ATTR = 'data-princelists-count';

/** What dragging rows needs from the list view or a block showing a list. */
export interface RowDragHost {
	/** Owns the drag's listeners. */
	readonly component: Component;
	/** Holds every row and heading that drags. */
	readonly rowsEl: HTMLElement;
	/** The scroller a touch drag scrolls at its edges, and the element whose top is where it stops being visible. */
	readonly edgeScroll: { scrollEl: HTMLElement; visibleBottomEl: HTMLElement } | null;
	/** The scroller a lift scrolls to keep the row in place, or null where it is Obsidian's, as in a note. */
	readonly liftScrollEl: HTMLElement | null;
	readonly dragsHeadings: boolean;
	/** Set when a row lifts, so the click that ends the press isn't a tap. */
	swallowNextClick: boolean;
	beforeLift(): void;
	/** The dragged row's line as the drawn rows number it, which the drop is aimed with; null once it can't drop, such as when the row is gone or, in a block, after any draw. */
	track(line: number): TrackedLine;
	untrack(tracked: TrackedLine): void;
	/**
	 * The lines a drag from the row on `line` carries, `line` among them: the selection's while that
	 * row is one of two or more selected, else `[line]`, which ends the host's selection.
	 */
	dragged(line: number): readonly number[];
	/** Moves the dragged row on `line`, both it and `drop` as the drawn rows number them. */
	drop(line: number, drop: RowDrop): void;
	/** A row lifted on `line` and let go without moving: selects it, or nothing where rows don't select. */
	selectHold(line: number): void;
}

// Only the touch drag scrolls at the edges, so only mobile gets the element that marks the bottom one.
export function listDragHost(view: PrinceListView): RowDragHost {
	// The item whose card the latest lift closed, which a hold let go selects with the held row; only a
	// touch hold selects, so only mobile keeps it.
	let cardItem: TrackedLine | null = null;
	const forgetCardItem = (): void => {
		if (cardItem) view.editing.untrack(cardItem);
		cardItem = null;
	};
	return {
		component: view,
		rowsEl: view.listScrollEl,
		edgeScroll: Platform.isMobile ? { scrollEl: view.listScrollEl, visibleBottomEl: visibleBottom(view) } : null,
		liftScrollEl: view.listScrollEl,
		dragsHeadings: true,
		get swallowNextClick() {
			return view.swallowNextClick;
		},
		set swallowNextClick(value: boolean) {
			view.swallowNextClick = value;
		},
		beforeLift: () => {
			forgetCardItem();
			const line = Platform.isMobile && view.card ? view.selected : null;
			cardItem = line === null ? null : view.editing.track(line);
			closeCard(view);
		},
		track: (line) => view.editing.track(line),
		untrack: (tracked) => view.editing.untrack(tracked),
		dragged: (line) => {
			const selected = view.selection.linesWith(line);
			if (selected) return selected;
			clearSelection(view);
			return [line];
		},
		drop: (line, drop) => {
			forgetCardItem();
			queueDrop(view, line, drop);
		},
		selectHold: (line) => {
			const card = cardItem?.line ?? null;
			forgetCardItem();
			selectOnHold(view, line, card);
		},
	};
}

/**
 * Closes what a lift closes (`beforeLift`), then scrolls `liftScrollEl` by however far that moved
 * `row`, such as a taller card above it closing, so the row stays under the pointer as far as the
 * scroller can go.
 */
export function liftInPlace(host: RowDragHost, row: HTMLElement): void {
	const rowTop = row.getBoundingClientRect().top;
	host.beforeLift();
	if (host.liftScrollEl && row.isConnected) host.liftScrollEl.scrollTop += row.getBoundingClientRect().top - rowTop;
}

// Its top is where the list stops being visible: mobile's floating navbar covers the bottom of the
// view, and Obsidian puts its height in --view-bottom-spacing.
function visibleBottom(view: PrinceListView): HTMLElement {
	return view.containerEl.createDiv({ cls: 'princelists-visible-bottom' });
}
