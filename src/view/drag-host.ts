import { Platform, type Component } from 'obsidian';
import type { TrackedLine } from '../core/editing';
import { closeCard } from './card';
import type { PrinceListView } from './list-view';
import { queueDrop, type RowDrop } from './move';
import { clearSelection, selectOnHold } from './select';
import { shownSelectionBar } from './selection-bar';

/** On the row a dragged selection lifts: how many rows it carries, which styles.css draws. */
export const COUNT_ATTR = 'data-princelists-count';

/** What dragging rows needs from the list view or a block showing a list. */
export interface RowDragHost {
	/** Owns the drag's listeners. */
	readonly component: Component;
	/** Holds every row and heading that drags. */
	readonly rowsEl: HTMLElement;
	/** The scroller a touch drag scrolls at its edges, and the element whose top is where it stops being visible, read on each step. */
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
	 * The selection's lines, `line` among them, when the row on `line` is selected, which a drag from it
	 * carries; otherwise null. Changes nothing, so a drag can ask during `dragstart`.
	 */
	dragged(line: number): readonly number[] | null;
	/** Ends the host's selection, for a drag of a row outside it; nothing where rows don't select. */
	endSelection(): void;
	/** Moves the dragged row on `line`, both it and `drop` as the drawn rows number them. */
	drop(line: number, drop: RowDrop): void;
	/** A row lifted on `line`: selects it, or nothing where rows don't select. */
	selectHold(line: number): void;
}

// Only the touch drag scrolls at the edges, so only mobile gets the element that marks the bottom one.
export function listDragHost(view: PrinceListView): RowDragHost {
	// The item whose card the latest lift closed, which a touch hold selects with the held row; a mouse
	// hold closes the card itself (hold-mouse.ts), so only mobile keeps it.
	let cardItem: TrackedLine | null = null;
	const forgetCardItem = (): void => {
		if (cardItem) view.editing.untrack(cardItem);
		cardItem = null;
	};
	return {
		component: view,
		rowsEl: view.listScrollEl,
		edgeScroll: Platform.isMobile ? listEdgeScroll(view) : null,
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
		dragged: (line) => view.selection.linesWith(line),
		endSelection: () => clearSelection(view),
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
 * Asks `host` whether a drag from `rowEl`, on `line`, carries the selection, and tracks its rows other
 * than `line`. When there are any, marks `rowEl` with how many rows it carries. Returns them, empty for
 * a selection of that row alone, for the drag to untrack when it ends; null when the row isn't selected.
 */
export function carry(host: RowDragHost, line: number, rowEl: HTMLElement): TrackedLine[] | null {
	const carried = host.dragged(line);
	if (!carried) return null;
	const others = carried.filter((other) => other !== line).map((other) => host.track(other));
	if (others.length > 0) rowEl.setAttr(COUNT_ATTR, String(carried.length));
	return others;
}

/**
 * Runs `close`, which closes what the lift closes, then scrolls `scrollEl` by however far that moved
 * `row`, such as a taller card above it closing or the selection bar's room below the last row going,
 * so the row stays under the pointer as far as the scroller can go. A null `scrollEl` scrolls nothing.
 */
export function liftInPlace(scrollEl: HTMLElement | null, row: HTMLElement, close: () => void): void {
	const rowTop = row.getBoundingClientRect().top;
	close();
	if (scrollEl && row.isConnected) scrollEl.scrollTop += row.getBoundingClientRect().top - rowTop;
}

// While selecting, the list stops being visible at the selection's bar, which sits above the marker.
function listEdgeScroll(view: PrinceListView): NonNullable<RowDragHost['edgeScroll']> {
	const marker = visibleBottom(view);
	return {
		scrollEl: view.listScrollEl,
		get visibleBottomEl() {
			return shownSelectionBar(view) ?? marker;
		},
	};
}

// Its top is where the list stops being visible: mobile's floating navbar covers the bottom of the
// view, and Obsidian puts its height in --view-bottom-spacing.
function visibleBottom(view: PrinceListView): HTMLElement {
	return view.containerEl.createDiv({ cls: 'princelists-visible-bottom' });
}
