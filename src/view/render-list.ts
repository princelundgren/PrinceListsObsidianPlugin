import { visibleSections } from '../core/display';
import { getListNote } from '../core/edit-list-note';
import { splitLines } from '../core/lines';
import { parseList } from '../core/parse';
import { contentStartLine } from '../obsidian/marker';

export const ITEM_CLASS = 'princelists-item';
export const CHECKBOX_CLASS = 'princelists-checkbox';

// Draws the list note and the sections under `el`, from one parse of `text`. Each row carries its
// title line in `data-line` for the view's delegated listener, so rows get no listeners of their own.
export function renderList(el: HTMLElement, text: string, showArchived: boolean): void {
	const lines = splitLines(text);
	const model = parseList(lines, contentStartLine(text));
	const note = getListNote(lines, model);
	// Plain text: the list note until its editor renders it, and content the plugin leaves alone for
	// good (spec, "Content the plugin leaves alone").
	if (note !== '') el.createDiv({ cls: 'princelists-list-note', text: note });
	for (const section of visibleSections(lines, model, new Date(), showArchived)) {
		if (section.heading) el.createEl('h2', { cls: 'princelists-heading', text: section.heading.text });
		let list: HTMLUListElement | null = null;
		for (const row of section.rows) {
			if (row.kind === 'untouched') {
				el.createDiv({ cls: 'princelists-untouched', text: row.text });
				list = null;
				continue;
			}
			list ??= el.createEl('ul', { cls: 'princelists-items' });
			const rowEl = list.createEl('li', { cls: ITEM_CLASS, attr: { 'data-line': row.titleLine } });
			rowEl.createEl('input', { cls: CHECKBOX_CLASS, type: 'checkbox', attr: { 'aria-label': row.label } });
			rowEl.createSpan({ cls: 'princelists-item-title', text: row.title });
			showDone(rowEl, row.done);
		}
	}
}

// Also how the view shows its own tick: in place, so focus and the scroll position stay.
export function showDone(rowEl: HTMLElement, done: boolean): void {
	rowEl.toggleClass('is-done', done);
	(rowEl.querySelector(`.${CHECKBOX_CLASS}`) as HTMLInputElement).checked = done;
}
