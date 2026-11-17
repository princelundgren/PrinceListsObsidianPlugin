import type { Menu } from 'obsidian';
import type { PrinceListView } from './list-view';
import { onMenuHide } from './menu-anchor';

/** Shows `menu` with `show`, and records it as the view's shown menu until it hides. */
export function showViewMenu(view: PrinceListView, menu: Menu, show: () => void): void {
	view.shownMenu = menu;
	onMenuHide(menu, () => {
		// Showing another menu hides this one after the other is recorded.
		if (view.shownMenu === menu) view.shownMenu = null;
	});
	show();
}

/**
 * A primary press in the list while one of the view's menus shows only closes the menu, as a press
 * outside an open card only closes the card (spec, "Selecting and adding"): it opens, ticks, selects
 * and drags nothing, and its click is held back. Obsidian closes the menu on the press's mousedown, after
 * these run in the capture phase.
 */
export function registerMenuPress(view: PrinceListView): void {
	view.registerDomEvent(view.containerEl, 'pointerdown', (evt) => {
		if (!evt.isPrimary || !pressClosesMenu(view, evt)) return;
		view.swallowNextClick = true;
		evt.stopPropagation();
	}, { capture: true });
	view.registerDomEvent(view.containerEl, 'mousedown', (evt) => {
		if (!pressClosesMenu(view, evt)) return;
		// No native drag and no focus change; the event still reaches Obsidian, which closes the menu.
		evt.preventDefault();
		// A menu with no entries never shows, so it never hides: the press clears it either way.
		view.shownMenu = null;
	}, { capture: true });
}

function pressClosesMenu(view: PrinceListView, evt: MouseEvent): boolean {
	return view.shownMenu !== null && evt.button === 0 && view.contentEl.contains(evt.targetNode);
}
