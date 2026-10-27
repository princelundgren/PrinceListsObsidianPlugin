import { Platform, setIcon } from 'obsidian';
import { dayOf, setWhen } from '../core/when';
import type { Card } from './card';
import { queueLineEdit } from './line-edit';
import type { PrinceListView } from './list-view';
import { fillWhen } from './row-marks';

export const WHEN_INPUT_CLASS = 'princelists-when-input';
export const WHEN_CLEAR_CLASS = 'princelists-when-clear';
const WHEN_ROW_CLASS = 'princelists-card-when';
const WHEN_BUTTON_CLASS = 'princelists-when-button';

// The date input lies over the button at its size, invisible, so a click or tap lands on the input
// and opens the platform's own date picker.
export function buildWhenRow(body: HTMLElement): void {
	const row = body.createDiv({ cls: WHEN_ROW_CLASS });
	const picker = row.createDiv({ cls: 'princelists-when-picker' });
	picker.createDiv({ cls: WHEN_BUTTON_CLASS });
	picker.createEl('input', { cls: WHEN_INPUT_CLASS, type: 'date', attr: { 'aria-label': 'When' } });
	const clear = row.createEl('button', { cls: WHEN_CLEAR_CLASS, attr: { 'aria-label': 'Remove the day' } });
	setIcon(clear, 'x');
}

export function showWhen(card: Card, day: string | null): void {
	const button = card.el.querySelector<HTMLElement>(`.${WHEN_BUTTON_CLASS}`);
	const input = card.el.querySelector<HTMLInputElement>(`.${WHEN_INPUT_CLASS}`);
	const clear = card.el.querySelector<HTMLElement>(`.${WHEN_CLEAR_CLASS}`);
	if (!button || !input || !clear) return;
	if (day === null) {
		button.empty();
		button.createSpan({ cls: 'princelists-when-empty', text: 'When' });
	} else {
		fillWhen(button, day, dayOf(new Date()));
	}
	if (card.el.doc.activeElement !== input) input.value = day ?? '';
	clear.toggle(day !== null);
}

// Chromium opens a date input's picker only from its own calendar icon, which the input's opacity
// hides; Safari on iOS opens it on a tap and has no showPicker().
export function whenClick(input: HTMLInputElement): void {
	if (Platform.isDesktopApp) input.showPicker();
}

export function whenChange(view: PrinceListView, input: HTMLInputElement): void {
	setDay(view, input.value || null);
}

export function clearWhen(view: PrinceListView): void {
	setDay(view, null);
}

function setDay(view: PrinceListView, day: string | null): void {
	const line = view.editing.selected;
	if (line !== null) queueLineEdit(view, line, (text) => setWhen(text, day));
}
