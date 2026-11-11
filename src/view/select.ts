import { Keymap } from 'obsidian';
import { isListText } from '../obsidian/marker';
import { addItem, newItem } from './add-button';
import { CARD_CLASS, closeCard } from './card';
import type { PrinceListView } from './list-view';
import { shownRows } from './move';
import { ownClosest, ownElements } from './own-rows';
import { CHECKBOX_CLASS, END_CLASS, HEADING_CLASS, ITEM_CLASS, ITEMS_CLASS, LINE_ATTR, lineOf, TICK_SELECTOR } from './render-list';

// The class on a selected row or heading.
const SELECTED_CLASS = 'princelists-selected';
const SELECTED_FIRST_CLASS = 'princelists-selected-first';
const SELECTED_LAST_CLASS = 'princelists-selected-last';
const STATUS_CLASS = 'princelists-selection-status';
const ROW_SELECTOR = `.${ITEM_CLASS}[${LINE_ATTR}], .${HEADING_CLASS}[${LINE_ATTR}]`;

let describers = 0;

// Each view's live region, which says how many rows are selected, and the hidden "Selected" that a
// selected row's checkbox and a selected heading are described by.
const announcers = new WeakMap<PrinceListView, { status: HTMLElement; describerId: string }>();

/**
 * Handles a click on a row, a heading, a checkbox or the zone beside one with Cmd or Shift held, or a
 * click or a tap on one while selecting: Cmd and the plain click or tap add or remove the row, Shift
 * selects the shown rows from the anchor to it, and either starts selecting. An open card closes
 * first, its item selected; while selecting, a plain click or tap only closes it. Returns whether it
 * handled the click. Before selecting, a plain click on a row or heading, not on a checkbox or beside
 * it, makes it the anchor, and one on empty space clears the anchor; both return false.
 */
export function onSelectClick(view: PrinceListView, evt: MouseEvent, target: HTMLElement): boolean {
	if (isEmptySpace(view, target)) {
		if (!view.selecting) clearSelection(view);
		return false;
	}
	const rowEl = selectableRowAt(view, target);
	const line = rowEl ? lineOf(rowEl) : null;
	if (line === null) return false;
	const toggles = Keymap.isModifier(evt, 'Mod');
	const ranges = Keymap.isModifier(evt, 'Shift');
	// A card a row's own menu opened while selecting: the click only closes it (step one, "Selecting and adding").
	if (view.selecting && view.card && !toggles && !ranges) {
		evt.preventDefault();
		closeCard(view);
		focusList(view);
		return true;
	}
	const adds = view.selecting || toggles;
	if (!adds && !ranges) {
		if (!target.closest(TICK_SELECTOR)) {
			view.selection.clear();
			view.selection.setAnchor(line);
			drawSelection(view);
		}
		return false;
	}
	// Selects instead of ticking, and a checkbox mustn't show a tick the file doesn't hold.
	evt.preventDefault();
	const cardLine = closeCardForSelection(view);
	if (ranges) {
		if (cardLine !== null) view.selection.setAnchor(cardLine);
		view.selection.selectRange(line, selectableLines(view));
	} else {
		if (cardLine !== null && !view.selection.has(cardLine)) view.selection.toggle(cardLine);
		view.selection.toggle(line);
	}
	view.selecting = true;
	focusList(view);
	drawSelection(view);
	return true;
}

/** Keeps a Shift+click on a row from starting a text selection in the browser. */
export function keepTextUnselected(view: PrinceListView, evt: MouseEvent): void {
	const target = evt.targetNode;
	if (!Keymap.isModifier(evt, 'Shift') || !target?.instanceOf(HTMLElement)) return;
	if (selectableRowAt(view, target)) evt.preventDefault();
}

/**
 * Moves the range's far end one shown row up (-1) or down (1), from the open card's item when a card
 * is open, which closes, and starts selecting. Returns whether it moved: false when the anchor isn't a
 * shown row, such as an empty new item that closing its card removed.
 */
export function extendSelection(view: PrinceListView, step: 1 | -1): boolean {
	const cardLine = closeCardForSelection(view);
	if (cardLine !== null) view.selection.setAnchor(cardLine);
	const shown = selectableLines(view);
	const anchor = view.selection.anchor;
	const moves = anchor !== null && shown.includes(anchor);
	if (moves) {
		view.selection.extend(step, shown);
		view.selecting = true;
		drawSelection(view);
	}
	// A card that closed took focus with it.
	if (moves || cardLine !== null) focusList(view);
	return moves;
}

/**
 * A hold let go without moving on the row on `line`. Not yet selecting, it starts selecting with that
 * row and `cardLine`, the item whose card the hold closed, if any. While selecting, it selects the shown
 * rows to it from `cardLine`, or with no card from the last row clicked, tapped or held, as
 * Shift+click does.
 */
export function selectOnHold(view: PrinceListView, line: number, cardLine: number | null): void {
	if (view.selecting) {
		if (cardLine !== null) view.selection.setAnchor(cardLine);
		view.selection.addRangeTo(line, selectableLines(view));
	} else view.selection.startWith(line, cardLine);
	view.selecting = true;
	drawSelection(view);
}

/**
 * Select in a row's or a heading's menu: selects the row on `line`, with the open card's item, which
 * closes the card. Starts selecting, or adds the rows while selecting.
 */
export function selectRow(view: PrinceListView, line: number): void {
	const cardLine = closeCardForSelection(view);
	if (view.selecting) {
		if (cardLine !== null && !view.selection.has(cardLine)) view.selection.toggle(cardLine);
		if (!view.selection.has(line)) view.selection.toggle(line);
	} else {
		view.selection.startWith(line, cardLine);
	}
	view.selecting = true;
	focusList(view);
	drawSelection(view);
}

/** Ends the selection, and with it selecting. Returns whether any row was selected. */
export function clearSelection(view: PrinceListView): boolean {
	const hadRows = view.selection.size > 0;
	view.selection.clear();
	if (hadRows) drawSelection(view);
	return hadRows;
}

/**
 * Drops the selected rows that no longer show, marks the rest, and announces how many are selected.
 * Selecting ends once none is left. The bar follows only while selecting, so a way into selecting sets
 * `view.selecting` before calling this. Runs after every redraw.
 */
export function drawSelection(view: PrinceListView): void {
	view.selection.keepOnly(new Set(selectableLines(view)));
	const selected = new Set(view.selection.lines());
	const { status, describerId } = announcerOf(view);
	const rowEls = ownElements(view.listScrollEl, ROW_SELECTOR);
	const isSelected = rowEls.map((rowEl) => {
		const line = lineOf(rowEl);
		return line !== null && selected.has(line) && !rowEl.hasClass(CARD_CLASS);
	});
	rowEls.forEach((rowEl, i) => {
		const here = isSelected[i] === true;
		const place = { first: here && isSelected[i - 1] !== true, last: here && isSelected[i + 1] !== true };
		markRow(rowEl, here, place, describerId);
	});
	const count = selected.size === 0 ? '' : `${selected.size} selected`;
	if (status.getText() !== count) status.setText(count);
	const wasSelecting = view.selecting;
	if (selected.size === 0) view.selecting = false;
	if (wasSelecting) view.syncButtons();
}

/**
 * Cmd+Enter: with an item selected, adds an item below the last selected item in list order; with
 * no item selected, adds one as "+" does. Either way the selection ends.
 */
export function newItemBelowSelection(view: PrinceListView): void {
	if (!isListText(view.text)) return;
	const selected = view.selection.lines();
	const items = new Set(shownRows(view.listScrollEl).filter((row) => row.kind === 'item').map((row) => row.line));
	const lastItem = selected.filter((line) => items.has(line)).pop();
	clearSelection(view);
	if (lastItem !== undefined) addItem(view, { after: lastItem });
	else newItem(view);
}

/**
 * Focuses the list each time the view's leaf becomes active, such as from its tab, when nothing in the
 * view has focus and no card, heading field or filter is open, so the view's keys and Escape reach it.
 */
export function focusListWhenActive(view: PrinceListView): void {
	view.registerEvent(
		view.app.workspace.on('active-leaf-change', (leaf) => {
			if (leaf !== view.leaf || view.card || view.headingField || view.filterField) return;
			if (view.containerEl.contains(view.containerEl.doc.activeElement)) return;
			focusList(view);
		}),
	);
}

/**
 * Closes the open card and returns its item's line, so a way into selecting can select it too;
 * null with no card open.
 */
export function closeCardForSelection(view: PrinceListView): number | null {
	if (!view.card) return null;
	const line = view.selected;
	closeCard(view);
	return line;
}

// The shown items and headings, in the order they show; the open card counts as its item.
function selectableLines(view: PrinceListView): number[] {
	return shownRows(view.listScrollEl)
		.filter((row) => row.kind !== 'untouched')
		.map((row) => row.line);
}

// The row or heading `target` is on, outside the open card.
function selectableRowAt(view: PrinceListView, target: HTMLElement): HTMLElement | null {
	if (view.card?.el.contains(target)) return null;
	return ownClosest(view.contentEl, target, ROW_SELECTOR);
}

function isEmptySpace(view: PrinceListView, target: HTMLElement): boolean {
	return target === view.listScrollEl || target === view.listSizerEl || target.hasClass(ITEMS_CLASS) || target.hasClass(END_CLASS);
}

/**
 * Focuses the list without scrolling it, so the view's keys and Escape keep reaching the view once what
 * had focus, such as a card or the bar, is gone. The rows themselves aren't focusable (#125).
 */
export function focusList(view: PrinceListView): void {
	view.listScrollEl.focus({ preventScroll: true });
}

function markRow(rowEl: HTMLElement, isSelected: boolean, place: { first: boolean; last: boolean }, describerId: string): void {
	rowEl.toggleClass(SELECTED_CLASS, isSelected);
	rowEl.toggleClass(SELECTED_FIRST_CLASS, place.first);
	rowEl.toggleClass(SELECTED_LAST_CLASS, place.last);
	// aria-selected isn't valid on a list item or a heading; aria-describedby is valid on any element.
	const described = rowEl.hasClass(HEADING_CLASS) ? rowEl : rowEl.querySelector(`.${CHECKBOX_CLASS}`);
	if (!described) return;
	if (isSelected) described.setAttr('aria-describedby', describerId);
	else described.removeAttribute('aria-describedby');
}

function announcerOf(view: PrinceListView): { status: HTMLElement; describerId: string } {
	const found = announcers.get(view);
	if (found) return found;
	const describerId = `princelists-selected-${++describers}`;
	view.contentEl.createSpan({ text: 'Selected', attr: { id: describerId, hidden: '' } });
	const status = view.contentEl.createDiv({ cls: STATUS_CLASS, attr: { role: 'status' } });
	const made = { status, describerId };
	announcers.set(view, made);
	return made;
}
