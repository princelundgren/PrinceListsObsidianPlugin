import type { Component } from 'obsidian';
import { visibleSections, withoutRange, type ItemRow, type SectionRows } from '../core/display';
import type { LineRange } from '../core/follow';
import type { Line } from '../core/lines';
import type { ListModel } from '../core/parse';
import type { PrinceListView } from './list-view';
import { renderInline } from './notes';

export const ITEM_CLASS = 'princelists-item';
export const CHECKBOX_CLASS = 'princelists-checkbox';
export const ITEMS_CLASS = 'princelists-items';
export const OPEN_AS_MARKDOWN_CLASS = 'princelists-open-as-markdown';
// A row's or heading's first line. The plugin's own name: Markdown that Obsidian renders carries its
// own `data-line` attributes, which the view must not read or shift.
export const LINE_ATTR = 'data-princelists-line';

export function lineOf(el: Element): number | null {
	const line = el.getAttr(LINE_ATTR);
	return line === null ? null : Number(line);
}

export function setLine(el: Element, line: number | null): void {
	el.setAttr(LINE_ATTR, line);
}

/**
 * Where the open card goes: in place of the row at `line`, or, when `replaces` is false, before the
 * first row after it.
 */
export interface CardPlace {
	el: HTMLElement;
	line: number;
	replaces: boolean;
}

// Draws the sections under `el`. Each row and heading carries its first line in LINE_ATTR for the
// view's delegated listeners, so they get no listeners of their own. The view keeps every LINE_ATTR
// true to its text between redraws (PrinceListView.applyOwnText). Rendered titles and headings record
// their Component in `blocks`, keyed by their element. Rows inside `skip`, the list note being typed,
// aren't drawn; the result says whether any were left out.
export function renderList(
	view: PrinceListView,
	el: HTMLElement,
	lines: readonly Line[],
	model: ListModel,
	card: CardPlace | null,
	blocks: Map<HTMLElement, Component>,
	skip: LineRange | null,
): boolean {
	let placed = card === null;
	let list: HTMLUListElement | null = null;
	const items = () => (list ??= el.createEl('ul', { cls: ITEMS_CLASS }));
	// The card sits in a list too, so a redraw that keeps it finds it at the same depth.
	const placeCard = (line: number, isItem: boolean): boolean => {
		if (placed || !card || line < card.line) return false;
		placed = true;
		items().append(card.el);
		return isItem && line === card.line && card.replaces;
	};
	const sections = visibleSections(lines, model, new Date(), view.showArchived);
	const shown = withoutRange(sections, skip);
	for (const section of shown) {
		if (section.heading) {
			placeCard(section.heading.line, false);
			const heading = el.createDiv({
				cls: 'princelists-heading',
				attr: { role: 'heading', 'aria-level': 2, [LINE_ATTR]: section.heading.line },
			});
			record(blocks, heading, renderInline(view, heading, section.heading.text));
			list = null;
		}
		for (const row of section.rows) {
			if (row.kind === 'untouched') {
				placeCard(row.start, false);
				// Plain text, as content the plugin leaves alone (spec, "Content the plugin leaves
				// alone").
				el.createDiv({ cls: 'princelists-untouched', text: row.text });
				list = null;
				continue;
			}
			if (placeCard(row.titleLine, true)) continue;
			items().append(buildRow(view, row, blocks));
		}
	}
	if (!placed && card) items().append(card.el);
	return drawnCount(shown) < drawnCount(sections);
}

function drawnCount(sections: SectionRows[]): number {
	return sections.reduce((count, { heading, rows }) => count + (heading ? 1 : 0) + rows.length, 0);
}

export function buildRow(view: PrinceListView, row: ItemRow, blocks: Map<HTMLElement, Component>): HTMLLIElement {
	const rowEl = createEl('li', { cls: ITEM_CLASS, attr: { [LINE_ATTR]: row.titleLine } });
	rowEl.createEl('input', { cls: CHECKBOX_CLASS, type: 'checkbox', attr: { 'aria-label': row.label } });
	const title = rowEl.createDiv({ cls: 'princelists-item-title' });
	record(blocks, rowEl, renderInline(view, title, row.title));
	showDone(rowEl, row.done);
	return rowEl;
}

// Also how the view shows its own tick: in place, so focus and the scroll position stay.
export function showDone(rowEl: HTMLElement, done: boolean): void {
	rowEl.toggleClass('is-done', done);
	(rowEl.querySelector(`.${CHECKBOX_CLASS}`) as HTMLInputElement).checked = done;
}

function record(blocks: Map<HTMLElement, Component>, el: HTMLElement, block: Component | null): void {
	if (block) blocks.set(el, block);
}
