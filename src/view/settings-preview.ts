import { previewRows } from '../core/settings-preview';
import type { OverdueStyle } from '../core/overdue';
import { dayOf } from '../core/when';
import { CHECKBOX_CLASS, ITEM_CLASS, ITEM_TITLE_CLASS, ITEMS_CLASS, TITLE_AND_TAGS_CLASS } from './render-list';
import { addStar, addWhen, showStarColor } from './row-marks';

/**
 * Empties `el` and draws the settings' sample rows in it, with the star and the days in the colors
 * and the overdue label `style` gives, as a list's rows show them. The rows are inert: nothing in
 * them can be ticked, opened or focused.
 */
export function drawSettingsPreview(el: HTMLElement, style: OverdueStyle, now: Date): void {
	el.empty();
	showStarColor(el, style.starColor);
	const listEl = el.createEl('ul', { cls: ITEMS_CLASS });
	listEl.inert = true;
	const today = dayOf(now);
	for (const row of previewRows(now)) {
		const rowEl = listEl.createEl('li', { cls: ITEM_CLASS });
		rowEl.createEl('input', { cls: CHECKBOX_CLASS, type: 'checkbox' });
		rowEl.createDiv({ cls: TITLE_AND_TAGS_CLASS }).createDiv({ cls: ITEM_TITLE_CLASS, text: row.title });
		if (row.starred) addStar(rowEl);
		addWhen(rowEl, row.when, today, false, style);
	}
}
