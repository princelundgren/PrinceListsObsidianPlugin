import { dropAt, type Drop } from '../core/drop';
import type { TrackedLine } from '../core/editing';
import { closeCard } from './card';
import { targetOf } from './events';
import type { PrinceListView } from './list-view';
import { markDrop, queueMove, shownRows } from './move';
import { ITEM_CLASS, LINE_ATTR, lineOf, ROWS_DRAG } from './render-list';

// Each row's drag carries a type of its own, this one with a random token added. Other drags, such as
// a file's or a row's from another vault window, which has its own `current`, are left alone.
const DRAG_TYPE = 'application/x-princelists-item';

interface MouseDrag {
	view: PrinceListView;
	listEl: HTMLElement;
	type: string;
	/** The dragged item's title line. It follows edits that land during the drag. */
	item: TrackedLine;
	drop: Drop | null;
	/** The row or heading that shows the drop line. */
	marked: HTMLElement | null;
}

// The row's drag in progress, in whichever list pane of this window it started. A redraw during a
// drag, such as when closing the card removed an empty item, detaches the row it started on, and its
// dragend then never comes. The next drag start in any list pane ends it.
let current: MouseDrag | null = null;

// Dragging rows with the mouse, on desktop only (spec, "Dragging"). `listEl` holds every row and
// heading, and takes one listener per drag event. Each acts only on a drag that started in it.
export function enableMouseDrag(view: PrinceListView, listEl: HTMLElement): void {
	if (!ROWS_DRAG) return;
	const ownDrag = (evt: DragEvent) =>
		current?.listEl === listEl && evt.dataTransfer?.types.includes(current.type) ? current : null;
	view.registerDomEvent(listEl, 'dragstart', (evt) => {
		endDrag();
		current = startDrag(view, listEl, evt);
	});
	view.registerDomEvent(listEl, 'dragover', (evt) => {
		const drag = ownDrag(evt);
		if (drag) dragOver(drag, evt);
	});
	// Fired on leaving the list, and where the pointer is when the drag is canceled.
	view.registerDomEvent(listEl, 'dragleave', (evt) => {
		if (current?.listEl === listEl && !listEl.contains(evt.relatedTarget as Node | null)) showDrop(current, null);
	});
	view.registerDomEvent(listEl, 'drop', (evt) => {
		const drag = ownDrag(evt);
		if (!drag) return;
		evt.preventDefault();
		aim(drag, evt);
		const { drop } = drag;
		const line = drag.item.line;
		endDrag();
		if (drop && line !== null) queueMove(view, line, drop.place);
	});
	view.registerDomEvent(listEl, 'dragend', () => {
		if (current?.listEl === listEl) endDrag();
	});
	view.register(() => {
		if (current?.view === view) endDrag();
	});
}

function endDrag(): void {
	if (!current) return;
	current.view.editing.untrack(current.item);
	showDrop(current, null);
	current = null;
}

// Only a row itself starts a drag: a link or picture in its title drags as itself. Starting one closes
// the card the way a click elsewhere does.
function startDrag(view: PrinceListView, listEl: HTMLElement, evt: DragEvent): MouseDrag | null {
	const row = targetOf(evt);
	const line = row?.hasClass(ITEM_CLASS) ? lineOf(row) : null;
	if (line === null || !evt.dataTransfer) return null;
	closeCard(view);
	const type = `${DRAG_TYPE}-${Math.random().toString(36).slice(2)}`;
	evt.dataTransfer.setData(type, '');
	evt.dataTransfer.effectAllowed = 'move';
	return { view, listEl, type, item: view.editing.track(line), drop: null, marked: null };
}

function dragOver(drag: MouseDrag, evt: DragEvent): void {
	// The item went during the drag, so it can't be dropped.
	if (drag.item.line === null) {
		showDrop(drag, null);
		return;
	}
	evt.preventDefault();
	if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'move';
	aim(drag, evt);
}

// The drop for the row or heading under the pointer. Between rows, such as over a heading's margin,
// the drop line stays where it was.
function aim(drag: MouseDrag, evt: DragEvent): void {
	const item = drag.item.line;
	const over = targetOf(evt)?.closest<HTMLElement>(`[${LINE_ATTR}]`);
	const line = over ? lineOf(over) : null;
	if (item === null || !over || line === null) return;
	const { top, height } = over.getBoundingClientRect();
	showDrop(drag, dropAt(shownRows(drag.listEl), item, { line, below: evt.clientY > top + height / 2 }));
}

function showDrop(drag: MouseDrag, drop: Drop | null): void {
	drag.marked = markDrop(drag.listEl, drag.marked, drop);
	drag.drop = drop;
}
