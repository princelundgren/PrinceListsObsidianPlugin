import { dropAt, type Drop } from '../core/drop';
import type { TrackedLine } from '../core/editing';
import { edgeStep, HOLD_MS, MOVE_TOLERANCE_PX, overRow, type RowBox } from '../core/touch-drag';
import { CARD_CLASS, closeCard } from './card';
import { targetOf } from './events';
import type { PrinceListView } from './list-view';
import { markDrop, queueMove, shownRows } from './move';
import { ITEM_CLASS, LINE_ATTR, lineOf } from './render-list';

const LIFTED_CLASS = 'princelists-lifted';
const LIFT_OFFSET = '--princelists-lift';

interface Lift {
	/** The dragged item's title line. It follows edits that land during the drag. */
	item: TrackedLine;
	/** Every row and heading with its extent at the lift, in the scroller's content coordinates. */
	boxes: { el: HTMLElement; top: number; bottom: number }[];
	scrollAtLift: number;
	/** How far the finger sits below the row's own slot, because the scroller couldn't absorb all of a closed card's shift. */
	shift: number;
	drop: Drop | null;
	/** The row or heading that shows the drop line. */
	marked: HTMLElement | null;
	frame: number | null;
	/** Where the finger was at the lift. */
	fromX: number;
	fromY: number;
	/** Set once the finger has moved past the tolerance since the lift: only then may an edge scroll start. */
	armed: boolean;
}

interface Press {
	pointerId: number;
	row: HTMLElement;
	startX: number;
	startY: number;
	/** The finger's latest position. */
	x: number;
	y: number;
	/** The hold's timer, until it fires or the finger moves too far. */
	timer: number | null;
	lift: Lift | null;
}

// Dragging items with a finger, on the iPhone only (spec, "Dragging" and "Touch on the iPhone"). The
// listeners are registered once and read the press, instead of being added for each drag. The view's
// capture-phase contextmenu cancel and click swallow (registerFieldEvents) serve this drag too.
export function enableTouchDrag(view: PrinceListView): void {
	const { contentEl, listScrollEl } = view;
	// Its top is where the list stops being visible: the iPhone's floating navbar covers the bottom
	// of the view, and Obsidian puts its height in --view-bottom-spacing.
	const visibleBottom = view.containerEl.createDiv({ cls: 'princelists-visible-bottom' });
	let press: Press | null = null;

	const endLift = (ending: Press): void => {
		const lift = ending.lift;
		if (!lift) return;
		if (lift.frame !== null) window.cancelAnimationFrame(lift.frame);
		view.editing.untrack(lift.item);
		markDrop(listScrollEl, lift.marked, null);
		ending.row.removeClass(LIFTED_CLASS);
		ending.lift = null;
	};

	const endPress = (): void => {
		if (!press) return;
		if (press.timer !== null) window.clearTimeout(press.timer);
		endLift(press);
		press = null;
	};

	// The row follows the finger plus how far the list has scrolled since the lift, and the drop is
	// the one for the finger's place in the list. A redraw detached the row: the drag ends, unmoved.
	const update = (current: Press): void => {
		const lift = current.lift;
		if (!lift) return;
		if (!current.row.isConnected) {
			endLift(current);
			return;
		}
		const scrolled = listScrollEl.scrollTop - lift.scrollAtLift;
		current.row.setCssProps({ [LIFT_OFFSET]: `${current.y - current.startY + scrolled}px` });
		const line = lift.item.line;
		const boxes: RowBox[] = lift.boxes.map(({ el, top, bottom }) => ({ line: lineOf(el) as number, top, bottom }));
		const y = current.y - lift.shift - listScrollEl.getBoundingClientRect().top + listScrollEl.scrollTop;
		const over = line === null ? null : overRow(boxes, y);
		lift.drop = line === null || !over ? null : dropAt(shownRows(listScrollEl), line, over);
		lift.marked = markDrop(listScrollEl, lift.marked, lift.drop);
	};

	// Read on each move and frame: closing the card at the lift can put the keyboard away.
	const step = (current: Press): number =>
		edgeStep(current.y, listScrollEl.getBoundingClientRect().top, visibleBottom.getBoundingClientRect().top);

	const keepScrolling = (current: Press): void => {
		const lift = current.lift;
		if (!lift?.armed || lift.frame !== null || step(current) === 0) return;
		lift.frame = window.requestAnimationFrame(() => {
			lift.frame = null;
			if (current.lift !== lift) return;
			const by = step(current);
			if (by === 0) return;
			const before = listScrollEl.scrollTop;
			listScrollEl.scrollTop += by;
			update(current);
			if (listScrollEl.scrollTop !== before) keepScrolling(current);
		});
	};

	const lift = (current: Press): void => {
		current.timer = null;
		const rowTop = current.row.getBoundingClientRect().top;
		closeCard(view);
		const line = lineOf(current.row);
		if (!current.row.isConnected || line === null) return;
		// A card above the row closing moves the row up under the finger's hold; scroll it back.
		listScrollEl.scrollTop += current.row.getBoundingClientRect().top - rowTop;
		const shift = rowTop - current.row.getBoundingClientRect().top;
		const scrollerTop = listScrollEl.getBoundingClientRect().top;
		const boxes = Array.from(listScrollEl.querySelectorAll<HTMLElement>(`[${LINE_ATTR}]`), (el) => {
			const rect = el.getBoundingClientRect();
			return { el, top: rect.top - scrollerTop + listScrollEl.scrollTop, bottom: rect.bottom - scrollerTop + listScrollEl.scrollTop };
		});
		current.lift = { item: view.editing.track(line), boxes, scrollAtLift: listScrollEl.scrollTop, shift, drop: null, marked: null, frame: null, fromX: current.x, fromY: current.y, armed: false };
		current.row.addClass(LIFTED_CLASS);
		// The release of a lifted press is never a tap.
		view.swallowNextClick = true;
		update(current);
	};

	view.registerDomEvent(contentEl, 'pointerdown', (evt) => {
		if (evt.pointerType !== 'touch' || !evt.isPrimary) return;
		// A press whose release never reached the view is over.
		endPress();
		const row = targetOf(evt)?.closest<HTMLElement>(`.${ITEM_CLASS}`);
		if (!row || row.hasClass(CARD_CLASS)) return;
		const started: Press = { pointerId: evt.pointerId, row, startX: evt.clientX, startY: evt.clientY, x: evt.clientX, y: evt.clientY, timer: null, lift: null };
		started.timer = window.setTimeout(() => lift(started), HOLD_MS);
		press = started;
	});
	view.registerDomEvent(contentEl, 'pointermove', (evt) => {
		if (!press || press.pointerId !== evt.pointerId) return;
		press.x = evt.clientX;
		press.y = evt.clientY;
		if (press.lift) {
			if (Math.hypot(press.x - press.lift.fromX, press.y - press.lift.fromY) > MOVE_TOLERANCE_PX) press.lift.armed = true;
			update(press);
			keepScrolling(press);
		} else if (press.timer !== null && Math.hypot(evt.clientX - press.startX, evt.clientY - press.startY) > MOVE_TOLERANCE_PX) {
			// The touch is a scroll. The press stays open until the finger lifts.
			window.clearTimeout(press.timer);
			press.timer = null;
		}
	});
	view.registerDomEvent(contentEl, 'pointerup', (evt) => {
		if (!press || press.pointerId !== evt.pointerId) return;
		const drop = press.lift?.drop;
		const line = press.lift?.item.line;
		const stillThere = press.row.isConnected;
		endPress();
		// A redraw since the last move means the drop's lines may be stale.
		if (drop && line !== null && line !== undefined && stillThere) queueMove(view, line, drop.place);
	});
	view.registerDomEvent(contentEl, 'pointercancel', (evt) => {
		if (press?.pointerId === evt.pointerId) endPress();
	});
	// Non-passive, to stop the scroll once a row is lifted. It cancels nothing before that, so a swipe
	// still scrolls.
	view.registerDomEvent(
		contentEl,
		'touchmove',
		(evt) => {
			if (!press?.lift) return;
			evt.preventDefault();
			evt.stopPropagation();
		},
		{ passive: false },
	);
	view.register(endPress);
}
