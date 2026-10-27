import { Platform } from 'obsidian';
import { isListText } from '../obsidian/marker';
import { hasNoItems } from './add-button';
import { dismissCard, redrawCard, refreshCard } from './card';
import { fitHeight, replaceKeeping } from './dom';
import { buildListNote, buildListTitle } from './fields';
import { buildFilterField } from './filter';
import type { PrinceListView } from './list-view';
import { OPEN_AS_MARKDOWN_CLASS, renderList, type CardPlace, type FieldPlace } from './render-list';

// Draws everything again from the view's text, except the title, list note, card or heading field that
// holds focus, or is about to (`focusing`): those stay in place and update after blur.
export function redraw(view: PrinceListView, focusing: Element | null): void {
	const { contentEl, listScrollEl, listSizerEl } = view;
	const { scrollTop } = listScrollEl;
	const kept = keptElement(view, focusing);
	const isEmpty = hasNoItems(view);
	for (const block of view.blocks.values()) view.removeChild(block);
	view.blocks.clear();
	const fresh = createDiv();
	let slot: HTMLElement | null = null;
	if (kept && kept === view.listTitleEl) slot = fresh.createDiv();
	else view.listTitleEl = buildListTitle(view, fresh);
	if (isListText(view.text)) {
		const { lines, model } = view.parse();
		if (kept && kept === view.listNoteEl) slot = fresh.createDiv();
		else view.listNoteEl = buildListNote(view, fresh, lines, model);
		if (view.filter === null) view.filterEl = null;
		else if (kept && kept === view.filterEl) slot = fresh.createDiv();
		else view.filterEl = buildFilterField(view, fresh);
		const card = placeCard(view, kept);
		if (card?.keeps) slot = card.el;
		const field = placeField(view, kept);
		if (field?.keeps) slot = field.el;
		view.rowsHeldBack = renderList(view, fresh, lines, model, card, view.blocks, view.editing.listNoteRange(), field);
		if (isEmpty) fresh.createDiv({ cls: 'princelists-empty-hint', text: emptyHint() });
		// Room to scroll the last row clear of the floating "+".
		fresh.createDiv({ cls: 'princelists-end' });
	} else {
		dismissCard(view);
		view.endListNote();
		view.headingField = null;
		view.listNoteEl = null;
		view.filter = null;
		view.filterEl = null;
		view.rowsHeldBack = false;
		fresh.createEl('p', { text: "This note isn't a list" });
		fresh.createEl('button', { text: 'Open as Markdown', cls: OPEN_AS_MARKDOWN_CLASS });
	}
	replaceKeeping(listSizerEl, fresh, kept, slot);
	listSizerEl.toggleClass('princelists-is-empty', isEmpty);
	view.newItemButton?.toggle(isListText(view.text));
	if (view.card && kept === view.card.el) refreshCard(view, view.card);
	for (const field of contentEl.querySelectorAll('textarea')) fitHeight(field);
	listScrollEl.scrollTop = scrollTop;
}

// An iPad with a keyboard still reads "Tap": a phone or tablet usually has none.
function emptyHint(): string {
	if (Platform.isMobile) return 'Tap + to add an item';
	return Platform.isMacOS ? 'Press Cmd+Enter or + to add an item' : 'Press Ctrl+Enter or + to add an item';
}

// Where a redraw puts the card: a slot for the card that keeps focus, or the card drawn again.
function placeCard(view: PrinceListView, kept: HTMLElement | null): (CardPlace & { keeps: boolean }) | null {
	const card = view.card;
	if (!card) return null;
	const line = view.selected ?? card.lostAt;
	if (line === null) {
		dismissCard(view);
		return null;
	}
	const keeps = kept === card.el;
	if (!keeps) redrawCard(view, card);
	return { el: keeps ? createEl('li') : card.el, line, replaces: view.selected !== null, keeps };
}

// Where a redraw puts the heading field: a slot for the field that keeps focus, or the field itself,
// in place of its heading. Its heading gone, it stays where it opened until it closes and says so.
function placeField(view: PrinceListView, kept: HTMLElement | null): (FieldPlace & { keeps: boolean }) | null {
	const field = view.headingField;
	if (!field) return null;
	const keeps = kept === field.el;
	return { el: keeps ? createDiv() : field.el, line: field.heading.line ?? field.openedAt, keeps };
}

function keptElement(view: PrinceListView, focusing: Element | null): HTMLElement | null {
	const focused = focusing ?? view.contentEl.doc.activeElement;
	if (!focused || !view.contentEl.contains(focused)) return null;
	// A link in the rendered note can hold focus too; only the note's editor keeps it.
	const note = view.listNote ? view.listNoteEl : null;
	return [view.listTitleEl, note, view.filterEl, view.card?.el, view.headingField?.el].find((el) => el?.contains(focused)) ?? null;
}
