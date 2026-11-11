import { isStillHold, type PointerMark } from '../core/touch-drag';
import { CARD_CLASS } from './card';
import { COLLAPSE_CLASS } from './collapse';
import { targetOf } from './dom';
import type { PrinceListView } from './list-view';
import { ownClosest } from './own-rows';
import { HEADING_CLASS, ITEM_CLASS, lineOf, TICK_SELECTOR } from './render-list';
import { closeCardForSelection, focusList, selectOnHold } from './select';

// What a hold doesn't count on: the checkbox and the zone beside it, the collapse arrow, a link and a field.
const NOT_A_HOLD_ZONE = `${TICK_SELECTOR}, .${COLLAPSE_CLASS}, a, textarea, input`;

interface MousePress extends PointerMark {
	row: HTMLElement;
}

/**
 * Selecting with a mouse by holding a row or a heading (spec, "Starting to select"): a press of the
 * main button, with no modifier, held as long as a touch hold and let go in place, selects the row as
 * a touch hold does. Moving first starts the browser's drag, which forgets the press. The click that
 * follows the release is swallowed. Desktop only.
 */
export function enableMouseHold(view: PrinceListView): void {
	const rowsEl = view.listScrollEl;
	let press: MousePress | null = null;
	view.registerDomEvent(rowsEl, 'pointerdown', (evt) => {
		press = null;
		if (evt.pointerType !== 'mouse' || evt.button !== 0 || evt.ctrlKey || evt.metaKey || evt.shiftKey || evt.altKey) return;
		const target = targetOf(evt);
		if (!target || target.closest(NOT_A_HOLD_ZONE)) return;
		const row = ownClosest(rowsEl, target, `.${ITEM_CLASS}, .${HEADING_CLASS}`);
		if (!row || row.hasClass(CARD_CLASS) || view.card?.el.contains(target)) return;
		press = { row, x: evt.clientX, y: evt.clientY, at: evt.timeStamp };
	});
	view.registerDomEvent(rowsEl, 'pointerup', (evt) => {
		const held = press;
		press = null;
		if (!held || evt.pointerType !== 'mouse' || !isStillHold(held, { x: evt.clientX, y: evt.clientY, at: evt.timeStamp })) return;
		holdRow(view, held.row);
	});
	view.registerDomEvent(rowsEl, 'dragstart', () => (press = null));
	view.registerDomEvent(rowsEl, 'pointercancel', () => (press = null));
}

function holdRow(view: PrinceListView, row: HTMLElement): void {
	const line = lineOf(row);
	if (line === null || !row.isConnected) return;
	const cardLine = closeCardForSelection(view);
	view.swallowNextClick = true;
	selectOnHold(view, line, cardLine);
	if (cardLine !== null) focusList(view);
}
