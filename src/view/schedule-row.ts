import { setIcon, setTooltip, type Component } from 'obsidian';
import { RIBBON_ICON } from '../constants';
import { listFolder, type ListGroup, type ScheduledItem } from '../core/schedule';
import { addHiddenLabel } from './dom';
import { renderInline, type MarkdownHost } from './notes';
import { addTickZone, CHECKBOX_CLASS, ITEM_CLASS } from './render-list';
import { addRepeat, addStar, addTags, addWhen } from './row-marks';

export const LIST_HEADING_CLASS = 'princelists-schedule-list-heading';

/**
 * A Schedule row for `item`, with its list's name when `showsList`, and the Component its
 * rendered title needs, which `host` must remove once the row goes.
 */
export function buildScheduleRow(host: MarkdownHost, item: ScheduledItem, today: string, { showsList }: { showsList: boolean }): { rowEl: HTMLLIElement; block: Component | null } {
	const rowEl = createEl('li', { cls: ITEM_CLASS });
	rowEl.toggleClass('is-done', item.done);
	addTickZone(rowEl);
	const box = rowEl.createEl('input', { cls: CHECKBOX_CLASS, type: 'checkbox' });
	box.checked = item.done;
	addHiddenLabel(box, item.title);
	const text = rowEl.createDiv({ cls: 'princelists-schedule-text' });
	const titleLine = text.createDiv({ cls: 'princelists-schedule-title-line' });
	const block = renderInline(host, item.listPath, titleLine.createDiv({ cls: 'princelists-item-title' }), item.title);
	addTags(titleLine, item.tailTags);
	titleLine.toggleClass('is-tagged', item.tailTags.length > 0);
	if (item.starred) addStar(titleLine);
	addWhen(titleLine, item.day, today);
	if (item.repeats) addRepeat(titleLine);
	if (showsList) addListName(text, item.listName, listFolder(item.listPath));
	return { rowEl, block };
}

/** A list's subheading while the Schedule groups by list: the list icon in the checkboxes' column, and a button of the name and its folder. */
export function buildListHeading({ listName, folder }: ListGroup): HTMLDivElement {
	const heading = createDiv({ cls: LIST_HEADING_CLASS, attr: { role: 'heading', 'aria-level': 3 } });
	setIcon(heading.createSpan({ cls: 'princelists-schedule-list-icon', attr: { 'aria-hidden': 'true' } }), RIBBON_ICON);
	const label = heading.createEl('button', { cls: 'princelists-schedule-list-label' });
	label.createSpan({ cls: 'princelists-schedule-list-name', text: listName });
	if (folder) label.createSpan({ cls: 'princelists-schedule-list-folder', text: folder });
	return heading;
}

// The name alone, with its path in a tooltip, so a row stays short.
function addListName(el: HTMLElement, listName: string, folder: string): void {
	const nameEl = el.createDiv({ cls: 'princelists-schedule-list', text: listName });
	if (folder) setTooltip(nameEl, `${folder}/${listName}`);
}
