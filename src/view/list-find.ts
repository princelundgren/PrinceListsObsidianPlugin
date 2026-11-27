import { findOf } from './filter';
import type { PrinceListView } from './list-view';
import { NOTES_BLOCK_CLASS } from './notes-blocks';
import { showNotesFind } from './notes-find';
import { isInNestedBlock, ownElements } from './own-rows';
import { ITEM_TITLE_CLASS } from './render-list';

/**
 * Colors what Cmd+F's words match in every title the list shows and in the open card's notes, and
 * takes it from titles and blocks gone.
 */
export function paintFind(view: PrinceListView): void {
	const find = findOf(view.filter ?? '');
	const cardBlocks = view.card ? ownElements(view.card.el, `.${NOTES_BLOCK_CLASS}`) : [];
	view.findPaint.paintAll([...ownElements(view.listSizerEl, `.${ITEM_TITLE_CLASS}`), ...cardBlocks], find);
	if (view.card?.editor) showNotesFind(view.card.editor, find);
}

/** Colors what Cmd+F's words match in `el` once it's rendered, when it's one of the list's titles or a block of the card's notes. */
export function paintRendered(view: PrinceListView, el: HTMLElement): void {
	if (view.viewClosed) return;
	const isOwnTitle = el.hasClass(ITEM_TITLE_CLASS) && view.listSizerEl.contains(el) && !isInNestedBlock(view.listSizerEl, el);
	const isCardBlock = el.hasClass(NOTES_BLOCK_CLASS) && !!view.card?.el.contains(el);
	if (isOwnTitle || isCardBlock) view.findPaint.paint(el, findOf(view.filter ?? ''));
}
