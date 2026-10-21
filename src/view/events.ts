import { openAsMarkdown } from '../obsidian/switch';
import {
	CARD_NOTES_CLASS,
	CARD_TITLE_CLASS,
	cardTitleBlur,
	cardTitleInput,
	closeCard,
	dismissCard,
	editNotes,
	NOTES_EDITOR_CLASS,
	notesBlur,
	notesInput,
	openCard,
} from './card';
import {
	beginListTitle,
	closeListNote,
	commitListTitle,
	keepOneLine,
	NOTE_CLASS,
	NOTE_EDITOR_CLASS,
	openListNote,
	TITLE_CLASS,
	typeListNote,
} from './fields';
import type { PrinceListView } from './list-view';
import { handleLinkClick } from './notes';
import { CHECKBOX_CLASS, ITEM_CLASS, lineOf, OPEN_AS_MARKDOWN_CLASS } from './render-list';
import { queueTick } from './tick';

// One delegated listener per event type on the view's own element, which goes away with the view.
export function registerFieldEvents(view: PrinceListView): void {
	const { contentEl } = view;
	view.registerDomEvent(contentEl, 'click', (evt) => onClick(view, evt));
	view.registerDomEvent(contentEl, 'input', (evt) => onInput(view, evt));
	view.registerDomEvent(contentEl, 'keydown', (evt) => onKeyDown(view, evt));
	view.registerDomEvent(contentEl, 'focusin', (evt) => onFocusIn(view, evt));
	view.registerDomEvent(contentEl, 'focusout', (evt) => onFocusOut(view, evt));
}

// Obsidian's instanceOf, since a pane can sit in a popout window, whose elements aren't instances of
// this window's classes.
function targetOf(evt: UIEvent): HTMLElement | null {
	const node = evt.targetNode;
	return node?.instanceOf(HTMLElement) ? node : null;
}

function onClick(view: PrinceListView, evt: MouseEvent): void {
	const target = targetOf(evt);
	if (!target || handleLinkClick(view, evt, target)) return;
	if (target.closest(`.${OPEN_AS_MARKDOWN_CLASS}`)) {
		if (view.file) void openAsMarkdown(view.leaf, view.file);
		return;
	}
	// Rendered notes' checkboxes are disabled, but an embed can render more after that. They would
	// tick on screen and save nothing.
	if (target.closest('.task-list-item-checkbox')) {
		evt.preventDefault();
		return;
	}
	const box = target.closest(`.${CHECKBOX_CLASS}`);
	if (box) {
		// The box shows what the file holds: it changes once the write lands, not while a tap waits.
		// It only ticks: it never opens or closes a card (spec, "Ticking").
		evt.preventDefault();
		const row = box.closest<HTMLElement>(`.${ITEM_CLASS}`);
		if (row) queueTick(view, row);
		return;
	}
	if (view.card?.el.contains(target)) {
		const notes = target.closest<HTMLElement>(`.${CARD_NOTES_CLASS}`);
		if (notes) editNotes(view, notes);
		return;
	}
	// Anything else is a click elsewhere, which closes the card (spec, "Selecting and adding").
	const row = target.closest(`.${ITEM_CLASS}`);
	const line = row ? lineOf(row) : null;
	if (line !== null) {
		openCard(view, line);
		return;
	}
	closeCard(view);
	if (target.closest(`.${NOTE_CLASS}`)) openListNote(view);
}

// The `input` event is typed as a plain Event, without Obsidian's targetNode, so the field is found
// among the view's own few textareas.
function onInput(view: PrinceListView, evt: Event): void {
	const target = Array.from(view.contentEl.querySelectorAll('textarea')).find((field) => field === evt.target);
	if (!target) return;
	if (target.hasClass(CARD_TITLE_CLASS)) cardTitleInput(view, target);
	else if (target.hasClass(NOTES_EDITOR_CLASS)) notesInput(view, target);
	else if (target.hasClass(NOTE_EDITOR_CLASS)) typeListNote(view);
	else if (target.hasClass(TITLE_CLASS)) keepOneLine(target);
}

function onKeyDown(view: PrinceListView, evt: KeyboardEvent): void {
	const target = evt.targetNode;
	// A key that confirms an input method's composition isn't the user's Enter or Escape.
	if (evt.isComposing || !target?.instanceOf(HTMLElement)) return;
	if (evt.key === 'Escape') {
		if (view.card?.el.contains(target)) {
			evt.preventDefault();
			closeCard(view);
		} else if (target.instanceOf(HTMLTextAreaElement) && target.hasClass(TITLE_CLASS)) {
			// Cancels: the blur that follows finds the name unchanged.
			target.value = view.listTitle?.before ?? target.value;
			target.blur();
		}
	} else if (evt.key === 'Enter') {
		// A title is one line, so Enter writes no line break.
		if (target.hasClass(CARD_TITLE_CLASS)) {
			evt.preventDefault();
		} else if (target.hasClass(TITLE_CLASS)) {
			evt.preventDefault();
			target.blur();
		}
	}
}

function onFocusIn(view: PrinceListView, evt: FocusEvent): void {
	const target = evt.targetNode;
	if (!target?.instanceOf(HTMLTextAreaElement)) return;
	if (target.hasClass(CARD_TITLE_CLASS) && view.card?.el.contains(target)) view.editing.focusTitle();
	else if (target.hasClass(TITLE_CLASS)) beginListTitle(view, target);
}

// Each field ends its session when it loses focus. Removing a focused field may not fire this, so
// whatever removes one ends its session itself first.
function onFocusOut(view: PrinceListView, evt: FocusEvent): void {
	const target = evt.targetNode;
	if (!target?.instanceOf(HTMLElement)) return;
	// FocusEvent types it as an EventTarget; between elements it is an Element or null.
	const related = evt.relatedTarget as Node | null;
	const focusing = related?.instanceOf(HTMLElement) ? related : null;
	const card = view.card;
	const inCard = card?.el.contains(target) ?? false;
	if (target.instanceOf(HTMLTextAreaElement)) {
		if (inCard && target.hasClass(CARD_TITLE_CLASS)) cardTitleBlur(view, target);
		else if (inCard && target.hasClass(NOTES_EDITOR_CLASS)) notesBlur(view, target);
		else if (target.hasClass(NOTE_EDITOR_CLASS)) closeListNote(view, focusing);
		else if (target.hasClass(TITLE_CLASS)) commitListTitle(view, target);
	}
	// A card whose item an outside change took closes once focus leaves it.
	if (card && inCard && card.lostAt !== null && !card.el.contains(focusing)) dismissCard(view);
}
