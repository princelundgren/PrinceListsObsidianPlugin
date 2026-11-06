import type { Component } from 'obsidian';
import type { ScheduledItem } from '../core/schedule';
import { addHiddenLabel } from './dom';
import { renderInline, type MarkdownHost } from './notes';
import { addTickZone, CHECKBOX_CLASS, ITEM_CLASS } from './render-list';
import { addStar, addWhen } from './row-marks';

/** A Schedule row for `item`, and the Component its rendered title needs, which `host` must remove once the row goes. */
export function buildScheduleRow(host: MarkdownHost, item: ScheduledItem, today: string): { rowEl: HTMLLIElement; block: Component | null } {
	const rowEl = createEl('li', { cls: ITEM_CLASS });
	rowEl.toggleClass('is-done', item.done);
	addTickZone(rowEl);
	const box = rowEl.createEl('input', { cls: CHECKBOX_CLASS, type: 'checkbox' });
	box.checked = item.done;
	addHiddenLabel(box, item.title);
	const text = rowEl.createDiv({ cls: 'princelists-schedule-text' });
	const titleLine = text.createDiv({ cls: 'princelists-schedule-title-line' });
	const block = renderInline(host, item.listPath, titleLine.createDiv({ cls: 'princelists-item-title' }), item.title);
	if (item.starred) addStar(titleLine);
	addWhen(titleLine, item.day, today);
	text.createDiv({ cls: 'princelists-schedule-list', text: item.listName });
	return { rowEl, block };
}
