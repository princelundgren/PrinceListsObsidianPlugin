import { emptyHint } from '../core/empty-hint';
import { isListText } from '../obsidian/marker';
import { hasNoItems } from './add-button';
import { dismissCard, refreshCard } from './card';
import { fitHeight, replaceKeeping } from './dom';
import { buildListNote, buildListTitle, refreshListNote } from './fields';
import { addArchivedToggle, addStarredToggle, buildFilterField, NO_MATCH_CLASS, NO_MATCH_HINT } from './filter';
import { ADD_KEY_NAME } from './keys';
import type { PrinceListView } from './list-view';
import { drawnRows, OPEN_AS_MARKDOWN_CLASS, renderList, type CardPlace, type FieldPlace } from './render-list';

// Draws everything again from the view's text, except the title, list note, card or heading field that
// holds focus, or is about to (`focusing`): those stay in place and update after blur. The list note,
// the card, and rows and headings that show the same move into the new drawing, so what they render
// isn't loaded again.
export function redraw(view: PrinceListView, focusing: Element | null): void {
	const { contentEl, listScrollEl, listSizerEl } = view;
	const { scrollTop } = listScrollEl;
	const kept = keptElement(view, focusing);
	const isEmpty = hasNoItems(view);
	const drawn = drawnRows(listSizerEl);
	const fresh = createDiv();
	let slot: HTMLElement | null = null;
	if (kept && kept === view.listTitleEl) slot = fresh.createDiv();
	else view.listTitleEl = buildListTitle(view, fresh);
	if (isListText(view.text)) {
		const { lines, model } = view.parse();
		if (kept && kept === view.listNoteEl) {
			slot = fresh.createDiv();
		} else if (view.listNoteEl) {
			fresh.append(view.listNoteEl);
			refreshListNote(view);
		} else {
			view.listNoteEl = buildListNote(view, fresh);
		}
		if (view.filter === null) {
			view.filterField = null;
		} else if (kept && kept === view.filterField?.rowEl) {
			slot = fresh.createDiv();
		} else if (view.filterField) {
			fresh.append(view.filterField.rowEl);
		} else {
			view.filterField = buildFilterField(view, fresh);
			addStarredToggle(view.filterField);
			addArchivedToggle(view.filterField);
		}
		const card = placeCard(view, kept);
		if (card?.keeps) slot = card.el;
		const field = placeField(view, kept);
		if (field?.keeps) slot = field.el;
		const listDrawn = renderList(view, fresh, lines, model, card, view.blocks, view.editing.listNoteRange(), field, drawn);
		view.rowsHeldBack = listDrawn.heldBack;
		if (isEmpty) fresh.createDiv({ cls: 'princelists-empty-hint', text: emptyHint(ADD_KEY_NAME, view.showsAddButton()) });
		if (listDrawn.foundNothing) fresh.createDiv({ cls: NO_MATCH_CLASS, text: NO_MATCH_HINT });
		// Room to scroll the last row clear of the floating "+".
		fresh.createDiv({ cls: 'princelists-end' });
	} else {
		dismissCard(view);
		view.endListNote();
		view.dropListNoteEditor();
		view.headingField = null;
		view.listNoteEl = null;
		view.filter = null;
		view.starredOnly = false;
		view.filterField = null;
		view.rowsHeldBack = false;
		fresh.createEl('p', { text: "This note isn't a list" });
		fresh.createEl('button', { text: 'Open as Markdown', cls: OPEN_AS_MARKDOWN_CLASS });
	}
	replaceKeeping(listSizerEl, fresh, kept, slot);
	for (const el of Array.from(view.blocks.keys())) if (!listSizerEl.contains(el)) view.dropBlock(el);
	listSizerEl.toggleClass('princelists-is-empty', isEmpty);
	if (view.card && kept === view.card.el) refreshCard(view, view.card);
	if (kept && kept === view.listNoteEl) refreshListNote(view);
	for (const field of contentEl.querySelectorAll('textarea')) fitHeight(field);
	listScrollEl.scrollTop = scrollTop;
}

// Where a redraw puts the card: a slot for the card that keeps focus, or the card, updated.
function placeCard(view: PrinceListView, kept: HTMLElement | null): (CardPlace & { keeps: boolean }) | null {
	const card = view.card;
	if (!card) return null;
	const line = view.selected ?? card.lostAt;
	if (line === null) {
		dismissCard(view);
		return null;
	}
	const keeps = kept === card.el;
	if (!keeps) refreshCard(view, card);
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
	// A link in the rendered note can hold focus too; only a field in the note keeps it.
	const note = view.listNote ? view.listNoteEl : null;
	return [view.listTitleEl, note, view.filterField?.rowEl, view.card?.el, view.headingField?.el].find((el) => el?.contains(focused)) ?? null;
}
