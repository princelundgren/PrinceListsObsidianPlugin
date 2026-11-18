import { escapeRepeatPopover, isInRepeatPopover } from './card-repeat';
import { escapeTagPopover } from './card-tags';
import { forgetPicker, pickerShowed, WHEN_INPUT_CLASS } from './card-when';
import type { PrinceListView } from './list-view';

/**
 * A primary press in the list outside the open card's tag popover, repeat popover or date picker only
 * closes it, as a press while one of the view's menus shows only closes the menu (spec, "Selecting and
 * adding"): it opens, ticks, selects and drags nothing, its click is held back, and the card stays
 * open. Focus goes back to the popover's button, and stays where it was for the date picker. Both
 * run in the capture phase, before the view's own listeners.
 */
export function registerPopoverPress(view: PrinceListView): void {
	let pressClosedIt = false;
	view.registerDomEvent(view.containerEl, 'pointerdown', (evt) => {
		pressClosedIt = evt.isPrimary && evt.button === 0 && closePopoverAt(view, evt.targetNode);
		if (!pressClosedIt) return;
		view.swallowNextClick = true;
		evt.stopPropagation();
	}, { capture: true });
	view.registerDomEvent(view.containerEl, 'mousedown', (evt) => {
		// No native drag and no focus change: the focus the close gave, or had, stays.
		if (pressClosedIt) evt.preventDefault();
		pressClosedIt = false;
	}, { capture: true });
}

// Closes what a press on `target` closes, and returns whether it closed anything.
function closePopoverAt(view: PrinceListView, target: Node | null): boolean {
	// A press while a menu shows over the popover closes only the menu.
	if (view.shownMenu !== null || !view.contentEl.contains(target)) return false;
	if (view.tagPopover) {
		if (view.tagPopover.el.contains(target)) return false;
		escapeTagPopover(view);
		return true;
	}
	if (view.repeatPopover) {
		if (isInRepeatPopover(view, target)) return false;
		escapeRepeatPopover(view);
		return true;
	}
	const dateInput = view.card?.el.querySelector<HTMLInputElement>(`.${WHEN_INPUT_CLASS}`);
	if (!dateInput || !pickerShowed(dateInput)) return false;
	forgetPicker(dateInput);
	return true;
}
