import { Platform, type Component } from 'obsidian';
import { visibleSections, withoutRange, type ItemRow, type SectionRows } from '../core/display';
import type { LineRange } from '../core/follow';
import type { Line } from '../core/lines';
import type { ListModel } from '../core/parse';
import { dayOf } from '../core/when';
import { addCollapseArrow } from './collapse';
import { addHiddenLabel } from './dom';
import type { PrinceListView } from './list-view';
import { renderInline, type MarkdownHost } from './notes';
import { addStar, addWhen } from './row-marks';

export const ITEM_CLASS = 'princelists-item';
export const CHECKBOX_CLASS = 'princelists-checkbox';
export const ITEMS_CLASS = 'princelists-items';
export const HEADING_CLASS = 'princelists-heading';
export const OPEN_AS_MARKDOWN_CLASS = 'princelists-open-as-markdown';
// A row's or heading's first line. The plugin's own name: Markdown that Obsidian renders carries its
// own `data-line` attributes, which the view must not read or shift.
export const LINE_ATTR = 'data-princelists-line';
// Rows drag with the mouse on desktop only (enableMouseDrag). On mobile, a hold on a row is kept
// for the touch drag (1b).
export const ROWS_DRAG = Platform.isDesktop;

// A view or block that draws rows. `readonly` only stops buildRow writing the flags: a host may
// change them between draws.
export interface RowHost extends MarkdownHost {
	readonly dragsRows: boolean;
	readonly dragsHeadings: boolean;
}

export function lineOf(el: Element): number | null {
	const line = el.getAttr(LINE_ATTR);
	return line === null ? null : Number(line);
}

export function setLine(el: Element, line: number | null): void {
	el.setAttr(LINE_ATTR, line);
}

// What each row and heading renderList built shows, all but its line, so a later drawing can move it.
const drawnAs = new WeakMap<HTMLElement, string>();

/** The rows and headings renderList drew under `el`, by what they show, for the next drawing to take. */
export type DrawnRows = Map<string, HTMLElement[]>;

/** Makes the next drawing build `rowEl` anew instead of moving it. */
export function forgetDrawn(rowEl: HTMLElement): void {
	drawnAs.delete(rowEl);
}

/** The rows and headings renderList drew under `el` and can move, by what each shows. */
export function drawnRows(el: HTMLElement): DrawnRows {
	const drawn: DrawnRows = new Map();
	for (const rowEl of Array.from(el.querySelectorAll<HTMLElement>(`.${ITEM_CLASS}, .${HEADING_CLASS}`))) {
		const key = drawnAs.get(rowEl);
		if (key === undefined) continue;
		const same = drawn.get(key);
		if (same) same.push(rowEl);
		else drawn.set(key, [rowEl]);
	}
	return drawn;
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

/** Where the open heading field goes: in place of the heading at `line`, or before the first row after it. */
export interface FieldPlace {
	el: HTMLElement;
	line: number;
}

// Draws the sections under `el`. Each row and heading carries its first line in LINE_ATTR for the
// view's delegated listeners, so they get no listeners of their own. The view keeps every LINE_ATTR
// true to its text between redraws (PrinceListView.applyOwnText). Rendered titles and headings record
// their Component in `blocks`, keyed by their element. A row or heading in `drawn` that shows the same
// moves here with its Component, and only its line changes. Rows inside `skip`, the list note being
// typed, aren't drawn; the result says whether any were left out.
export function renderList(
	view: PrinceListView,
	el: HTMLElement,
	lines: readonly Line[],
	model: ListModel,
	card: CardPlace | null,
	blocks: Map<HTMLElement, Component>,
	skip: LineRange | null,
	field: FieldPlace | null,
	drawn: DrawnRows,
): boolean {
	let placed = card === null;
	let fieldPlaced = field === null;
	let list: HTMLUListElement | null = null;
	const items = () => (list ??= el.createEl('ul', { cls: ITEMS_CLASS }));
	// The card sits in a list too, so a redraw that keeps it finds it at the same depth.
	const placeCard = (line: number, isItem: boolean): boolean => {
		if (placed || !card || line < card.line) return false;
		placed = true;
		items().append(card.el);
		return isItem && line === card.line && card.replaces;
	};
	// The heading field sits where a heading does, outside the lists.
	const placeField = (line: number, isHeading: boolean): boolean => {
		if (fieldPlaced || !field || line < field.line) return false;
		fieldPlaced = true;
		el.append(field.el);
		list = null;
		return isHeading && line === field.line;
	};
	const sourcePath = view.sourcePath;
	const today = dayOf(new Date());
	const sections = visibleSections(lines, model, new Date(), { showArchived: view.showArchived, query: view.filter ?? '', keepLine: view.selected, collapsed: view.collapsed.lines() });
	const shown = withoutRange(sections, skip);
	for (const section of shown) {
		if (section.heading) {
			placeCard(section.heading.line, false);
			if (!placeField(section.heading.line, true)) {
				const { line, ...headingShown } = section.heading;
				const key = JSON.stringify(['heading', sourcePath, headingShown, section.collapsed]);
				let headingEl = drawn.get(key)?.shift();
				if (headingEl) {
					setLine(headingEl, line);
				} else {
					headingEl = buildHeading(view, sourcePath, section.heading, blocks);
					addCollapseArrow(headingEl, section.collapsed);
					drawnAs.set(headingEl, key);
				}
				el.append(headingEl);
			}
			list = null;
		}
		for (const row of section.rows) {
			placeField(row.kind === 'item' ? row.titleLine : row.start, false);
			if (row.kind === 'untouched') {
				placeCard(row.start, false);
				// Plain text, as content the plugin leaves alone (spec, "Content the plugin leaves
				// alone").
				el.createDiv({ cls: 'princelists-untouched', text: row.text, attr: { [LINE_ATTR]: row.start } });
				list = null;
				continue;
			}
			if (placeCard(row.titleLine, true)) continue;
			items().append(takeRow(view, sourcePath, row, blocks, drawn, today));
		}
	}
	if (!placed && card) items().append(card.el);
	if (!fieldPlaced && field) el.append(field.el);
	return drawnCount(shown) < drawnCount(sections);
}

export function buildHeading(
	host: RowHost,
	sourcePath: string,
	heading: { line: number; text: string },
	blocks: Map<HTMLElement, Component>,
): HTMLElement {
	const el = createDiv({ cls: HEADING_CLASS, attr: { role: 'heading', 'aria-level': 2, [LINE_ATTR]: heading.line } });
	if (ROWS_DRAG && host.dragsHeadings) el.draggable = true;
	record(blocks, el, renderInline(host, sourcePath, el, heading.text));
	return el;
}

function drawnCount(sections: SectionRows[]): number {
	return sections.reduce((count, { heading, rows }) => count + (heading ? 1 : 0) + rows.length, 0);
}

export function buildRow(host: RowHost, sourcePath: string, row: ItemRow, blocks: Map<HTMLElement, Component>): HTMLLIElement {
	const rowEl = createEl('li', { cls: ITEM_CLASS, attr: { [LINE_ATTR]: row.titleLine } });
	if (ROWS_DRAG && host.dragsRows) rowEl.draggable = true;
	addHiddenLabel(rowEl.createEl('input', { cls: CHECKBOX_CLASS, type: 'checkbox' }), row.label);
	const title = rowEl.createDiv({ cls: 'princelists-item-title' });
	record(blocks, rowEl, renderInline(host, sourcePath, title, row.title));
	if (row.starred) addStar(rowEl);
	if (row.when !== null) addWhen(rowEl, row.when, dayOf(new Date()));
	showDone(rowEl, row);
	return rowEl;
}

// A tick in place leaves a row showing other than its key says, so a moved row shows its row's box again.
function takeRow(view: PrinceListView, sourcePath: string, row: ItemRow, blocks: Map<HTMLElement, Component>, drawn: DrawnRows, today: string): HTMLLIElement {
	const { titleLine, ...shown } = row;
	// Today only changes how a When reads.
	const key = JSON.stringify(['item', sourcePath, shown.when === null ? null : today, shown]);
	const moved = drawn.get(key)?.shift();
	if (moved?.instanceOf(HTMLLIElement)) {
		setLine(moved, titleLine);
		showDone(moved, row);
		return moved;
	}
	const rowEl = buildRow(view, sourcePath, row, blocks);
	drawnAs.set(rowEl, key);
	return rowEl;
}

// Also how the view shows its own tick: in place, so focus and the scroll position stay.
export function showDone(rowEl: HTMLElement, { done, archived }: ItemRow): void {
	rowEl.toggleClass('is-done', done);
	rowEl.toggleClass('is-archived', archived);
	(rowEl.querySelector(`.${CHECKBOX_CLASS}`) as HTMLInputElement).checked = done;
}

function record(blocks: Map<HTMLElement, Component>, el: HTMLElement, block: Component | null): void {
	if (block) blocks.set(el, block);
}
