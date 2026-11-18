import { Platform } from 'obsidian';
import { newItemDropAt, type NewItemDrop } from '../core/drop';
import type { ItemPlace } from '../core/list-actions';
import { edgeStep, HOLD_MS, MOVE_TOLERANCE_PX, overRow } from '../core/touch-drag';
import { closeCard } from './card';
import { targetOf } from './dom';
import type { RowDragHost } from './drag-host';
import type { PrinceListView } from './list-view';
import { markDrop, shownRows } from './move';
import { ownClosest, ownElements } from './own-rows';
import { LINE_ATTR, lineOf, ROWS_DRAG } from './render-list';

// With a random token added, as a row's drag type is, so a "+" from another list pane is left alone.
const DRAG_TYPE = 'application/x-princelists-new-item';
const LIFTED_CLASS = 'princelists-new-item-lifted';

/** Where a new item dropped now would go: its place, and the drop line's place, if the list shows rows. */
interface Aim {
	place: ItemPlace | null;
	marked: HTMLElement | null;
}

/** Ends a drag of the floating "+" with the place it was dropped on. */
type AddAt = (place: ItemPlace) => void;

/**
 * Lets the floating "+" be dragged onto the list (spec, "The floating "+" button"): with the mouse on
 * desktop, after a hold on mobile. Returns a check the button's click listener asks first: true once,
 * for the click a lifted hold's release sends, which adds nothing.
 */
export function enableNewItemDrag(view: PrinceListView, button: HTMLElement, edgeScroll: RowDragHost['edgeScroll'], addAt: AddAt): () => boolean {
	if (ROWS_DRAG) enableMouse(view, button, addAt);
	if (!Platform.isMobile) return () => false;
	return enableTouch(view, button, edgeScroll, addAt);
}

function showAim(rowsEl: HTMLElement, aim: Aim, aimed: NewItemDrop | null): void {
	aim.marked = markDrop(rowsEl, aim.marked, aimed && aimed.line !== null ? { item: aimed } : null);
	aim.place = aimed?.place ?? null;
}

// The browser's own drag, as a row's: Escape or a drop off the list ends it with no drop event, and a
// drag sends no click. Starting one closes the card, as a row's drag does.
function enableMouse(view: PrinceListView, button: HTMLElement, addAt: AddAt): void {
	const rowsEl = view.listScrollEl;
	button.draggable = true;
	let drag: (Aim & { type: string }) | null = null;
	const ownDrag = (evt: DragEvent) => (drag && evt.dataTransfer?.types.includes(drag.type) ? drag : null);
	const endDrag = (): void => {
		if (drag) showAim(rowsEl, drag, null);
		drag = null;
	};
	view.registerDomEvent(button, 'dragstart', (evt) => {
		if (!evt.dataTransfer) return;
		drag = { type: `${DRAG_TYPE}-${Math.random().toString(36).slice(2)}`, place: null, marked: null };
		evt.dataTransfer.setData(drag.type, '');
		evt.dataTransfer.effectAllowed = 'copy';
		closeCard(view);
	});
	view.registerDomEvent(rowsEl, 'dragover', (evt) => {
		const current = ownDrag(evt);
		if (!current) return;
		evt.preventDefault();
		if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'copy';
		const target = targetOf(evt);
		const over = target && ownClosest(rowsEl, target, `[${LINE_ATTR}]`);
		const line = over ? lineOf(over) : null;
		const shown = shownRows(rowsEl);
		// Between rows, such as over a heading's margin, the drop line stays where it was.
		if (shown.length > 0 && (!over || line === null)) return;
		const box = over?.getBoundingClientRect();
		showAim(rowsEl, current, newItemDropAt(shown, box && line !== null ? { line, below: evt.clientY > box.top + box.height / 2 } : null));
	});
	view.registerDomEvent(rowsEl, 'dragleave', (evt) => {
		if (drag && !rowsEl.contains(evt.relatedTarget as Node | null)) showAim(rowsEl, drag, null);
	});
	view.registerDomEvent(rowsEl, 'drop', (evt) => {
		const current = ownDrag(evt);
		if (!current) return;
		evt.preventDefault();
		const place = current.place;
		endDrag();
		if (place) addAt(place);
	});
	view.registerDomEvent(button, 'dragend', endDrag);
	view.register(endDrag);
}

interface Press extends Aim {
	pointerId: number;
	startX: number;
	startY: number;
	x: number;
	y: number;
	/** The hold's timer, until it fires or the finger moves too far. */
	timer: number | null;
	lifted: boolean;
	/** Set once the lifted "+" has moved past the tolerance: only then does it aim, scroll at the edges and drop. */
	armed: boolean;
	/** Set once the finger is out of the edge zones: the "+" starts in the bottom one, which mustn't scroll the list at once. */
	leftEdge: boolean;
	frame: number | null;
}

// A hold on the "+" as long as a row's lifts it, and it follows the finger. The button keeps the
// pointer, so its moves arrive here rather than on the rows, and the rows are measured on each move
// instead. styles.css gives it touch-action: none, so the hold and the move don't scroll the page, and
// once it's lifted its touchmove is stopped, as a row's is, so no swipe of Obsidian's starts.
function enableTouch(view: PrinceListView, button: HTMLElement, edgeScroll: RowDragHost['edgeScroll'], addAt: AddAt): () => boolean {
	const rowsEl = view.listScrollEl;
	let press: Press | null = null;
	let swallowClick = false;

	const endPress = (): void => {
		if (!press) return;
		if (press.timer !== null) window.clearTimeout(press.timer);
		if (press.frame !== null) window.cancelAnimationFrame(press.frame);
		showAim(rowsEl, press, null);
		button.removeClass(LIFTED_CLASS);
		button.setCssProps({ '--princelists-lift-x': '', '--princelists-lift-y': '' });
		press = null;
	};

	// Past the list's edges, or under the navbar, a drop adds nothing.
	const update = (current: Press): void => {
		button.setCssProps({ '--princelists-lift-x': `${current.x - current.startX}px`, '--princelists-lift-y': `${current.y - current.startY}px` });
		if (!current.armed) return;
		const list = rowsEl.getBoundingClientRect();
		const bottom = edgeScroll ? edgeScroll.visibleBottomEl.getBoundingClientRect().top : list.bottom;
		const inList = current.x >= list.left && current.x <= list.right && current.y >= list.top && current.y <= bottom;
		const boxes = ownElements(rowsEl, `[${LINE_ATTR}]`).map((el) => {
			const { top, bottom: end } = el.getBoundingClientRect();
			return { line: lineOf(el) as number, top, bottom: end };
		});
		showAim(rowsEl, current, inList ? newItemDropAt(shownRows(rowsEl), overRow(boxes, current.y)) : null);
	};

	const step = (current: Press): number =>
		edgeScroll ? edgeStep(current.y, edgeScroll.scrollEl.getBoundingClientRect().top, edgeScroll.visibleBottomEl.getBoundingClientRect().top) : 0;

	const keepScrolling = (current: Press): void => {
		if (step(current) === 0) current.leftEdge = true;
		if (!edgeScroll || !current.armed || !current.leftEdge || current.frame !== null || step(current) === 0) return;
		current.frame = window.requestAnimationFrame(() => {
			current.frame = null;
			if (press !== current) return;
			const before = edgeScroll.scrollEl.scrollTop;
			edgeScroll.scrollEl.scrollTop += step(current);
			update(current);
			if (edgeScroll.scrollEl.scrollTop !== before) keepScrolling(current);
		});
	};

	view.registerDomEvent(button, 'pointerdown', (evt) => {
		swallowClick = false;
		if (evt.pointerType !== 'touch' || !evt.isPrimary) return;
		endPress();
		button.setPointerCapture(evt.pointerId);
		const started: Press = { pointerId: evt.pointerId, startX: evt.clientX, startY: evt.clientY, x: evt.clientX, y: evt.clientY, timer: null, lifted: false, armed: false, leftEdge: false, frame: null, place: null, marked: null };
		started.timer = window.setTimeout(() => {
			started.timer = null;
			started.lifted = true;
			// The release of a lifted press is never a tap, also when it adds nothing.
			swallowClick = true;
			button.addClass(LIFTED_CLASS);
		}, HOLD_MS);
		press = started;
	});
	view.registerDomEvent(button, 'pointermove', (evt) => {
		if (!press || press.pointerId !== evt.pointerId) return;
		press.x = evt.clientX;
		press.y = evt.clientY;
		const moved = Math.hypot(press.x - press.startX, press.y - press.startY) > MOVE_TOLERANCE_PX;
		if (press.lifted) {
			if (moved) press.armed = true;
			update(press);
			keepScrolling(press);
		} else if (press.timer !== null && moved) {
			window.clearTimeout(press.timer);
			press.timer = null;
		}
	});
	view.registerDomEvent(button, 'pointerup', (evt) => {
		if (!press || press.pointerId !== evt.pointerId) return;
		// Aimed again, at the rows as they are now: a redraw since the last move may have moved them.
		update(press);
		const place = press.armed ? press.place : null;
		endPress();
		if (place) addAt(place);
	});
	// The button lets go of the pointer when it hides, and then no pointerup comes.
	for (const ending of ['pointercancel', 'lostpointercapture'] as const) {
		view.registerDomEvent(button, ending, (evt) => {
			if (press?.pointerId === evt.pointerId) endPress();
		});
	}
	view.registerDomEvent(
		button,
		'touchmove',
		(evt) => {
			if (!press?.lifted) return;
			evt.preventDefault();
			evt.stopPropagation();
		},
		{ passive: false },
	);
	// Obsidian makes a contextmenu after a still hold, as on a row, which opens no menu.
	view.registerDomEvent(button, 'contextmenu', (evt) => {
		evt.preventDefault();
		evt.stopPropagation();
	});
	view.register(endPress);
	return () => {
		const swallowed = swallowClick;
		swallowClick = false;
		return swallowed;
	};
}
