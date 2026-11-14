import type { EditorView } from '@codemirror/view';
import { Keymap, Platform } from 'obsidian';
import { openAsMarkdown } from '../obsidian/switch';
import { addItem, addItemBelowCard, hasNoItems } from './add-button';
import {
	CARD_ACTIONS_CLASS,
	CARD_STAR_CLASS,
	CARD_TITLE_CLASS,
	CARD_TITLE_LINE_CLASS,
	cardTitleBlur,
	cardTitleInput,
	closeCard,
	dismissCard,
	focusCardTitleEnd,
	openCard,
} from './card';
import { toggleCardStar } from './card-star';
import { escapeRepeatPopover, closeRepeatPopover, isInRepeatPopover, isOpenRepeatButton, repeatClick, repeatInput, saveRepeat } from './card-repeat';
import { cardTagsClick, closeTagPopover, escapeTagPopover, isOpenTagButton } from './card-tags';
import { whenChange, whenClick, WHEN_INPUT_CLASS } from './card-when';
import { COLLAPSE_CLASS } from './collapse';
import { targetOf } from './dom';
import { beginListTitle, commitListTitle, keepOneLine, TITLE_CLASS } from './fields';
import { notesText } from './editable-text';
import { ARCHIVED_TOGGLE_CLASS, FILTER_TOGGLE_SELECTOR, filterKeyDown, STARRED_TOGGLE_CLASS, toggleStarredOnly } from './filter';
import { afterFieldInput, beforeFieldInput, endFieldHistory, startFieldHistory, stepField } from './field-undo';
import { barActionAt, FORMAT_BAR_CLASS } from './format';
import { HEADING_FIELD_CLASS, headingFieldBlur, headingFieldKey } from './heading-field';
import type { PrinceListView } from './list-view';
import { cancelHoldMenu, showCardMenu, showContextMenu, showHeadingMenu } from './menus';
import { insertNoteLink } from './note-link-modal';
import { handleLinkClick, handleLinkMenu, NOTES_CHECKBOX_SELECTOR, NOTES_DRAWN_CHECKBOX_SELECTOR } from './notes';
import { eventInDrawnListBlock } from './notes-blocks';
import { applyNotesFormat } from './notes-keys';
import { eventInNestedBlock, isInNestedBlock, pathUnder } from './own-rows';
import { showPictureMenu } from './picture-menu';
import { registerPictureEvents } from './pictures';
import { CHECKBOX_CLASS, HEADING_CLASS, ITEM_CLASS, lineOf, OPEN_AS_MARKDOWN_CLASS, TICK_SELECTOR } from './render-list';
import { keepTextUnselected, onSelectClick } from './select';
import { stripClick } from './tag-strip';
import { showTextMenu } from './text-menu';
import { queueTick } from './tick';

// Delegated listeners on the view's own element, and the picture events' capture listeners on the
// document; all go away with the view.
export function registerFieldEvents(view: PrinceListView): void {
	const { contentEl } = view;
	view.registerDomEvent(contentEl, 'click', (evt) => onClick(view, evt));
	view.registerDomEvent(contentEl, 'mousedown', (evt) => onMouseDown(view, evt));
	view.registerDomEvent(contentEl, 'beforeinput', (evt) => onBeforeInput(view, evt));
	view.registerDomEvent(contentEl, 'input', (evt) => onInput(view, evt));
	view.registerDomEvent(contentEl, 'change', (evt) => onChange(view, evt));
	view.registerDomEvent(contentEl, 'keydown', (evt) => onKeyDown(view, evt));
	view.registerDomEvent(contentEl, 'focusin', (evt) => onFocusIn(view, evt));
	view.registerDomEvent(contentEl, 'focusout', (evt) => onFocusOut(view, evt));
	registerPictureEvents(view);
	swallowClickAfterHold(view, contentEl);
	if (Platform.isDesktop) view.registerDomEvent(contentEl, 'contextmenu', (evt) => onContextMenu(view, evt));
	// In the capture phase, so it is stopped before it reaches a row or bubbles up from one.
	if (Platform.isMobile) view.registerDomEvent(contentEl, 'contextmenu', (evt) => onHoldMenu(view, evt), { capture: true });
}

/**
 * Stops the click that follows a hold on the view's rows from reaching anything in `el`, in the capture
 * phase. For the view's content, and for the selection bar, which a hold can show under the pointer.
 */
export function swallowClickAfterHold(view: PrinceListView, el: HTMLElement): void {
	view.registerDomEvent(el, 'click', (evt) => swallowClick(view, evt), { capture: true });
	// A hold that sent no click must not eat a later tap, nor a right-click with a mouse, which sends no touch.
	view.registerDomEvent(el, 'pointerdown', () => (view.swallowNextClick = false), { capture: true });
}

function onChange(view: PrinceListView, evt: Event): void {
	repeatInput(view, evt);
	const input = view.card?.el.querySelector<HTMLInputElement>(`.${WHEN_INPUT_CLASS}`);
	if (input && evt.target === input) whenChange(view, input);
}

function onClick(view: PrinceListView, evt: MouseEvent): void {
	const target = targetOf(evt);
	if (!target) return;
	// A list block in the notes acts on its own rows; to the view, a click there is one on the notes. The
	// block's listener has run first and may have redrawn the target, so the path decides.
	if (eventInNestedBlock(view.contentEl, evt)) {
		if (view.card && !pathUnder(view.contentEl, evt).includes(view.card.el)) closeCard(view);
		return;
	}
	const arrow = target.closest<HTMLElement>(`.${COLLAPSE_CLASS}`);
	if (arrow) {
		const heading = arrow.closest(`.${HEADING_CLASS}`);
		const line = heading ? lineOf(heading) : null;
		if (line !== null) view.collapsed.toggle(line);
		view.render();
		return;
	}
	if (target.closest(`.${ARCHIVED_TOGGLE_CLASS}`)) {
		view.toggleArchived();
		return;
	}
	if (target.closest(`.${STARRED_TOGGLE_CLASS}`)) {
		toggleStarredOnly(view);
		return;
	}
	if (stripClick(view, target)) return;
	if (handleLinkClick(view.app, view.sourcePath, evt, target)) return;
	if (onSelectClick(view, evt, target)) return;
	if (target.instanceOf(HTMLInputElement) && target.hasClass(WHEN_INPUT_CLASS)) {
		whenClick(target);
		return;
	}
	const action = barActionAt(target);
	if (action) {
		const editor = barEditor(view, target);
		if (!editor) return;
		if (action === 'noteLink') insertNoteLink(view, notesText(view, editor));
		else applyNotesFormat(editor, action);
		return;
	}
	if (target.closest(`.${OPEN_AS_MARKDOWN_CLASS}`)) {
		if (view.file) void openAsMarkdown(view.leaf, view.file);
		return;
	}
	const notesBox = target.closest<HTMLInputElement>(NOTES_CHECKBOX_SELECTOR);
	// The notes editor ticks the boxes it draws.
	if (notesBox?.matches(NOTES_DRAWN_CHECKBOX_SELECTOR)) return;
	if (notesBox) {
		// Any other rendered box, as in a title, is disabled, but an embed can render more after that.
		// They would tick on screen and save nothing.
		evt.preventDefault();
		return;
	}
	const tickTarget = target.closest(TICK_SELECTOR);
	// While a card is open, another row's zone closes the card, as empty space does; checkboxes and the card's own zone tick.
	if (tickTarget && (!view.card || tickTarget.matches(`.${CHECKBOX_CLASS}`) || view.card.el.contains(tickTarget))) {
		// The box shows what the file holds: it changes once the write lands, not while a tap waits.
		// It only ticks: it never opens or closes a card (spec, "Ticking").
		evt.preventDefault();
		const row = tickTarget.closest<HTMLElement>(`.${ITEM_CLASS}`);
		if (row) queueTick(view, row);
		return;
	}
	if (view.card?.el.contains(target)) {
		if (target.hasClass(CARD_TITLE_LINE_CLASS)) {
			focusCardTitleEnd(view);
			return;
		}
		if (cardTagsClick(view, target) || repeatClick(view, target)) return;
		if (target.closest(`.${CARD_STAR_CLASS}`)) {
			toggleCardStar(view);
			return;
		}
		const actions = target.closest<HTMLElement>(`.${CARD_ACTIONS_CLASS}`);
		if (actions) showCardMenu(view, actions);
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
	if (Platform.isMobile) showHeadingMenu(view, evt, target);
}

// The notes editor whose format bar `target` is on: the open card's or the list note's.
function barEditor(view: PrinceListView, target: HTMLElement): EditorView | null {
	if (view.card?.el.contains(target)) return view.card.editor;
	return view.listNoteEl?.contains(target) ? view.listNoteEditor : null;
}

// A press anywhere on the format bar, between its buttons too, would take focus from the notes
// editor, which ends its visit, as one on the filter field's toggles would take it from the field.
function keepFieldFocused(evt: MouseEvent): void {
	if (targetOf(evt)?.closest(`.${FORMAT_BAR_CLASS}, ${FILTER_TOGGLE_SELECTOR}`)) evt.preventDefault();
}

// So the click that follows closes the popover: a focusout first would close it, and the click reopen it.
function keepTagFieldFocused(view: PrinceListView, evt: MouseEvent): void {
	const target = targetOf(evt);
	if (target && isOpenTagButton(view, target)) evt.preventDefault();
}

// So the click that follows closes the repeat popover, as for the tag popover's button.
function keepRepeatFocused(view: PrinceListView, evt: MouseEvent): void {
	const target = targetOf(evt);
	if (target && isOpenRepeatButton(view, target)) evt.preventDefault();
}

// The title is only as wide as its text, so a press beside it lands on its line: the click that
// follows puts the caret in the title, and the field that has focus keeps it until then.
function keepFocusBesideTitle(evt: MouseEvent): void {
	if (targetOf(evt)?.hasClass(CARD_TITLE_LINE_CLASS)) evt.preventDefault();
}

function onMouseDown(view: PrinceListView, evt: MouseEvent): void {
	keepFieldFocused(evt);
	keepFocusBesideTitle(evt);
	keepTagFieldFocused(view, evt);
	keepRepeatFocused(view, evt);
	keepTextUnselected(view, evt);
}

function onContextMenu(view: PrinceListView, evt: MouseEvent): void {
	const target = targetOf(evt);
	if (!target || isInNestedBlock(view.contentEl, target)) return;
	if (showPictureMenu(view, evt, target) || handleLinkMenu(view.app, view.sourcePath, evt, target) || showTextMenu(view, evt, target)) return;
	showContextMenu(view, evt, target);
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
	repeatInput(view, evt);
	const target = Array.from(view.contentEl.querySelectorAll('textarea')).find((field) => field === evt.target);
	if (!target) return;
	if (target.hasClass(CARD_TITLE_CLASS)) cardTitleInput(view, target);
	else if (target.hasClass(TITLE_CLASS) || target.hasClass(HEADING_FIELD_CLASS)) keepOneLine(target);
	afterFieldInput(target);
}

function onKeyDown(view: PrinceListView, evt: KeyboardEvent): void {
	const target = evt.targetNode;
	// A key that confirms an input method's composition isn't the user's Enter or Escape. One in a list
	// block in the notes, such as Escape in its title field, is the block's.
	if (evt.isComposing || !target?.instanceOf(HTMLElement) || eventInDrawnListBlock(view.contentEl, evt)) return;
	if (evt.key === 'Escape') {
		if (target === view.filterField?.inputEl) {
			filterKeyDown(view, evt);
		} else if (target === view.tagPopover?.input) {
			evt.preventDefault();
			escapeTagPopover(view);
		} else if (isInRepeatPopover(view, target)) {
			evt.preventDefault();
			escapeRepeatPopover(view);
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
		if (target.instanceOf(HTMLInputElement) && isInRepeatPopover(view, target)) {
			evt.preventDefault();
			saveRepeat(view);
		} else if (target.hasClass(CARD_TITLE_CLASS)) {
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

// A list block's title field in the notes keeps the browser's undo, as in a note: with no history of
// its own, the view's beforeinput, input and focusout listeners leave it be.
function onFocusIn(view: PrinceListView, evt: FocusEvent): void {
	const target = evt.targetNode;
	if (!target?.instanceOf(HTMLTextAreaElement) || eventInDrawnListBlock(view.contentEl, evt)) return;
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
	const card = view.card;
	// From the path: closing a list block's title field in the card's notes removes the field first.
	const inCard = card !== null && pathUnder(view.contentEl, evt).includes(card.el);
	if (target.instanceOf(HTMLTextAreaElement)) {
		endFieldHistory(target);
		// Moving to another window or app doesn't leave the list title or the heading field: they keep
		// focus, which comes back to them on return, and commit when they lose it in the window.
		const inWindow = target.doc.hasFocus();
		if (inCard && target.hasClass(CARD_TITLE_CLASS)) cardTitleBlur(view, target);
		else if (target.hasClass(TITLE_CLASS) && inWindow) commitListTitle(view, target);
		else if (target.hasClass(HEADING_FIELD_CLASS) && inWindow) headingFieldBlur(view, target);
	}
	// Switching to another app leaves the popover open, as it leaves the list's title field.
	if (target === view.tagPopover?.input && !view.tagPopover.el.contains(focusing) && target.doc.hasFocus()) closeTagPopover(view);
	// The same for the repeat popover, which holds several controls.
	if (isInRepeatPopover(view, target) && !isInRepeatPopover(view, focusing) && target.doc.hasFocus()) closeRepeatPopover(view);
	// A card whose item an outside change took closes once focus leaves it.
	if (card && inCard && card.lostAt !== null && !card.el.contains(focusing)) dismissCard(view);
}
