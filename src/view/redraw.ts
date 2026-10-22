import { isListText } from '../obsidian/marker';
import { dismissCard, redrawCard, refreshCard } from './card';
import { fitHeight, replaceKeeping } from './dom';
import { buildListNote, buildListTitle } from './fields';
import type { PrinceListView } from './list-view';
import { OPEN_AS_MARKDOWN_CLASS, renderList, type CardPlace } from './render-list';

// Draws everything again from the view's text, except the title, list note or card that holds focus,
// or is about to (`focusing`): those stay in place and update after blur.
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
		view.rowsHeldBack = renderList(view, fresh, lines, model, card, view.blocks, view.editing.listNoteRange());
	} else {
		dismissCard(view);
		view.endListNote();
		view.listNoteEl = null;
		view.rowsHeldBack = false;
		fresh.createEl('p', { text: "This note isn't a list" });
		fresh.createEl('button', { text: 'Open as Markdown', cls: OPEN_AS_MARKDOWN_CLASS });
	}
	replaceKeeping(contentEl, fresh, kept, slot);
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

function keptElement(view: PrinceListView, focusing: Element | null): HTMLElement | null {
	const focused = focusing ?? view.contentEl.doc.activeElement;
	if (!focused || !view.contentEl.contains(focused)) return null;
	// A link in the rendered note can hold focus too; only the note's editor keeps it.
	const note = view.listNote ? view.listNoteEl : null;
	return [view.listTitleEl, note, view.card?.el].find((el) => el?.contains(focused)) ?? null;
}
