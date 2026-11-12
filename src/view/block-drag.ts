import { Notice, Platform } from 'obsidian';
import { moveFromDrawn, type ShownRow } from '../core/drop';
import type { TrackedLine } from '../core/editing';
import { planItemMove, type ItemPlace } from '../core/list-actions';
import { contentStartLine } from '../obsidian/marker';
import { closeBlockField } from './block-fields';
import { targetOf } from './dom';
import type { RowDragHost } from './drag-host';
import { enableMouseDrag } from './drag-mouse';
import { enableTouchDrag } from './drag-touch';
import type { ListBlock } from './list-block';
import { shownRows } from './move';
import { pathUnder } from './own-rows';
import { ITEM_CLASS } from './render-list';
import { CHANGED_ELSEWHERE_NOTICE, tryEdit } from './write';

// Items drag within the block, headings don't, and nothing scrolls at the edges: the note's scroller
// is Obsidian's (spec, "A list inside another note").
export function blockDragHost(block: ListBlock): RowDragHost {
	// The latest drag's rows, kept past its untrack, which comes before its drop.
	let drag: DrawnRows | null = null;
	return {
		component: block,
		rowsEl: block.rowsEl,
		edgeScroll: null,
		liftScrollEl: null,
		dragsHeadings: false,
		get swallowNextClick() {
			return block.swallowNextClick;
		},
		set swallowNextClick(value: boolean) {
			block.swallowNextClick = value;
		},
		beforeLift: () => closeBlockField(block, true),
		// drawIfChanged waits while a drag holds the rows, so the field closed at the lift can't end it;
		// any other draw ends it with no drop. It aims with drawn lines; the move maps them to current ones.
		track: (line) => {
			block.dragging = true;
			drag = block.rowsMatchText() ? trackDrawn(block) : null;
			const row = drag?.now[drag.drawn.findIndex((shown) => shown.line === line)];
			return {
				get line() {
					return block.dragging && row?.line != null ? line : null;
				},
			};
		},
		untrack: () => {
			for (const row of drag?.now ?? []) block.editing.untrack(row);
			block.dragging = false;
			block.drawIfChanged();
		},
		dragged: (line) => [line],
		drop: (line, drop) => {
			if ('item' in drop && drag) queueBlockMove(block, drag, line, drop.item.place);
		},
	};
}

/** The rows a drag aims with, as drawn, and each one's line as it is now. */
interface DrawnRows {
	drawn: ShownRow[];
	now: TrackedLine[];
}

function trackDrawn(block: ListBlock): DrawnRows {
	const drawn = shownRows(block.rowsEl);
	return { drawn, now: drawn.map((row) => block.editing.track(row.line)) };
}

/**
 * Whether a mouse press under `rootEl` can lift the item it is on: a plain main-button press, as a
 * modified one selects, on an element whose nearest `draggable` ancestor is an item row. A link or
 * picture in a title drags as itself, and the open field's row doesn't drag.
 */
export function pressCanLift(rootEl: HTMLElement, evt: MouseEvent): boolean {
	if (evt.button !== 0 || evt.shiftKey || evt.ctrlKey || evt.metaKey || evt.altKey) return false;
	return pathUnder(rootEl, evt).find((el) => el.draggable)?.hasClass(ITEM_CLASS) ?? false;
}

export function enableBlockDrag(block: ListBlock): void {
	const host = block.dragHost();
	enableMouseDrag(host);
	if (!Platform.isMobile) return;
	enableTouchDrag(host);
	// In the capture phase, as in the list view: a hold on a row opens no menu, and the tap that ends a
	// hold or a lift isn't a click.
	const { rowsEl } = block;
	block.registerDomEvent(
		rowsEl,
		'contextmenu',
		(evt) => {
			const target = targetOf(evt);
			if (!target || target.closest('textarea') || !target.closest(`.${ITEM_CLASS}`)) return;
			evt.preventDefault();
			evt.stopPropagation();
			block.swallowNextClick = true;
		},
		{ capture: true },
	);
	block.registerDomEvent(
		rowsEl,
		'click',
		(evt) => {
			if (!block.swallowNextClick) return;
			block.swallowNextClick = false;
			evt.preventDefault();
			evt.stopPropagation();
		},
		{ capture: true },
	);
	// A hold that sent no click must not eat a later tap, nor a right-click with a mouse, which sends no touch.
	block.registerDomEvent(rowsEl, 'pointerdown', () => (block.swallowNextClick = false), { capture: true });
}

// As the list view's queueMove, with `line` and `place` on the drawn lines: the drawn rows follow the
// block's own edits that land before the move runs, which then maps them to the lines as they are. A
// change from elsewhere meanwhile writes nothing, as for a tick.
function queueBlockMove(block: ListBlock, drag: DrawnRows, line: number, place: ItemPlace): void {
	const file = block.file;
	const seen = block.outsideChanges;
	const now = drag.now.map((row) => (row.line === null ? row : block.editing.track(row.line)));
	void block.enqueue(async () => {
		try {
			if (block.file !== file) return;
			const move = block.outsideChanges === seen && moveFromDrawn(drag.drawn, now.map((row) => row.line), line, place);
			if (!move) {
				new Notice(CHANGED_ELSEWHERE_NOTICE);
				return;
			}
			const text = block.editing.text;
			const moved = tryEdit(() => planItemMove(text, contentStartLine(text), move.from, move.to));
			if (moved && (await block.write(moved.next, text, moved.edit)) === 'written' && !block.field) block.drawIfChanged();
		} finally {
			for (const row of now) block.editing.untrack(row);
		}
	});
}
