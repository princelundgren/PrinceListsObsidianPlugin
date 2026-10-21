import { mapLine } from '../core/guard';
import type { Line } from '../core/lines';
import { isListText } from '../obsidian/marker';
import { dismissCard, redrawCard, refreshCard } from './card';
import { fitHeight, replaceKeeping } from './dom';
import { buildListNote, buildListTitle } from './fields';
import type { PrinceListView } from './list-view';
import { OPEN_AS_MARKDOWN_CLASS, renderList, type CardPlace, type FieldPlace } from './render-list';

// Draws everything again from the view's text, except the title, list note, card or heading field that
// holds focus, or is about to (`focusing`): those stay in place and update after blur.
export function redraw(view: PrinceListView, focusing: Element | null): void {
	const { contentEl } = view;
	// contentEl is what scrolls in Obsidian's CSS as seen in 1.14.4 (not a documented API), so the
	// floating "+" (Task 10) must sit outside it.
	const { scrollTop } = contentEl;
	const kept = keptElement(view, focusing);
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
		const card = placeCard(view, kept);
		if (card?.keeps) slot = card.el;
		const field = placeField(view, kept, lines);
		if (field?.keeps) slot = field.el;
		view.rowsHeldBack = renderList(view, fresh, lines, model, card, view.blocks, view.editing.listNoteRange(), field);
		// Room to scroll the last row clear of the floating "+".
		fresh.createDiv({ cls: 'princelists-end' });
	} else {
		dismissCard(view);
		view.endListNote();
		view.headingField = null;
		view.listNoteEl = null;
		view.rowsHeldBack = false;
		fresh.createEl('p', { text: "This note isn't a list" });
		fresh.createEl('button', { text: 'Open as Markdown', cls: OPEN_AS_MARKDOWN_CLASS });
	}
	replaceKeeping(contentEl, fresh, kept, slot);
	view.newItemButton?.toggle(isListText(view.text));
	if (view.card && kept === view.card.el) refreshCard(view, view.card);
	for (const field of contentEl.querySelectorAll('textarea')) fitHeight(field);
	contentEl.scrollTop = scrollTop;
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
// in place of its heading as mapped from the lines it opened on. Its heading gone, it stays near where
// it was until it closes and says so.
function placeField(view: PrinceListView, kept: HTMLElement | null, lines: readonly Line[]): (FieldPlace & { keeps: boolean }) | null {
	const field = view.headingField;
	if (!field) return null;
	const keeps = kept === field.el;
	return { el: keeps ? createDiv() : field.el, line: mapLine(field.lines, lines, field.line) ?? field.line, keeps };
}

function keptElement(view: PrinceListView, focusing: Element | null): HTMLElement | null {
	const focused = focusing ?? view.contentEl.doc.activeElement;
	if (!focused || !view.contentEl.contains(focused)) return null;
	// A link in the rendered note can hold focus too; only the note's editor keeps it.
	const note = view.listNote ? view.listNoteEl : null;
	return [view.listTitleEl, note, view.card?.el, view.headingField?.el].find((el) => el?.contains(focused)) ?? null;
}
