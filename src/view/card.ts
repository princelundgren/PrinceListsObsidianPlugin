import { Notice, setIcon, type Component, type TFile } from 'obsidian';
import { isShown, itemRow, type ItemRow } from '../core/display';
import { UnsafeEditError } from '../core/edit-check';
import { isEmptyItem, planRemoval, type InsertedItem, type Removal } from '../core/empty-item';
import type { TrackedLine } from '../core/editing';
import { parseItemLine } from '../core/item-line';
import { missingTyping } from '../core/missing-typing';
import { itemAt } from '../core/parse';
import { contentStartLine } from '../obsidian/marker';
import { buildWhenPicker, showWhen } from './card-when';
import { addHiddenLabel, fitHeight, HIDDEN_LABEL_CLASS } from './dom';
import { FIELD_CLASS, keepOneLine } from './fields';
import type { PrinceListView } from './list-view';
import { drawPieces } from './note-piece-field';
import { cardNotesHost } from './notes-host';
import { buildRow, CHECKBOX_CLASS, ITEM_CLASS, LINE_ATTR, setLine, showDone } from './render-list';
import { CHANGED_ELSEWHERE_NOTICE, showLostTypingNotice, UNSAFE_EDIT_NOTICE, writeAction } from './write';

export const CARD_CLASS = 'princelists-card';
export const CARD_TITLE_CLASS = 'princelists-card-title';
export const CARD_NOTES_CLASS = 'princelists-card-notes';
export const NOTES_EDITOR_CLASS = 'princelists-card-notes-editor';
export const CARD_ACTIONS_CLASS = 'princelists-card-actions';
export const CARD_STAR_CLASS = 'princelists-card-star';

export interface Card {
	el: HTMLElement;
	/** The drawn notes' Component. */
	notes: Component | null;
	/** Set when this card's own insert created its item, so closing it may remove the item again. */
	inserted: InsertedItem | null;
	/**
	 * Where the card was when an outside change took its item while it had focus.
	 * It closes on blur.
	 */
	lostAt: number | null;
}

// Opens the item at `titleLine` in place of its row, closing any open card first. The cursor goes in
// the title only when `focusTitle` is set, so a tap on a row doesn't open the on-screen keyboard; the
// card itself takes focus otherwise, so Escape reaches it. A card opened on an item its own insert
// created passes `inserted`.
export function openCard(view: PrinceListView, titleLine: number, focusTitle = false, inserted?: InsertedItem): void {
	closeCard(view);
	view.editing.open(titleLine);
	const card: Card = { el: createCardElement(), notes: null, inserted: inserted ?? null, lostAt: null };
	view.card = card;
	// A new item has no row yet, nor does one that is hidden, so the view draws the card in its place.
	const row = view.contentEl.querySelector<HTMLElement>(`.${ITEM_CLASS}:not(.${CARD_CLASS})[${LINE_ATTR}="${titleLine}"]`);
	if (row) {
		refreshCard(view, card);
		view.dropBlock(row);
		row.replaceWith(card.el);
	} else {
		view.render();
	}
	const title = card.el.querySelector<HTMLTextAreaElement>(`.${CARD_TITLE_CLASS}`);
	if (title) fitHeight(title);
	if (focusTitle) title?.focus();
	else card.el.focus({ preventScroll: true });
}

// The user closed the card in the view, in one of the ways the spec lists ("Selecting and adding"). An
// empty item the card created goes again, through the view's write queue, so an action queued after
// this one sees the list without it.
export function closeCard(view: PrinceListView): void {
	const card = view.card;
	if (!card) return;
	const line = view.editing.selected;
	endCard(view, card);
	const file = view.file;
	if (card.inserted && line !== null && file && isEmptyAt(view, line)) {
		card.el.remove();
		const pending = view.editing.track(line);
		const inserted = card.inserted;
		void view.enqueue(() => removeEmptyItem(view, file, pending, inserted));
		return;
	}
	const row = rowAt(view, line);
	if (row && isShown(row, view.showArchived)) {
		card.el.replaceWith(buildRow(view, view.sourcePath, row, view.blocks));
	} else {
		card.el.remove();
	}
}

// Whether the open card is on `line` and holds an empty item its own insert added, which closing the
// card removes.
export function isNewEmptyItem(view: PrinceListView, line: number | null = view.selected): boolean {
	return view.card?.inserted != null && line !== null && line === view.selected && isEmptyAt(view, line);
}

export function focusCardTitle(view: PrinceListView): void {
	view.card?.el.querySelector<HTMLTextAreaElement>(`.${CARD_TITLE_CLASS}`)?.focus();
}

// Closes it without removing anything: its item is gone, or the view is about to draw from scratch.
export function dismissCard(view: PrinceListView): void {
	const card = view.card;
	if (!card) return;
	endCard(view, card);
	card.el.remove();
}

// For a redraw that didn't keep the card.
export function redrawCard(view: PrinceListView, card: Card): void {
	card.el = createCardElement();
	refreshCard(view, card);
}

// Fills the card from the text, or, after a redraw that kept it, updates its line, its box and the
// fields without focus, which update after blur (spec, "Saving and outside changes").
export function refreshCard(view: PrinceListView, card: Card): void {
	// A lost card has no item to read: it keeps what it shows until it closes.
	if (card.lostAt !== null) return;
	const row = rowAt(view, view.editing.selected);
	if (row) {
		setLine(card.el, row.titleLine);
		card.el.querySelector(`.${HIDDEN_LABEL_CLASS}`)?.setText(row.label);
		showDone(card.el, row);
		showWhen(card, row.when);
		showStar(card.el, row.starred);
	}
	const title = card.el.querySelector<HTMLTextAreaElement>(`.${CARD_TITLE_CLASS}`);
	const focused = card.el.doc.activeElement;
	if (title && focused !== title) title.value = view.editing.selectedTitle();
	const notes = card.el.querySelector<HTMLElement>(`.${CARD_NOTES_CLASS}`);
	if (notes) drawPieces(view, cardNotesHost(view, card, notes));
}

export function cardTitleInput(view: PrinceListView, field: HTMLTextAreaElement): void {
	keepOneLine(field);
	view.handleTyped(view.editing.typeTitle(field.value));
}

// Everything after the title stays hidden while it is edited (spec, "Editing"), so leaving the field
// shows the title as the line now reads.
export function cardTitleBlur(view: PrinceListView, field: HTMLTextAreaElement): void {
	view.editing.blurTitle();
	const card = view.card;
	if (!card || card.lostAt !== null) return;
	field.value = view.editing.selectedTitle();
	fitHeight(field);
}

// An outside change took the card's item. A card with focus stays until it loses it, so the field
// isn't torn down mid-word, but its typing has nowhere to go any more: the notice says so, and its
// fields take no more typing. Typing that the change dropped from the file can be copied.
export function cardLost(view: PrinceListView, card: Card, line: number): void {
	const focused = card.el.doc.activeElement;
	if (card.el.contains(focused)) {
		card.lostAt = line;
		setLine(card.el, null);
		for (const field of card.el.querySelectorAll('textarea')) field.readOnly = true;
		const typed = focused?.instanceOf(HTMLTextAreaElement) ? focused.value : '';
		sayFieldLost(view, typed, focused?.hasClass(CARD_TITLE_CLASS) ? 'title' : 'notes');
	} else {
		dismissCard(view);
	}
}

// For a field whose lines an outside change took: its typing can be copied if the file lost it.
export function sayFieldLost(view: PrinceListView, typed: string, field: 'title' | 'notes'): void {
	if (missingTyping(view.text, typed, field)) showLostTypingNotice(view.contentEl.win, typed);
	else new Notice(CHANGED_ELSEWHERE_NOTICE);
}

function endCard(view: PrinceListView, card: Card): void {
	view.card = null;
	view.editing.close();
	if (card.notes) view.removeChild(card.notes);
	card.notes = null;
}

function createCardElement(): HTMLElement {
	const el = createEl('li', { cls: [ITEM_CLASS, CARD_CLASS], attr: { tabindex: -1 } });
	addHiddenLabel(el.createEl('input', { cls: CHECKBOX_CLASS, type: 'checkbox' }), '');
	const body = el.createDiv({ cls: 'princelists-card-body' });
	body.createEl('textarea', { cls: [FIELD_CLASS, CARD_TITLE_CLASS], attr: { rows: 1, placeholder: 'Title' } });
	body.createDiv({ cls: CARD_NOTES_CLASS });
	const tools = el.createDiv({ cls: 'princelists-card-tools' });
	buildWhenPicker(tools);
	setIcon(tools.createEl('button', { cls: CARD_STAR_CLASS, attr: { 'aria-label': 'Add star' } }), 'star');
	const actions = tools.createEl('button', { cls: CARD_ACTIONS_CLASS, attr: { 'aria-label': 'Item actions' } });
	setIcon(actions, 'more-horizontal');
	return el;
}

function showStar(cardEl: HTMLElement, starred: boolean): void {
	const star = cardEl.querySelector(`.${CARD_STAR_CLASS}`);
	star?.toggleClass('is-starred', starred);
	star?.setAttribute('aria-label', starred ? 'Remove star' : 'Add star');
}

function rowAt(view: PrinceListView, line: number | null): ItemRow | null {
	const text = line === null ? undefined : view.lines()[line]?.text;
	return line !== null && text !== undefined && parseItemLine(text) ? itemRow(text, line, new Date()) : null;
}

function isEmptyAt(view: PrinceListView, line: number): boolean {
	const { lines, model } = view.parse();
	const item = itemAt(model, line);
	return item !== undefined && isEmptyItem(lines, item);
}

// Restores the text from before the insert, or, once the file changed, deletes the item from the
// current text, with no notice for a write refused on the way (spec, "Selecting and adding"). A write
// that failed has said so, and isn't tried again.
async function removeEmptyItem(view: PrinceListView, file: TFile, pending: TrackedLine, inserted: InsertedItem): Promise<void> {
	const plan = (restore: boolean): Removal | null => {
		if (view.file !== file || pending.line === null) return null;
		try {
			return planRemoval(view.text, contentStartLine(view.text), pending.line, inserted, restore);
		} catch (error) {
			if (!(error instanceof UnsafeEditError)) throw error;
			// The empty item stays.
			new Notice(UNSAFE_EDIT_NOTICE);
			return null;
		}
	};
	const write = (removal: Removal) => writeAction(view, removal.next, removal.expected, null, removal.edit);
	try {
		const first = plan(true);
		if (!first || (await write(first)) !== 'refused') return;
		// A refused restore, or typing since the plan, falls back to deleting the item from the text as
		// it now is. A refused delete with nothing typed since was the file changing elsewhere.
		const restoreTried = first.expected === inserted.textAfter;
		if (!restoreTried && view.text === first.expected) return;
		const second = plan(false);
		if (second) await write(second);
	} finally {
		view.editing.untrack(pending);
		// The card went without its row, and the item may have stayed.
		if (view.file === file) view.render();
	}
}
