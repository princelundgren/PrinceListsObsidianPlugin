import { Platform } from 'obsidian';
import { openAsMarkdown } from '../obsidian/switch';
import { addItem, addItemBelowCard, hasNoItems } from './add-button';
import {
	CARD_ACTIONS_CLASS,
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
import { targetOf } from './dom';
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
import { HEADING_FIELD_CLASS, headingFieldBlur, headingFieldKey } from './heading-field';
import type { PrinceListView } from './list-view';
import { cancelHoldMenu, showCardMenu, showContextMenu, showHeadingMenu } from './menus';
import { handleLinkClick, handleLinkMenu } from './notes';
import { registerPictureEvents } from './pictures';
import { CHECKBOX_CLASS, ITEM_CLASS, lineOf, OPEN_AS_MARKDOWN_CLASS } from './render-list';
import { queueTick } from './tick';

// Delegated listeners on the view's own element, and the picture events' capture listeners on the
// document; all go away with the view.
export function registerFieldEvents(view: PrinceListView): void {
	const { contentEl } = view;
	view.registerDomEvent(contentEl, 'click', (evt) => onClick(view, evt));
	view.registerDomEvent(contentEl, 'input', (evt) => onInput(view, evt));
	view.registerDomEvent(contentEl, 'keydown', (evt) => onKeyDown(view, evt));
	view.registerDomEvent(contentEl, 'focusin', (evt) => onFocusIn(view, evt));
	view.registerDomEvent(contentEl, 'focusout', (evt) => onFocusOut(view, evt));
	registerPictureEvents(view);
	if (Platform.isDesktop) view.registerDomEvent(contentEl, 'contextmenu', (evt) => onContextMenu(view, evt));
	// In the capture phase, so it is stopped before it reaches a row or bubbles up from one.
	if (Platform.isMobile) {
		view.registerDomEvent(contentEl, 'contextmenu', (evt) => onHoldMenu(view, evt), { capture: true });
		view.registerDomEvent(contentEl, 'click', (evt) => swallowClick(view, evt), { capture: true });
		// A hold that sent no click must not eat a later tap.
		view.registerDomEvent(contentEl, 'touchstart', () => (view.swallowNextClick = false), { capture: true });
	}
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
		const actions = target.closest<HTMLElement>(`.${CARD_ACTIONS_CLASS}`);
		if (actions) {
			showCardMenu(view, actions);
			return;
		}
		const notes = target.closest<HTMLElement>(`.${CARD_NOTES_CLASS}`);
		if (notes) editNotes(view, notes);
		return;
	}
	// Anything else is a click elsewhere, which only closes an open card (spec, "Selecting and adding").
	if (view.card) {
		closeCard(view);
		return;
	}
	const row = target.closest(`.${ITEM_CLASS}`);
	const line = row ? lineOf(row) : null;
	if (line !== null) {
		openCard(view, line);
		return;
	}
	if (Platform.isMobile && showHeadingMenu(view, evt, target)) return;
	if (target.closest(`.${NOTE_CLASS}`)) openListNote(view);
}

function onContextMenu(view: PrinceListView, evt: MouseEvent): void {
	const target = targetOf(evt);
	if (target && !handleLinkMenu(view, evt, target)) showContextMenu(view, evt, target);
}

function onHoldMenu(view: PrinceListView, evt: MouseEvent): void {
	const target = targetOf(evt);
	if (target) cancelHoldMenu(view, evt, target);
}

function swallowClick(view: PrinceListView, evt: MouseEvent): void {
	if (!view.swallowNextClick) return;
	view.swallowNextClick = false;
	evt.preventDefault();
	evt.stopPropagation();
}

// The `input` event is typed as a plain Event, without Obsidian's targetNode, so the field is found
// among the view's own few textareas.
function onInput(view: PrinceListView, evt: Event): void {
	const target = Array.from(view.contentEl.querySelectorAll('textarea')).find((field) => field === evt.target);
	if (!target) return;
	if (target.hasClass(CARD_TITLE_CLASS)) cardTitleInput(view, target);
	else if (target.hasClass(NOTES_EDITOR_CLASS)) notesInput(view, target);
	else if (target.hasClass(NOTE_EDITOR_CLASS)) typeListNote(view);
	else if (target.hasClass(TITLE_CLASS) || target.hasClass(HEADING_FIELD_CLASS)) keepOneLine(target);
}

function onKeyDown(view: PrinceListView, evt: KeyboardEvent): void {
	const target = evt.targetNode;
	// A key that confirms an input method's composition isn't the user's Enter or Escape.
	if (evt.isComposing || !target?.instanceOf(HTMLElement)) return;
	if (evt.key === 'Escape') {
		if (view.card?.el.contains(target)) {
			evt.preventDefault();
			closeCard(view);
		} else if (target.hasClass(HEADING_FIELD_CLASS)) {
			evt.preventDefault();
			headingFieldKey(view, target, 'Escape');
		} else if (target.instanceOf(HTMLTextAreaElement) && target.hasClass(TITLE_CLASS)) {
			// Cancels: the blur that follows finds the name unchanged.
			target.value = view.listTitle?.before ?? target.value;
			target.blur();
		}
	} else if (evt.key === 'Enter') {
		// A title or heading is one line, so Enter writes no line break.
		if (target.hasClass(CARD_TITLE_CLASS)) {
			evt.preventDefault();
			if (evt.shiftKey) addItemBelowCard(view);
			else closeCard(view);
		} else if (target.hasClass(HEADING_FIELD_CLASS)) {
			evt.preventDefault();
			headingFieldKey(view, target, 'Enter');
		} else if (target.hasClass(TITLE_CLASS)) {
			evt.preventDefault();
			const firstItem = hasNoItems(view);
			// Renames, and the first item waits for that on the write queue.
			target.blur();
			if (firstItem) addItem(view, 'first');
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
		// Moving to another window or app doesn't leave the list title or the heading field: they keep
		// focus, which comes back to them on return, and commit when they lose it in the window.
		const inWindow = target.doc.hasFocus();
		if (inCard && target.hasClass(CARD_TITLE_CLASS)) cardTitleBlur(view, target);
		else if (inCard && target.hasClass(NOTES_EDITOR_CLASS)) notesBlur(view, target);
		else if (target.hasClass(NOTE_EDITOR_CLASS)) closeListNote(view, focusing);
		else if (target.hasClass(TITLE_CLASS) && inWindow) commitListTitle(view, target);
		else if (target.hasClass(HEADING_FIELD_CLASS) && inWindow) headingFieldBlur(view, target);
	}
	// A card whose item an outside change took closes once focus leaves it.
	if (card && inCard && card.lostAt !== null && !card.el.contains(focusing)) dismissCard(view);
}
