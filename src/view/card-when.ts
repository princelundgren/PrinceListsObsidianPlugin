import { Platform, setIcon } from 'obsidian';
import { dayOf, setWhen } from '../core/when';
import type { Card } from './card';
import { queueLineEdit, queueRemoveWhen } from './line-edit';
import type { PrinceListView } from './list-view';
import { fillWhen } from './row-marks';

export const WHEN_INPUT_CLASS = 'princelists-when-input';
const WHEN_BUTTON_CLASS = 'princelists-when-button';

// The date input lies over the button at its size, invisible, so a click or tap lands on the input
// and opens the platform's own date picker.
export function buildWhenPicker(tools: HTMLElement): void {
	const row = tools.createDiv({ cls: 'princelists-card-when' });
	const picker = row.createDiv({ cls: 'princelists-when-picker' });
	picker.createDiv({ cls: WHEN_BUTTON_CLASS });
	picker.createEl('input', { cls: WHEN_INPUT_CLASS, type: 'date', attr: { 'aria-label': 'Date' } });
}

export function showWhen(card: Card, day: string | null): void {
	const button = card.el.querySelector<HTMLElement>(`.${WHEN_BUTTON_CLASS}`);
	const input = card.el.querySelector<HTMLInputElement>(`.${WHEN_INPUT_CLASS}`);
	if (!button || !input) return;
	if (day === null) {
		button.empty();
		setIcon(button, 'calendar');
	} else {
		fillWhen(button, day, dayOf(new Date()));
	}
	button.toggleClass('is-dated', day !== null);
	if (card.el.doc.activeElement !== input) input.value = day ?? '';
}

// Chromium opens a date input's picker only from its own calendar icon, which the input's opacity
// hides; Safari on iOS opens it on a tap and has no showPicker().
export function whenClick(input: HTMLInputElement): void {
	if (!Platform.isDesktopApp) return;
	input.showPicker();
	followIfShown(input);
}

/**
 * Notes a date picker that a key on `input` showed. Chromium shows one for Space, F4 or Alt+Down, after
 * the keydown, so its `:open` state is read a frame later.
 */
export function whenKeyDown(input: HTMLInputElement): void {
	if (!Platform.isDesktopApp) return;
	input.win.requestAnimationFrame(() => followIfShown(input));
}

// The inputs whose date picker shows. Chromium closes the picker on a press outside it before the page
// hears the press, and on Escape with no event, so its `:open` state is read each frame while it shows.
const shownPickers = new WeakSet<HTMLInputElement>();

function followIfShown(input: HTMLInputElement): void {
	if (CSS.supports('selector(:open)') && input.matches(':open')) followPicker(input);
}

function followPicker(input: HTMLInputElement): void {
	if (shownPickers.has(input)) return;
	shownPickers.add(input);
	const check = (): void => {
		if (!shownPickers.has(input)) return;
		if (input.matches(':open')) input.win.requestAnimationFrame(check);
		else shownPickers.delete(input);
	};
	input.win.requestAnimationFrame(check);
}

/** Whether `input`'s date picker showed until the event being handled, which may have closed it. */
export function pickerShowed(input: HTMLInputElement): boolean {
	return shownPickers.has(input);
}

/** Forgets that `input`'s date picker shows, once a press has closed it. */
export function forgetPicker(input: HTMLInputElement): void {
	shownPickers.delete(input);
}

export function whenChange(view: PrinceListView, input: HTMLInputElement): void {
	setDay(view, input.value || null);
}

function setDay(view: PrinceListView, day: string | null): void {
	const line = view.editing.selected;
	if (line === null) return;
	if (day === null) queueRemoveWhen(view, line);
	else queueLineEdit(view, line, (text) => setWhen(text, day));
}
