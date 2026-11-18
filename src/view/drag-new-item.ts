import { Platform } from 'obsidian';
import { newItemDropAt, type NewItemDrop } from '../core/drop';
import type { ItemPlace } from '../core/list-actions';
import { edgeStep, MOVE_TOLERANCE_PX, overRow } from '../core/touch-drag';
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
const DRAGGING_CLASS = 'princelists-new-item-dragging';

/** Where a new item dropped now would go: its place, and the drop line's place, if the list shows rows. */
interface Aim {
	place: ItemPlace | null;
	marked: HTMLElement | null;
}

/** Ends a drag of the floating "+" with the place it was dropped on. */
type AddAt = (place: ItemPlace) => void;

/**
 * Lets the floating "+" be dragged onto the list (spec, "The floating "+" button"), with the mouse on
 * desktop and a finger on mobile. Returns a check the button's click listener asks first: true once,
 * for the click a finger's drag sends as it lifts, which adds nothing more.
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

/**
 * The round button as an image with clear corners, from its own icon and colors, the theme's: the
 * browser's own picture of it is its square box. null while the button draws no icon.
 */
function roundPicture(button: HTMLElement): HTMLImageElement | null {
	const icon = button.querySelector('svg');
	if (!icon) return null;
	const style = button.win.getComputedStyle(button);
	const size = button.offsetWidth;
	const iconSize = icon.getBoundingClientRect().width;
	const glyph = icon.cloneNode(true) as SVGSVGElement;
	for (const [name, value] of [['x', (size - iconSize) / 2], ['y', (size - iconSize) / 2], ['width', iconSize], ['height', iconSize]] as const) glyph.setAttribute(name, String(value));
	// Lucide's icons stroke in currentColor.
	glyph.setAttribute('color', style.color);
	const circle = `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${style.backgroundColor}"/>`;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${circle}${new XMLSerializer().serializeToString(glyph)}</svg>`;
	const picture = button.doc.createElement('img');
	picture.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
	return picture;
}

// The browser's own drag, as a row's: Escape or a drop off the list ends it with no drop event, and a
// drag sends no click. Starting one closes the card, as a row's drag does. It's a move, as a row's,
// so the pointer shows no copy badge, and the "+" left behind hides while it lasts.
function enableMouse(view: PrinceListView, button: HTMLElement, addAt: AddAt): void {
	const rowsEl = view.listScrollEl;
	button.draggable = true;
	let drag: (Aim & { type: string }) | null = null;
	// Made as the pointer comes onto the "+", so it has loaded by the drag, and in the theme of the moment.
	let picture: HTMLImageElement | null = null;
	let hideTimer: number | null = null;
	const ownDrag = (evt: DragEvent) => (drag && evt.dataTransfer?.types.includes(drag.type) ? drag : null);
	const endDrag = (): void => {
		if (drag) showAim(rowsEl, drag, null);
		if (hideTimer !== null) window.clearTimeout(hideTimer);
		hideTimer = null;
		button.removeClass(DRAGGING_CLASS);
		drag = null;
	};
	view.registerDomEvent(button, 'pointerenter', () => (picture = roundPicture(button)));
	view.registerDomEvent(button, 'dragstart', (evt) => {
		if (!evt.dataTransfer) return;
		drag = { type: `${DRAG_TYPE}-${Math.random().toString(36).slice(2)}`, place: null, marked: null };
		evt.dataTransfer.setData(drag.type, '');
		evt.dataTransfer.effectAllowed = 'move';
		if (picture?.complete) {
			const { left, top } = button.getBoundingClientRect();
			evt.dataTransfer.setDragImage(picture, evt.clientX - left, evt.clientY - top);
		}
		// After dragstart returns: without the picture, the browser's own is taken of the button then.
		hideTimer = window.setTimeout(() => {
			hideTimer = null;
			button.addClass(DRAGGING_CLASS);
		});
		closeCard(view);
	});
	// The drop for the row under the pointer. Between rows, such as over a heading's margin, the drop
	// line stays where it was.
	const aim = (current: Aim, evt: DragEvent): void => {
		const target = targetOf(evt);
		const over = target && ownClosest(rowsEl, target, `[${LINE_ATTR}]`);
		const line = over ? lineOf(over) : null;
		const shown = shownRows(rowsEl);
		if (shown.length > 0 && (!over || line === null)) return;
		const box = over?.getBoundingClientRect();
		showAim(rowsEl, current, newItemDropAt(shown, box && line !== null ? { line, below: evt.clientY > box.top + box.height / 2 } : null));
	};
	view.registerDomEvent(rowsEl, 'dragover', (evt) => {
		const current = ownDrag(evt);
		if (!current) return;
		evt.preventDefault();
		if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'move';
		aim(current, evt);
	});
	view.registerDomEvent(rowsEl, 'dragleave', (evt) => {
		if (drag && !rowsEl.contains(evt.relatedTarget as Node | null)) showAim(rowsEl, drag, null);
	});
	view.registerDomEvent(rowsEl, 'drop', (evt) => {
		const current = ownDrag(evt);
		if (!current) return;
		evt.preventDefault();
		// Aimed again, as a row's drop is: a redraw since the last dragover may have moved the rows.
		aim(current, evt);
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
	/** Set once the finger has moved past the tolerance: only then is the press a drag, which aims, scrolls at the edges and drops. */
	armed: boolean;
	/** Set once the finger is out of the edge zones: the "+" starts in the bottom one, which mustn't scroll the list at once. */
	leftEdge: boolean;
	frame: number | null;
}

// The "+" drags as soon as the finger moves on it, with no hold: unlike a row, it has no swipe to
// scroll the list to keep. A press that doesn't move is a tap. The button keeps the pointer, so its
// moves arrive here rather than on the rows, and the rows are measured on each move instead.
// styles.css gives it touch-action: none, so the move doesn't scroll the page, and its touchmove is
// stopped, as a lifted row's is, so no swipe of Obsidian's starts.
function enableTouch(view: PrinceListView, button: HTMLElement, edgeScroll: RowDragHost['edgeScroll'], addAt: AddAt): () => boolean {
	const rowsEl = view.listScrollEl;
	let press: Press | null = null;
	let swallowClick = false;

	const endPress = (): void => {
		if (!press) return;
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
		const started: Press = { pointerId: evt.pointerId, startX: evt.clientX, startY: evt.clientY, x: evt.clientX, y: evt.clientY, armed: false, leftEdge: false, frame: null, place: null, marked: null };
		press = started;
	});
	view.registerDomEvent(button, 'pointermove', (evt) => {
		if (!press || press.pointerId !== evt.pointerId) return;
		press.x = evt.clientX;
		press.y = evt.clientY;
		if (!press.armed && Math.hypot(press.x - press.startX, press.y - press.startY) > MOVE_TOLERANCE_PX) {
			press.armed = true;
			// The release of a drag is never a tap, also when it adds nothing.
			swallowClick = true;
			button.addClass(LIFTED_CLASS);
		}
		update(press);
		keepScrolling(press);
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
			if (!press) return;
			evt.preventDefault();
			evt.stopPropagation();
		},
		{ passive: false },
	);
	// Obsidian makes a contextmenu after a still hold, which on the "+" opens no menu.
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
