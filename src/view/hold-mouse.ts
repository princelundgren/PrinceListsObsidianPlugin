import { HOLD_MS, isInPlace, isStillHold, type PointerMark } from '../core/touch-drag';
import { CARD_CLASS } from './card';
import { COLLAPSE_CLASS } from './collapse';
import { targetOf } from './dom';
import { LIFTED_CLASS } from './drag-touch';
import type { PrinceListView } from './list-view';
import { ownClosest } from './own-rows';
import { HEADING_CLASS, ITEM_CLASS, lineOf, TICK_SELECTOR } from './render-list';
import { closeCardForSelection, focusList, selectOnHold } from './select';

// What a hold doesn't count on: the checkbox and the zone beside it, the collapse arrow, a link and a field.
const NOT_A_HOLD_ZONE = `${TICK_SELECTOR}, .${COLLAPSE_CLASS}, a, textarea, input`;

interface MousePress extends PointerMark {
	row: HTMLElement;
	liftTimer: number;
}

/**
 * Selecting with a mouse by holding a row or a heading (spec, "Starting to select"): a press of the
 * main button, with no modifier, held as long as a touch hold and let go in place, selects the row as
 * a touch hold does; the row lifts as a touch hold's does once the hold time is reached. Moving past
 * the touch tolerance, or the browser's drag, forgets the press. The click that follows the release
 * is swallowed. Desktop only.
 */
export function enableMouseHold(view: PrinceListView): void {
	const rowsEl = view.listScrollEl;
	let press: MousePress | null = null;
	const forgetPress = (): MousePress | null => {
		const forgotten = press;
		press = null;
		if (forgotten) {
			window.clearTimeout(forgotten.liftTimer);
			forgotten.row.removeClass(LIFTED_CLASS);
		}
		return forgotten;
	};
	view.registerDomEvent(rowsEl, 'pointerdown', (evt) => {
		forgetPress();
		if (evt.pointerType !== 'mouse' || evt.button !== 0 || evt.ctrlKey || evt.metaKey || evt.shiftKey || evt.altKey) return;
		const target = targetOf(evt);
		if (!target || target.closest(NOT_A_HOLD_ZONE)) return;
		const row = ownClosest(rowsEl, target, `.${ITEM_CLASS}, .${HEADING_CLASS}`);
		if (!row || row.hasClass(CARD_CLASS) || view.card?.el.contains(target)) return;
		const liftTimer = window.setTimeout(() => row.addClass(LIFTED_CLASS), HOLD_MS);
		press = { row, x: evt.clientX, y: evt.clientY, at: evt.timeStamp, liftTimer };
	});
	view.registerDomEvent(rowsEl, 'pointermove', (evt) => {
		if (press && !isInPlace(press, { x: evt.clientX, y: evt.clientY })) forgetPress();
	});
	view.registerDomEvent(rowsEl, 'pointerup', (evt) => {
		const held = forgetPress();
		if (!held || evt.pointerType !== 'mouse' || !isStillHold(held, { x: evt.clientX, y: evt.clientY, at: evt.timeStamp })) return;
		holdRow(view, held.row);
	});
	view.registerDomEvent(rowsEl, 'dragstart', forgetPress);
	view.registerDomEvent(rowsEl, 'pointercancel', forgetPress);
	view.registerDomEvent(rowsEl, 'pointerleave', forgetPress);
}

function holdRow(view: PrinceListView, row: HTMLElement): void {
	const line = lineOf(row);
	if (line === null || !row.isConnected) return;
	const cardLine = closeCardForSelection(view);
	view.swallowNextClick = true;
	selectOnHold(view, line, cardLine);
	if (cardLine !== null) focusList(view);
}
