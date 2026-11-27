import { Platform, setIcon, setTooltip } from 'obsidian';
import { showsOn } from '../core/button-platforms';
import { planItemInsert, type ItemPlace } from '../core/list-actions';
import { contentStartLine, isListText } from '../obsidian/marker';
import { closeCard, focusCardTitle, isNewEmptyItem, openCard } from './card';
import { expandFor } from './collapse';
import { isTextField } from './dom';
import type { RowDragHost } from './drag-host';
import { enableNewItemDrag } from './drag-new-item';
import type { PrinceListView } from './list-view';
import { enqueueAt, writePlanned } from './write';

// The floating "+" (spec, "Selecting and adding"). It goes outside listScrollEl, which is what
// scrolls, so it stays put while the list scrolls. The view hides it in a note that isn't a list,
// and where the settings turn it off. Dragged onto the list, it adds the item where it drops, and
// `edgeScroll` is what a touch drag scrolls at the edges, as a row's does.
export function buildNewItemButton(view: PrinceListView, label: string, edgeScroll: RowDragHost['edgeScroll']): HTMLButtonElement {
	view.containerEl.addClass('princelists-view');
	view.containerEl.toggleClass('princelists-clears-status-bar', !Platform.isMobile);
	const button = view.containerEl.createEl('button', { cls: 'princelists-new-item', attr: { 'aria-label': label } });
	setTooltip(button, label);
	setIcon(button, 'plus');
	const swallowsClick = enableNewItemDrag(view, button, edgeScroll, (place) => {
		if (isListText(view.text)) addItem(view, place);
	});
	view.registerDomEvent(button, 'click', () => {
		if (!swallowsClick()) newItem(view);
	});
	if (Platform.isMobile) {
		// On the container, so a tag popover's field, which sits outside contentEl, counts too. They run
		// after contentEl's focus listeners, so a card a focusout closes is gone by then.
		view.registerDomEvent(view.containerEl, 'focusin', (evt) => syncNewItemButton(view, evt.targetNode));
		// FocusEvent types it as an EventTarget; between elements it is an Element or null.
		view.registerDomEvent(view.containerEl, 'focusout', (evt) => syncNewItemButton(view, evt.relatedTarget as Node | null));
	}
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

// Expands the section `place` is in, so the open card closes to its row there rather than redrawing the
// section collapsed, closes the card, then adds an empty item at `place` and opens it with the cursor
// in its title.
// The insert queues behind the removal of an empty item that closing the card may start.
export function addItem(view: PrinceListView, place: ItemPlace): void {
	expandFor(view, place);
	whileAdding(view, () => {
		closeCard(view);
		const anchor = place === 'first' ? null : 'after' in place ? place.after : place.firstUnder;
		enqueueAt(view, anchor, async (pending) => {
			const added = await writePlanned(view, (text) => {
				const followed = followPlace(place, pending?.line ?? null);
				return followed ? planItemInsert(text, contentStartLine(text), followed) : null;
			});
			if (added) openCard(view, added.line, true, added.inserted);
		});
	});
}

/**
 * Runs `add`, which queues the write of a new item or heading, and counts it as pending until that
 * write's task is done, so on mobile the floating "+" stays hidden until the card or field opens.
 */
export function whileAdding(view: PrinceListView, add: () => void): void {
	view.addsPending++;
	add();
	syncNewItemButton(view);
	// Queued after the add's write, so it runs however that ends, also when the write never starts.
	void view.enqueue(async () => {
		view.addsPending--;
		syncNewItemButton(view);
	});
}

// The place at its item's or heading's line as the view's edits have moved it, or null once it's gone.
export function followPlace(place: ItemPlace, line: number | null): ItemPlace | null {
	if (place === 'first') return place;
	if (line === null) return null;
	return 'after' in place ? { after: line } : { firstUnder: line };
}

/**
 * Shows the floating "+" where the view places it, except on mobile while a card is open, an item
 * or heading is being added, or a text field in the view has focus, a tag popover's included.
 * `focused` is the node that has focus, or is taking it.
 */
export function syncNewItemButton(view: PrinceListView, focused: Node | null = view.containerEl.doc.activeElement): void {
	const typing = isTextField(focused) && view.containerEl.contains(focused);
	const editing = Platform.isMobile && (view.card !== null || view.addsPending > 0 || typing);
	view.newItemButton?.toggle(!editing && placesFloatingAdd(view));
}

/** Whether the settings show the floating "+" that adds an item on this device. */
export function showsAddButton(view: PrinceListView): boolean {
	return showsOn(view.settings().floatingAddButton, Platform.isMobile);
}

/** Whether the view places the floating "+": a list not selecting, with the settings showing it on this device. */
export function placesFloatingAdd(view: PrinceListView): boolean {
	return isListText(view.text) && !view.selecting && showsAddButton(view);
}
