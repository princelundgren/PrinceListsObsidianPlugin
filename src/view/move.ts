import { Notice } from 'obsidian';
import { dropAt, groupDropAt, sectionDropAt, type Drop, type GroupDrop, type SectionDrop, type ShownRow } from '../core/drop';
import type { TrackedLine } from '../core/editing';
import { groupCount, landingHeading, planGroupMove, type GroupPlace } from '../core/group-actions';
import { countPhrase } from '../core/group-edits';
import { planItemMove, planSectionMove, type ItemPlace } from '../core/list-actions';
import { contentStartLine } from '../obsidian/marker';
import { followPlace } from './add-button';
import { expandFor } from './collapse';
import { queueGroupAction } from './group-write';
import type { PrinceListView } from './list-view';
import { ownElement, ownElements } from './own-rows';
import { HEADING_CLASS, ITEM_CLASS, LINE_ATTR, lineOf } from './render-list';
import { CHANGED_ELSEWHERE_NOTICE, writePlanned } from './write';

const DROP_ABOVE = 'princelists-drop-above';
const DROP_BELOW = 'princelists-drop-below';

// In the order they show. Every row and heading carries its line, and hidden rows aren't drawn.
export function shownRows(listEl: HTMLElement): ShownRow[] {
	return ownElements(listEl, `[${LINE_ATTR}]`).map((el) => ({
		line: lineOf(el) as number,
		kind: el.hasClass(HEADING_CLASS) ? 'heading' : el.hasClass(ITEM_CLASS) ? 'item' : 'untouched',
	}));
}

/**
 * A dragged item's drop, a dragged heading's, which moves its whole section, or a dragged selection's,
 * with the rows the drag carries at their lines when it was aimed.
 */
export type RowDrop = { item: Drop } | { section: SectionDrop } | { group: GroupDrop; rows: readonly number[] };

export function aimDrop(shown: readonly ShownRow[], dragged: ShownRow, over: { line: number; below: boolean }): RowDrop | null {
	if (dragged.kind === 'heading') {
		const section = sectionDropAt(shown, dragged.line, over);
		return section && { section };
	}
	const item = dropAt(shown, dragged.line, over);
	return item && { item };
}

/**
 * The drop for a drag aimed `over` a row: a dragged selection's when the drag carries `others`, aimed
 * with those still there, else the dragged row's own.
 */
export function aimCarried(
	shown: readonly ShownRow[],
	dragged: ShownRow,
	others: readonly TrackedLine[],
	over: { line: number; below: boolean },
): RowDrop | null {
	if (others.length === 0) return aimDrop(shown, dragged, over);
	const carried = others.flatMap((row) => (row.line === null ? [] : [row.line]));
	return aimGroupDrop(shown, [dragged.line, ...carried], over);
}

// A dragged selection's drop, aimed as groupDropAt aims it with the rows on `moving`.
function aimGroupDrop(shown: readonly ShownRow[], moving: readonly number[], over: { line: number; below: boolean }): RowDrop | null {
	const group = groupDropAt(shown, moving, over);
	return group && { group, rows: moving };
}

// Takes the drop line off `marked` and shows it for `drop`. Returns the element that shows it now.
export function markDrop(listEl: HTMLElement, marked: HTMLElement | null, drop: RowDrop | null): HTMLElement | null {
	marked?.removeClass(DROP_ABOVE, DROP_BELOW);
	if (!drop) return null;
	const { line, above } = 'item' in drop ? drop.item : 'section' in drop ? drop.section : drop.group;
	const next = ownElement(listEl, `[${LINE_ATTR}="${line}"]`);
	next?.addClass(above ? DROP_ABOVE : DROP_BELOW);
	return next;
}

// `line` is the dragged row's: an item's title line, or a heading's.
export function queueDrop(view: PrinceListView, line: number, drop: RowDrop): void {
	if ('item' in drop) queueMove(view, line, drop.item.place);
	else if ('section' in drop) queueSectionMove(view, line, drop.section.before);
	else queueSelectionDrop(view, drop.rows, drop.group.place);
}

// The message counts what moves by name: a selected heading's selected items come with it, so they
// aren't counted.
function queueSelectionDrop(view: PrinceListView, rows: readonly number[], place: GroupPlace): void {
	const { items, headings } = groupCount(view.text, contentStartLine(view.text), rows);
	queueGroupMove(view, rows, place, `${countPhrase(items, headings)} moved.`);
}

// The move waits on the view's write queue, and its item and place follow the edits that land before
// it runs.
export function queueMove(view: PrinceListView, line: number, place: ItemPlace): void {
	const file = view.file;
	if (!file) return;
	expandFor(view, place);
	const item = view.editing.track(line);
	const anchor = place === 'first' ? null : view.editing.track('after' in place ? place.after : place.firstUnder);
	void view.enqueue(async () => {
		try {
			if (view.viewClosed || view.file !== file) return;
			if (item.line === null || anchor?.line === null) {
				new Notice(CHANGED_ELSEWHERE_NOTICE);
				return;
			}
			const moved = await writePlanned(view, (text) => {
				const to = followPlace(place, anchor?.line ?? null);
				return item.line === null || !to ? null : planItemMove(text, contentStartLine(text), item.line, to);
			});
			// Obsidian's echo of the write returns early in setViewData, so the view draws the move.
			if (moved) view.render();
		} finally {
			view.editing.untrack(item);
			if (anchor) view.editing.untrack(anchor);
		}
	});
}

// As queueMove: the heading and the one the section goes before follow the edits that land first.
export function queueSectionMove(view: PrinceListView, headingLine: number, before: number | null): void {
	const file = view.file;
	if (!file) return;
	const heading = view.editing.track(headingLine);
	const anchor = before === null ? null : view.editing.track(before);
	void view.enqueue(async () => {
		try {
			if (view.viewClosed || view.file !== file) return;
			if (heading.line === null || anchor?.line === null) {
				new Notice(CHANGED_ELSEWHERE_NOTICE);
				return;
			}
			const moved = await writePlanned(view, (text) =>
				heading.line === null ? null : planSectionMove(text, contentStartLine(text), heading.line, anchor?.line ?? null),
			);
			if (moved) view.render();
		} finally {
			view.editing.untrack(heading);
			if (anchor) view.editing.untrack(anchor);
		}
	});
}

/**
 * Moves the rows on `rows` to `place` in one write, on the view's write queue, as queueMove does one
 * item: the rows and the place's line follow the edits that land first, and a collapsed section the
 * loose items land in opens. After the move it offers `message` with an Undo button.
 */
export function queueGroupMove(view: PrinceListView, rows: readonly number[], place: GroupPlace, message: string): void {
	const heading = landingHeading(view.text, contentStartLine(view.text), rows, place);
	if (heading !== null) view.collapsed.expand(heading);
	const at = placeLine(place);
	queueGroupAction(
		view,
		at === null ? rows : [...rows, at],
		(text, contentStart, now) => {
			if (at === null) return planGroupMove(text, contentStart, now, place);
			return planGroupMove(text, contentStart, now.slice(0, -1), placeAt(place, now[now.length - 1] as number));
		},
		() => message,
	);
}

// The line a place is on, or null for one on none.
function placeLine(place: GroupPlace): number | null {
	if (place === 'first') return null;
	if ('after' in place) return place.after;
	if ('firstUnder' in place) return place.firstUnder;
	return 'beforeSection' in place ? place.beforeSection : place.endOf;
}

// The place on `line` instead of its own; a place on no line stays as it is.
function placeAt(place: GroupPlace, line: number): GroupPlace {
	if (place === 'first') return place;
	if ('after' in place) return { after: line };
	if ('firstUnder' in place) return { firstUnder: line };
	if ('beforeSection' in place) return place.beforeSection === null ? place : { beforeSection: line };
	return place.endOf === null ? place : { endOf: line };
}
