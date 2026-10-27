import type { ShownRow } from '../core/drop';
import type { TrackedLine } from '../core/editing';
import { closeCard } from './card';
import { targetOf } from './dom';
import type { PrinceListView } from './list-view';
import { aimDrop, markDrop, queueDrop, shownRows, type RowDrop } from './move';
import { HEADING_CLASS, ITEM_CLASS, LINE_ATTR, lineOf, ROWS_DRAG } from './render-list';

// Each row's drag carries a type of its own, this one with a random token added. Other drags, such as
// a file's or a row's from another vault window, which has its own `current`, are left alone.
const DRAG_TYPE = 'application/x-princelists-item';

interface MouseDrag {
	view: PrinceListView;
	listEl: HTMLElement;
	type: string;
	/** The dragged item's title line, or heading's line. It follows edits that land during the drag. */
	row: TrackedLine;
	kind: ShownRow['kind'];
	drop: RowDrop | null;
	/** The row or heading that shows the drop line. */
	marked: HTMLElement | null;
}

// The row's drag in progress, in whichever list pane of this window it started. A redraw during a
// drag, such as when closing the card removed an empty item, detaches the row it started on, and its
// dragend then never comes. The next drag start in any list pane ends it.
let current: MouseDrag | null = null;

// Dragging rows and headings with the mouse, on desktop only (spec, "Dragging"). `listEl` holds every row and
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
		const line = drag.row.line;
		endDrag();
		if (drop && line !== null) queueDrop(view, line, drop);
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
	current.view.editing.untrack(current.row);
	showDrop(current, null);
	current = null;
}

// Only a row or heading itself starts a drag: a link or picture in its title drags as itself. Starting
// one closes the card the way a click elsewhere does.
function startDrag(view: PrinceListView, listEl: HTMLElement, evt: DragEvent): MouseDrag | null {
	const row = targetOf(evt);
	const kind = row?.hasClass(ITEM_CLASS) ? 'item' : row?.hasClass(HEADING_CLASS) ? 'heading' : null;
	const line = row && kind ? lineOf(row) : null;
	if (!kind || line === null || !evt.dataTransfer) return null;
	closeCard(view);
	const type = `${DRAG_TYPE}-${Math.random().toString(36).slice(2)}`;
	evt.dataTransfer.setData(type, '');
	evt.dataTransfer.effectAllowed = 'move';
	return { view, listEl, type, row: view.editing.track(line), kind, drop: null, marked: null };
}

function dragOver(drag: MouseDrag, evt: DragEvent): void {
	// The row went during the drag, so it can't be dropped.
	if (drag.row.line === null) {
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
	const dragged = drag.row.line;
	const over = targetOf(evt)?.closest<HTMLElement>(`[${LINE_ATTR}]`);
	const line = over ? lineOf(over) : null;
	if (dragged === null || !over || line === null) return;
	const { top, height } = over.getBoundingClientRect();
	const below = evt.clientY > top + height / 2;
	showDrop(drag, aimDrop(shownRows(drag.listEl), { line: dragged, kind: drag.kind }, { line, below }));
}

function showDrop(drag: MouseDrag, drop: RowDrop | null): void {
	drag.marked = markDrop(drag.listEl, drag.marked, drop);
	drag.drop = drop;
}
