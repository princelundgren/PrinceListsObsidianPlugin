import { Platform, setIcon } from 'obsidian';
import { anchorOf, canWrite, draftAfterRefusal, draftOf, ensureTickable, removeRepeat, setRepeat, type RepeatDraft } from '../core/repeat-line';
import { dayOf } from '../core/when';
import { CARD_TOOLS_CLASS, placeCardPopover } from './card-tools';
import { labelBy, targetOf } from './dom';
import { queueDraftEdit, type DraftBase } from './line-edit';
import type { PrinceListView } from './list-view';
import { buildRepeatForm, readRepeatForm, REMOVE_CLASS, SAVE_CLASS } from './repeat-form';
import { RepeatModal } from './repeat-modal';

const REPEAT_BUTTON_CLASS = 'princelists-card-repeat';
const POPOVER_CLASS = 'princelists-repeat-popover';
const FORM_CLASS = 'princelists-repeat-form';
const IN_MODAL_CLASS = 'princelists-repeat-in-modal';

/** Adds the card's `Repeat` button to `buttons`; call it after the star and before the date picker. */
export function buildRepeatButton(buttons: HTMLElement): void {
	const button = buttons.createEl('button', { cls: REPEAT_BUTTON_CLASS, attr: { 'aria-label': 'Repeat', 'aria-expanded': 'false' } });
	setIcon(button, 'repeat');
}

/** Marks the card's `Repeat` button, and names it `Edit repeat`, while its item repeats. */
export function showRepeatButton(cardEl: HTMLElement, repeats: boolean): void {
	const button = cardEl.querySelector<HTMLElement>(`.${REPEAT_BUTTON_CLASS}`);
	button?.toggleClass('is-repeating', repeats);
	button?.setAttribute('aria-label', repeats ? 'Edit repeat' : 'Repeat');
}

/** Opens the repeat popover from the open card's buttons, with the draft its item's line gives; closes it if it's open. */
function toggleRepeatPopover(view: PrinceListView): void {
	if (view.repeatPopover) {
		escapeRepeatPopover(view);
		return;
	}
	openRepeatPopover(view);
}

/**
 * Opens the repeat popover, and leaves it as it is when it's open, which a menu entry has no
 * reason to close. `kept` is the draft to show instead of the line's own. On mobile the form opens
 * in a modal instead, which the view's own state and handlers treat as the popover.
 */
export function openRepeatPopover(view: PrinceListView, kept?: RepeatDraft | 'read-only'): void {
	if (view.repeatPopover) return;
	const line = view.selected;
	const tools = view.card?.el.querySelector<HTMLElement>(`.${CARD_TOOLS_CLASS}`);
	const text = line === null ? undefined : view.lines()[line]?.text;
	if (!tools || text === undefined) return;
	const draft = kept ?? draftOf(text);
	const opened = { text, seen: view.outsideChanges };
	if (Platform.isMobile) {
		openRepeatModal(view, opened, draft);
		return;
	}
	// Focusable itself, so a press on its labels or gaps keeps focus inside it.
	const el = tools.createDiv({ cls: [POPOVER_CLASS, FORM_CLASS], attr: { role: 'dialog', tabindex: -1 } });
	view.repeatPopover = { el, opened, draft, modal: null };
	labelBy(el, el.createDiv({ cls: 'princelists-repeat-title', text: 'Repeat' }));
	buildRepeatForm(el, text, draft);
	repeatButtonOf(view)?.setAttr('aria-expanded', 'true');
	(el.querySelector<HTMLElement>('input, button') ?? el).focus();
	placeCardPopover(view, el);
}

// Its content is outside the view, so it takes the view's input, click and Enter handling itself. No
// field takes focus as it opens, which would raise the keyboard over the form at once.
function openRepeatModal(view: PrinceListView, opened: DraftBase, draft: RepeatDraft | 'read-only'): void {
	const modal = new RepeatModal(
		view.app,
		(contentEl) => {
			const el = contentEl.createDiv({ cls: [FORM_CLASS, IN_MODAL_CLASS], attr: { tabindex: -1 } });
			view.repeatPopover = { el, opened, draft, modal };
			buildRepeatForm(el, opened.text, draft);
			for (const type of ['input', 'change']) el.addEventListener(type, (evt) => repeatInput(view, evt));
			el.addEventListener('click', (evt) => {
				const target = targetOf(evt);
				if (target) repeatClick(view, target);
			});
		},
		() => {
			if (view.repeatPopover?.modal !== modal) return;
			view.repeatPopover = null;
			repeatButtonOf(view)?.setAttr('aria-expanded', 'false');
		},
	);
	modal.scope.register([], 'Enter', (evt) => {
		if (!evt.targetNode?.instanceOf(HTMLInputElement) || !isInRepeatPopover(view, evt.targetNode)) return true;
		saveRepeat(view);
		return false;
	});
	modal.open();
	repeatButtonOf(view)?.setAttr('aria-expanded', 'true');
}

/** Closes the repeat popover, or on mobile its modal. */
export function closeRepeatPopover(view: PrinceListView): void {
	const open = view.repeatPopover;
	if (!open) return;
	// Cleared first, so the modal's own close, which runs onClose, finds nothing left to do.
	view.repeatPopover = null;
	if (open.modal) open.modal.close();
	else open.el.remove();
	repeatButtonOf(view)?.setAttr('aria-expanded', 'false');
}

/** Closes the repeat popover and focuses the card's repeat button. */
export function escapeRepeatPopover(view: PrinceListView): void {
	closeRepeatPopover(view);
	repeatButtonOf(view)?.focus();
}

/** Whether `target` is in the open repeat popover. */
export function isInRepeatPopover(view: PrinceListView, target: Node | null): boolean {
	return view.repeatPopover?.el.contains(target) ?? false;
}

/**
 * Handles a click on the repeat button, Save or Remove repeat. Returns whether `target` was on one.
 */
export function repeatClick(view: PrinceListView, target: HTMLElement): boolean {
	if (target.closest(`.${REPEAT_BUTTON_CLASS}`)) {
		toggleRepeatPopover(view);
		return true;
	}
	if (!isInRepeatPopover(view, target)) return false;
	if (target.closest(`.${SAVE_CLASS}`)) saveRepeat(view);
	else if (target.closest(`.${REMOVE_CLASS}`)) removeRepeatFromLine(view);
	return true;
}

/** Reads the draft again after typing or a change in one of the popover's controls, and redraws what depends on it. */
export function repeatInput(view: PrinceListView, evt: Event): void {
	const open = view.repeatPopover;
	if (!open || open.draft === 'read-only') return;
	open.draft = readRepeatForm(open.el, evt, anchorOf(open.opened.text)) ?? open.draft;
}

/** Saves the draft, as the Save button does. */
export function saveRepeat(view: PrinceListView): void {
	const open = view.repeatPopover;
	if (!open || open.draft === 'read-only' || !canWrite(open.draft)) return;
	const { rule, end } = open.draft;
	// Today at the save, not at the popover's drawing.
	writeToLine(view, (text) => ensureTickable(setRepeat(text, rule, end, dayOf(new Date()))));
}

function removeRepeatFromLine(view: PrinceListView): void {
	writeToLine(view, removeRepeat);
}

// One write from the draft's base. The popover closes first; if the write is refused, it opens again
// with the draft while the line still reads as it did, else on the line as it reads now.
function writeToLine(view: PrinceListView, change: (line: string) => string): void {
	const open = view.repeatPopover;
	const line = view.selected;
	// An outside change takes the card's item and closes the popover with it (`cardLost`).
	if (!open || line === null) return;
	closeRepeatPopover(view);
	queueDraftEdit(view, line, open.opened, change, {
		// The write is async: focus comes back to the card only if the user hasn't gone elsewhere.
		written: () => {
			const { body, activeElement } = view.contentEl.doc;
			if (activeElement === body || activeElement === null) repeatButtonOf(view)?.focus();
		},
		refused: (tracked) => {
			const now = view.lines()[tracked]?.text;
			if (view.selected !== tracked || now === undefined) return;
			openRepeatPopover(view, draftAfterRefusal(open.draft, open.opened.text, now));
		},
	});
}

function repeatButtonOf(view: PrinceListView): HTMLElement | null {
	return view.card?.el.querySelector<HTMLElement>(`.${REPEAT_BUTTON_CLASS}`) ?? null;
}
