import { isArchived } from './archive';
import { splitAtx } from './edit-headings';
import { getItemNotes } from './edit-items';
import { isDoneStatus, parseItemLine, type ItemLineParts } from './item-line';
import { itemTags } from './item-tags';
import type { Line } from './lines';
import type { ItemBlock, ListModel } from './parse';
import { repeatOf } from './repeat-line';
import { splitStar } from './star';
import { isAnyLit, meetsLitTags, stripTags, type LitTags } from './tags';
import { whenOf } from './when';

export interface ItemRow {
	kind: 'item';
	titleLine: number;
	title: string;
	/** The checkbox's accessible name: the title, or the rest of the line when the title is empty. */
	label: string;
	done: boolean;
	/** Done the archive delay or longer ago, so hidden unless "Show archived items" is on. */
	archived: boolean;
	starred: boolean;
	/** The item's When, `YYYY-MM-DD`, or null. */
	when: string | null;
	/** The item's tags without their `#`: the title's, then the tail's. */
	tags: string[];
	/** The tail's tags, which the card shows apart from the title. */
	tailTags: string[];
	/** The item is open and has a `🔁` field, whether or not PrinceLists can follow it. */
	repeats: boolean;
}

/** A block the plugin leaves alone, such as a paragraph, table or code block, as its raw lines. */
export interface UntouchedRow {
	kind: 'untouched';
	start: number;
	text: string;
}

export type ListRow = ItemRow | UntouchedRow;

export interface SectionRows {
	/** null for the unnamed section before the first heading. */
	heading: { line: number; text: string } | null;
	/** In file order. */
	rows: ListRow[];
	/** The heading is collapsed, whether or not a filter shows rows under it. */
	collapsed: boolean;
}

/** What Cmd+F's field holds: the text as typed, and the view's fuzzy search for it, which core only calls. */
export interface Find {
	text: string;
	fuzzyMatches: (text: string) => boolean;
}

export interface RowFilter {
	showArchived: boolean;
	/** "Show starred only": hides every item that isn't starred. */
	starredOnly: boolean;
	/** How long after its tick a done item is archived. */
	archiveDelayMs: number;
	/** What Cmd+F's field finds, or null while it holds nothing. */
	find: Find | null;
	/** What the tag strip has lit. */
	lit: LitTags;
	/** The open card's item, which shows whether or not it matches or its section is collapsed. */
	keepLine: number | null;
	/** The heading lines whose sections show only the heading while nothing filters the list. */
	collapsed: ReadonlySet<number>;
}

const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)[ \t]*$/;

// Every heading stays, even when all of its items are hidden. Content the plugin leaves alone stays
// too, except while a query, "Show starred only", a lit tag or No tag filters the list: then only the items
// that match show under the headings. A collapsed section shows only its heading, unless the list
// is filtered.
// Archived is worked out from `now` on each redraw, never written down (spec, "Done and archived").
export function visibleSections(lines: readonly Line[], model: ListModel, now: Date, filter: RowFilter): SectionRows[] {
	const filtering = isFiltered(filter);
	return model.sections.map(({ headingLine, items }, i) => {
		const start = headingLine ?? model.contentStart;
		const end = model.sections[i + 1]?.headingLine ?? lines.length;
		const collapsed = headingLine !== null && filter.collapsed.has(headingLine);
		const shown: ListRow[] = items.flatMap((item) => {
			const row = itemRow((lines[item.titleLine] as Line).text, item.titleLine, now, filter.archiveDelayMs);
			if (!isShown(row, filter.showArchived)) return [];
			if (item.titleLine === filter.keepLine) return [row];
			if (filtering) return (!filter.starredOnly || row.starred) && meetsLitTags(row.tags, filter.lit) && itemMatches(lines, item, row, filter.find) ? [row] : [];
			return collapsed ? [] : [row];
		});
		const heading = headingLine === null ? null : { line: headingLine, text: headingText(lines, headingLine) };
		if (filtering) return { heading, rows: shown, collapsed };
		if (collapsed) return { heading, rows: shown, collapsed };
		for (const block of model.untouched) {
			if (block.start < start || block.start >= end) continue;
			const text = lines.slice(block.start, block.end).map((line) => line.text).join('\n');
			shown.push({ kind: 'untouched', start: block.start, text });
		}
		return { heading, rows: shown.sort((a, b) => firstLine(a) - firstLine(b)), collapsed };
	});
}

/** Whether a filter is on and `sections`, visibleSections' for `filter`, show none of the list's items. */
export function findsNothing(model: ListModel, filter: RowFilter, sections: readonly SectionRows[]): boolean {
	const hasItems = model.sections.some(({ items }) => items.length > 0);
	return isFiltered(filter) && hasItems && sections.every(({ rows }) => rows.length === 0);
}

/** Whether a query, "Show starred only", a lit tag or No tag filters what shows. */
export function isFiltered(filter: { find: Find | null; starredOnly: boolean; lit: LitTags }): boolean {
	return filter.find !== null || filter.starredOnly || isAnyLit(filter.lit);
}

/**
 * The tags the strip offers for a list: those of every item shown (archived ones only while
 * `shown.showArchived`), in file order, and the lit ones, whether or not an item carries them.
 */
export function listStripTags(
	lines: readonly Line[],
	model: ListModel,
	now: Date,
	shown: { showArchived: boolean; archiveDelayMs: number },
	lit: readonly string[],
): string[] {
	const carried = model.sections.flatMap(({ items }) => items).flatMap((item) => {
		const row = itemRow((lines[item.titleLine] as Line).text, item.titleLine, now, shown.archiveDelayMs);
		return isShown(row, shown.showArchived) ? [row.tags] : [];
	});
	return stripTags(carried, lit);
}

/** Whether visibleSections draws the item on `titleLine` as a row. */
export function isItemVisible(lines: readonly Line[], model: ListModel, now: Date, filter: RowFilter, titleLine: number): boolean {
	return visibleSections(lines, model, now, filter).some(({ rows }) => rows.some((row) => row.kind === 'item' && row.titleLine === titleLine));
}

function itemMatches(lines: readonly Line[], item: ItemBlock, row: ItemRow, find: Find | null): boolean {
	if (find === null) return true;
	return find.fuzzyMatches(row.title) || find.fuzzyMatches(getItemNotes(lines, item)) || whenMatches(row.when, find);
}

/** Whether the typed text is part of `when`, the day as the file writes it: a fuzzy match would let "2026-11" find 2026-12-01 too. */
export function whenMatches(when: string | null, find: Find): boolean {
	return when !== null && when.includes(find.text);
}

// A done item is hidden once it is archived, unless "Show archived items" is on.
function isShown(row: ItemRow, showArchived: boolean): boolean {
	return showArchived || !row.archived;
}

// Leaves out the headings and rows whose first line is in `range`: while the list note's field has
// focus, its carried range is still the note being typed, even where the file now parses a heading or
// an item there, until the field loses focus and the list is drawn again.
export function withoutRange(sections: SectionRows[], range: { start: number; end: number } | null): SectionRows[] {
	if (!range) return sections;
	const inRange = (line: number) => line >= range.start && line < range.end;
	return sections.map(({ heading, rows, collapsed }) => ({
		heading: heading && !inRange(heading.line) ? heading : null,
		rows: rows.filter((row) => !inRange(firstLine(row))),
		collapsed,
	}));
}

export function itemRow(text: string, titleLine: number, now: Date, archiveDelayMs: number): ItemRow {
	const row = timelessItemRow(text, titleLine);
	return { ...row, archived: row.done && isArchived(text, now, archiveDelayMs) };
}

/** The fields of an item's row that don't depend on the time: all but `archived`. */
export function timelessItemRow(text: string, titleLine: number): Omit<ItemRow, 'archived'> {
	// parseList makes an item only of a line parseItemLine reads.
	const parts = parseItemLine(text) as ItemLineParts;
	const { plain, star } = splitStar(parts.title);
	const label = plain === '' ? (parts.end + parts.marks + parts.tail).trim() : plain;
	const { tags, tailTags } = itemTags(text);
	const done = isDoneStatus(parts.status);
	return { kind: 'item', titleLine, title: plain, label, done, starred: star !== '', when: whenOf(text), tags, tailTags, repeats: !done && repeatOf(text) !== null };
}

function firstLine(row: ListRow): number {
	return row.kind === 'item' ? row.titleLine : row.start;
}

// The heading's raw text: an ATX heading without its # runs, or a setext heading's lines up to its
// underline, joined with spaces as a soft line break renders. `headingLine` is a section's, so for a
// setext heading it is the first text line, past any link reference definitions. The first
// underline-shaped line below it is its underline: an earlier one would have ended the heading.
export function headingText(lines: readonly Line[], headingLine: number): string {
	const atx = splitAtx((lines[headingLine] as Line).text);
	if (atx) return atx.content;
	const texts: string[] = [];
	for (let i = headingLine; i < lines.length && !SETEXT_UNDERLINE.test((lines[i] as Line).text); i++) {
		texts.push((lines[i] as Line).text.trim());
	}
	return texts.join(' ');
}
