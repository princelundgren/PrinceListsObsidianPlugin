import { MOVE_TOLERANCE_PX } from '../core/touch-drag';
import { targetOf } from './dom';
import type { PrinceListView } from './list-view';
import { notesHostOf } from './notes-host';

// Where the last press on drawn notes went down, in each view.
const presses = new WeakMap<PrinceListView, { x: number; y: number }>();

/** Remembers where a press on drawn notes went down, for `endsSelectingDrag`; any other press forgets it. */
export function recordNotesPress(view: PrinceListView, press: MouseEvent): void {
	const target = targetOf(press);
	if (target && !target.closest('textarea') && notesHostOf(view, target)) presses.set(view, { x: press.clientX, y: press.clientY });
	else presses.delete(view);
}

/**
 * Whether `click` ends a drag over drawn notes that selected text, which stays selected to copy. The
 * click goes to whatever holds both ends of the drag, a row too, so only the press tells it apart.
 */
export function endsSelectingDrag(view: PrinceListView, click: MouseEvent): boolean {
	const press = presses.get(view);
	presses.delete(view);
	// A click from the keyboard has no position, and no press of its own.
	if (!press || click.detail === 0 || Math.hypot(click.clientX - press.x, click.clientY - press.y) <= MOVE_TOLERANCE_PX) return false;
	const selection = view.contentEl.doc.getSelection();
	return selection !== null && !selection.isCollapsed;
}
