import { Platform, setIcon } from 'obsidian';
import { planItemInsert, type ItemPlace } from '../core/list-actions';
import { contentStartLine, isListText } from '../obsidian/marker';
import { closeCard, focusCardTitle, isNewEmptyItem, openCard } from './card';
import type { PrinceListView } from './list-view';
import { enqueueAt, writePlanned } from './write';

// The floating "+" (spec, "Selecting and adding"). It goes outside listScrollEl, which is what
// scrolls, so it stays put while the list scrolls. The view hides it in a note that isn't a list.
export function buildNewItemButton(view: PrinceListView): HTMLButtonElement {
	view.containerEl.addClass('princelists-view');
	view.containerEl.toggleClass('princelists-has-status-bar', !Platform.isMobile);
	const button = view.containerEl.createEl('button', { cls: 'princelists-new-item', attr: { 'aria-label': 'New item' } });
	setIcon(button, 'plus');
	view.registerDomEvent(button, 'click', () => newItem(view));
	return button;
}

// Below the selected item, or first in the list. An empty item the open card added stays as the new
// one: "+" closes the card, which would remove it, only for the new item to take its place. The view
// can show a note whose marker went, where nothing is added.
export function newItem(view: PrinceListView): void {
	if (!isListText(view.text)) return;
	if (isNewEmptyItem(view)) {
		focusCardTitle(view);
		return;
	}
	const selected = view.selected;
	addItem(view, selected === null ? 'first' : { after: selected });
}

// Shift+Enter in an open card's title. On an empty item the card added, it only closes the card,
// which removes the item, so a second Shift+Enter ends a run of new items.
export function addItemBelowCard(view: PrinceListView): void {
	const selected = view.selected;
	if (selected === null) return;
	if (isNewEmptyItem(view)) closeCard(view);
	else addItem(view, { after: selected });
}

// In a list with no items yet, Enter in the title starts the first one (spec, "Selecting and adding").
export function hasNoItems(view: PrinceListView): boolean {
	return isListText(view.text) && view.parse().model.sections.every((section) => section.items.length === 0);
}

// Closes the open card, then adds an empty item at `place` and opens it with the cursor in its title.
// The insert queues behind the removal of an empty item that closing the card may start.
export function addItem(view: PrinceListView, place: ItemPlace): void {
	closeCard(view);
	const anchor = place === 'first' ? null : 'after' in place ? place.after : place.firstUnder;
	enqueueAt(view, anchor, async (pending) => {
		const added = await writePlanned(view, (text) => {
			const followed = followPlace(place, pending?.line ?? null);
			return followed ? planItemInsert(text, contentStartLine(text), followed) : null;
		});
		if (added) openCard(view, added.line, true, added.inserted);
	});
}

// The place at its item's or heading's line as the view's edits have moved it, or null once it's gone.
export function followPlace(place: ItemPlace, line: number | null): ItemPlace | null {
	if (place === 'first') return place;
	if (line === null) return null;
	return 'after' in place ? { after: line } : { firstUnder: line };
}
