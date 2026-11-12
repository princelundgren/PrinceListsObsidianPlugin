import { HOLD_MS, isInPlace, type PointerMark } from '../core/touch-drag';
import { CARD_CLASS } from './card';
import { COLLAPSE_CLASS } from './collapse';
import { targetOf } from './dom';
import type { PrinceListView } from './list-view';
import { ownClosest } from './own-rows';
import { HEADING_CLASS, ITEM_CLASS, lineOf, TICK_SELECTOR } from './render-list';
import { closeCardForSelection, drawSelection, focusList, selectOnHold } from './select';

// What a hold doesn't count on: the checkbox and the zone beside it, the collapse arrow, a link and a field.
const NOT_A_HOLD_ZONE = `${TICK_SELECTOR}, .${COLLAPSE_CLASS}, a, textarea, input`;

interface MousePress extends PointerMark {
	row: HTMLElement;
	holdTimer: number;
}

/**
 * Selecting with a mouse by holding a row or a heading (spec, "Starting to select"): a press of the
 * main button, with no modifier, held in place as long as a touch hold selects the row as a touch
 * hold does, with the open card's item. The card closes at the release, or as the browser's drag
 * starts. Moving past the touch tolerance first, or the browser's drag, forgets the press. The click
 * that follows the release is swallowed. Desktop only.
 */
export function enableMouseHold(view: PrinceListView): void {
	const rowsEl = view.listScrollEl;
	let press: MousePress | null = null;
	// A hold selected the open card's item, and the card closes once the button is up.
	let cardToClose = false;
	const closeHeldCard = (): void => {
		if (!cardToClose) return;
		cardToClose = false;
		if (closeCardForSelection(view) === null) return;
		focusList(view);
		drawSelection(view);
	};
	const forgetPress = (): void => {
		if (!press) return;
		window.clearTimeout(press.holdTimer);
		press = null;
	};
	view.register(forgetPress);
	view.registerDomEvent(rowsEl, 'pointerdown', (evt) => {
		forgetPress();
		cardToClose = false;
		if (evt.pointerType !== 'mouse' || evt.button !== 0 || evt.ctrlKey || evt.metaKey || evt.shiftKey || evt.altKey) return;
		const target = targetOf(evt);
		if (!target || target.closest(NOT_A_HOLD_ZONE)) return;
		const row = ownClosest(rowsEl, target, `.${ITEM_CLASS}, .${HEADING_CLASS}`);
		if (!row || row.hasClass(CARD_CLASS) || view.card?.el.contains(target)) return;
		const holdTimer = window.setTimeout(() => {
			cardToClose = holdRow(view, row);
		}, HOLD_MS);
		press = { row, x: evt.clientX, y: evt.clientY, holdTimer };
	});
	view.registerDomEvent(rowsEl, 'pointermove', (evt) => {
		if (press && !isInPlace(press, { x: evt.clientX, y: evt.clientY })) forgetPress();
	});
	// On the window, since the button can come up outside the list once the press is forgotten.
	view.registerDomEvent(rowsEl.win, 'pointerup', () => {
		forgetPress();
		closeHeldCard();
	});
	// The drag closes the card itself.
	view.registerDomEvent(rowsEl, 'dragstart', () => {
		forgetPress();
		cardToClose = false;
		view.swallowNextClick = false;
	});
	view.registerDomEvent(rowsEl, 'pointercancel', forgetPress);
	view.registerDomEvent(rowsEl, 'pointerleave', forgetPress);
	// Switching away mid-hold loses the pointerup, so the blur ends the press.
	view.registerDomEvent(rowsEl.win, 'blur', () => {
		forgetPress();
		closeHeldCard();
	});
}

// Selects the held row with the open card's item, and returns whether a card is open. The card stays
// open while the button is down, since closing it can move the row from under the press, and Chromium
// cancels a drag that starts from a row that moved (step one, "Dragging").
function holdRow(view: PrinceListView, row: HTMLElement): boolean {
	const line = lineOf(row);
	if (line === null || !row.isConnected) return false;
	view.swallowNextClick = true;
	selectOnHold(view, line, view.card ? view.selected : null);
	return view.card !== null;
}
