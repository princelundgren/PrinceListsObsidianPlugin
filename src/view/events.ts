import { Keymap, Platform } from 'obsidian';
import { openAsMarkdown } from '../obsidian/switch';
import { addItem, addItemBelowCard, hasNoItems } from './add-button';
import {
	CARD_ACTIONS_CLASS,
	CARD_STAR_CLASS,
	CARD_NOTES_CLASS,
	CARD_TITLE_CLASS,
	cardTitleBlur,
	cardTitleInput,
	closeCard,
	dismissCard,
	NOTES_EDITOR_CLASS,
	openCard,
} from './card';
import { toggleCardStar } from './card-star';
import { whenChange, whenClick, WHEN_INPUT_CLASS } from './card-when';
import { checklistClick } from './checklist';
import { COLLAPSE_CLASS } from './collapse';
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
import { filterBlur, filterInput, filterKeyDown } from './filter';
import { afterFieldInput, beforeFieldInput, endFieldHistory, startFieldHistory, stepField } from './field-undo';
import { barActionAt, FORMAT_BAR_CLASS, runBarAction } from './format';
import { HEADING_FIELD_CLASS, headingFieldBlur, headingFieldKey } from './heading-field';
import type { PrinceListView } from './list-view';
import { cancelHoldMenu, showCardMenu, showContextMenu, showHeadingMenu } from './menus';
import { openPieceAt, pieceBlur, pieceInput } from './note-piece-field';
import { handleLinkClick, handleLinkMenu, NOTES_CHECKBOX_SELECTOR } from './notes';
import { registerPictureEvents } from './pictures';
import { CHECKBOX_CLASS, HEADING_CLASS, ITEM_CLASS, lineOf, OPEN_AS_MARKDOWN_CLASS } from './render-list';
import { queueTick } from './tick';

// Delegated listeners on the view's own element, and the picture events' capture listeners on the
// document; all go away with the view.
export function registerFieldEvents(view: PrinceListView): void {
	const { contentEl } = view;
	view.registerDomEvent(contentEl, 'click', (evt) => onClick(view, evt));
	view.registerDomEvent(contentEl, 'mousedown', (evt) => keepNotesFocused(view, evt));
	view.registerDomEvent(contentEl, 'beforeinput', (evt) => onBeforeInput(view, evt));
	view.registerDomEvent(contentEl, 'input', (evt) => onInput(view, evt));
	view.registerDomEvent(contentEl, 'change', (evt) => onChange(view, evt));
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

function onChange(view: PrinceListView, evt: Event): void {
	const input = view.card?.el.querySelector<HTMLInputElement>(`.${WHEN_INPUT_CLASS}`);
	if (input && evt.target === input) whenChange(view, input);
}

function onClick(view: PrinceListView, evt: MouseEvent): void {
	const target = targetOf(evt);
	if (!target) return;
	const arrow = target.closest<HTMLElement>(`.${COLLAPSE_CLASS}`);
	if (arrow) {
		const heading = arrow.closest(`.${HEADING_CLASS}`);
		const line = heading ? lineOf(heading) : null;
		if (line !== null) view.collapsed.toggle(line);
		view.render();
		return;
	}
	if (handleLinkClick(view.app, view.sourcePath, evt, target)) return;
	if (target.instanceOf(HTMLInputElement) && target.hasClass(WHEN_INPUT_CLASS)) {
		whenClick(target);
		return;
	}
	if (target.closest(`.${OPEN_AS_MARKDOWN_CLASS}`)) {
		if (view.file) void openAsMarkdown(view.leaf, view.file);
		return;
	}
	const notesBox = target.closest<HTMLInputElement>(NOTES_CHECKBOX_SELECTOR);
	if (notesBox) {
		if (notesBox.closest(`.${CARD_NOTES_CLASS}`) && view.card?.el.contains(notesBox)) checklistClick(view, notesBox, evt);
		// Any other rendered box, in the list note or a title, is disabled, but an embed can render
		// more after that. They would tick on screen and save nothing.
		else evt.preventDefault();
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
		const action = barActionAt(target);
		if (action) {
			const editor = view.card.el.querySelector<HTMLTextAreaElement>(`.${NOTES_EDITOR_CLASS}`);
			if (editor) runBarAction(editor, action);
			return;
		}
		if (target.closest(`.${CARD_STAR_CLASS}`)) {
			toggleCardStar(view);
			return;
		}
		const actions = target.closest<HTMLElement>(`.${CARD_ACTIONS_CLASS}`);
		if (actions) {
			showCardMenu(view, actions);
			return;
		}
		const notes = target.closest<HTMLElement>(`.${CARD_NOTES_CLASS}`);
		if (notes) openPieceAt(view, notes, evt);
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
	if (target.closest(`.${NOTE_CLASS}`)) openListNote(view, evt);
}

// A press anywhere on the format bar, between its buttons too, or on a box in the card's notes would
// take focus from the open piece's field, which closes it.
function keepNotesFocused(view: PrinceListView, evt: MouseEvent): void {
	const target = targetOf(evt);
	const isCardBox = !!target?.closest(NOTES_CHECKBOX_SELECTOR) && !!view.card?.el.contains(target);
	if (isCardBox || target?.closest(`.${FORMAT_BAR_CLASS}`)) evt.preventDefault();
}

function onContextMenu(view: PrinceListView, evt: MouseEvent): void {
	const target = targetOf(evt);
	if (target && !handleLinkMenu(view.app, view.sourcePath, evt, target)) showContextMenu(view, evt, target);
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

// A card field undoes from its own history. Elsewhere the page has one undo history, so Cmd+Z in one
// field can reach typing in a field without focus, which nothing would save. That undo's beforeinput
// targets the other field while focus is still in this one (observed in Obsidian 1.14.4 on macOS);
// focus moves only with its input event.
function onBeforeInput(view: PrinceListView, evt: InputEvent): void {
	const focused = view.contentEl.doc.activeElement;
	const field = focused?.instanceOf(HTMLTextAreaElement) ? focused : null;
	const isHistory = evt.inputType === 'historyUndo' || evt.inputType === 'historyRedo';
	if (!isHistory) {
		if (field && evt.target === field) beforeFieldInput(field, evt.inputType);
	} else if (field && stepField(field, evt.inputType === 'historyUndo' ? 'undo' : 'redo')) {
		evt.preventDefault();
	} else if (evt.target !== focused) {
		evt.preventDefault();
	}
}

// The `input` event is typed as a plain Event, without Obsidian's targetNode, so the field is found
// among the view's own few textareas.
function onInput(view: PrinceListView, evt: Event): void {
	if (view.filterEl && evt.target === view.filterEl) {
		filterInput(view);
		return;
	}
	const target = Array.from(view.contentEl.querySelectorAll('textarea')).find((field) => field === evt.target);
	if (!target) return;
	if (target.hasClass(CARD_TITLE_CLASS)) cardTitleInput(view, target);
	else if (target.hasClass(NOTES_EDITOR_CLASS)) pieceInput(view, target);
	else if (target.hasClass(NOTE_EDITOR_CLASS)) typeListNote(view);
	else if (target.hasClass(TITLE_CLASS) || target.hasClass(HEADING_FIELD_CLASS)) keepOneLine(target);
	afterFieldInput(target);
}

function onKeyDown(view: PrinceListView, evt: KeyboardEvent): void {
	const target = evt.targetNode;
	// A key that confirms an input method's composition isn't the user's Enter or Escape.
	if (evt.isComposing || !target?.instanceOf(HTMLElement)) return;
	if (evt.key === 'Escape') {
		if (target === view.filterEl) {
			filterKeyDown(view, evt);
		} else if (view.card?.el.contains(target)) {
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
		// Cmd+Enter is the view's own key, which adds an item, so it doesn't also close a card.
		if (Keymap.isModifier(evt, 'Mod')) return;
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
	if (view.card?.el.contains(target)) startFieldHistory(target);
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
	if (target === view.filterEl) {
		filterBlur(view);
		return;
	}
	const card = view.card;
	const inCard = card?.el.contains(target) ?? false;
	if (target.instanceOf(HTMLTextAreaElement)) {
		endFieldHistory(target);
		// Moving to another window or app doesn't leave the list title or the heading field: they keep
		// focus, which comes back to them on return, and commit when they lose it in the window.
		const inWindow = target.doc.hasFocus();
		if (inCard && target.hasClass(CARD_TITLE_CLASS)) cardTitleBlur(view, target);
		else if (inCard && target.hasClass(NOTES_EDITOR_CLASS)) pieceBlur(view, target);
		else if (target.hasClass(NOTE_EDITOR_CLASS)) closeListNote(view, focusing);
		else if (target.hasClass(TITLE_CLASS) && inWindow) commitListTitle(view, target);
		else if (target.hasClass(HEADING_FIELD_CLASS) && inWindow) headingFieldBlur(view, target);
	}
	// A card whose item an outside change took closes once focus leaves it.
	if (card && inCard && card.lostAt !== null && !card.el.contains(focusing)) dismissCard(view);
}
