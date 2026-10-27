import { isArchived } from './archive';
import { splitAtx } from './edit-headings';
import { getItemNotes } from './edit-items';
import { isDoneStatus, parseItemLine, type ItemLineParts } from './item-line';
import type { Line } from './lines';
import type { ItemBlock, ListModel } from './parse';
import { splitStar } from './star';
import { whenOf } from './when';

export interface ItemRow {
	kind: 'item';
	titleLine: number;
	title: string;
	/** The checkbox's accessible name: the title, or the rest of the line when the title is empty. */
	label: string;
	done: boolean;
	/** Done more than 24 hours ago, so hidden unless "Show archived" is on. */
	archived: boolean;
	starred: boolean;
	/** The item's When, `YYYY-MM-DD`, or null. */
	when: string | null;
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

export interface RowFilter {
	showArchived: boolean;
	/** What Cmd+F's field holds; '' filters nothing. */
	query: string;
	/** The open card's item, which shows whether or not it matches or its section is collapsed. */
	keepLine: number | null;
	/** The heading lines whose sections show only the heading while nothing filters the list. */
	collapsed: ReadonlySet<number>;
}

const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)[ \t]*$/;

// Every heading stays, even when all of its items are hidden, and so does content the plugin leaves
// alone, except while a query filters the list: then only the items that match show, and a heading
// only while one of its items does. A collapsed section shows only its heading, unless a query
// filters the list. Archived is worked out from `now` on each redraw, never written
// down (spec, "Done and archived").
export function visibleSections(lines: readonly Line[], model: ListModel, now: Date, filter: RowFilter): SectionRows[] {
	const filtering = filter.query !== '';
	return model.sections.map(({ headingLine, items }, i) => {
		const start = headingLine ?? model.contentStart;
		const end = model.sections[i + 1]?.headingLine ?? lines.length;
		const collapsed = headingLine !== null && filter.collapsed.has(headingLine);
		const shown: ListRow[] = items.flatMap((item) => {
			const row = itemRow((lines[item.titleLine] as Line).text, item.titleLine, now);
			if (!isShown(row, filter.showArchived)) return [];
			if (item.titleLine === filter.keepLine) return [row];
			if (filtering) return itemMatches(lines, item, row, filter.query) ? [row] : [];
			return collapsed ? [] : [row];
		});
		const heading = headingLine === null ? null : { line: headingLine, text: headingText(lines, headingLine) };
		if (filtering) return { heading: shown.length > 0 ? heading : null, rows: shown, collapsed };
		if (collapsed) return { heading, rows: shown, collapsed };
		for (const block of model.untouched) {
			if (block.start < start || block.start >= end) continue;
			const text = lines.slice(block.start, block.end).map((line) => line.text).join('\n');
			shown.push({ kind: 'untouched', start: block.start, text });
		}
		return { heading, rows: shown.sort((a, b) => firstLine(a) - firstLine(b)), collapsed };
	});
}

// As typed: no Unicode normalization, and Markdown matched as written.
export function matchesQuery(title: string, notes: string, query: string): boolean {
	const lowered = query.toLowerCase();
	return title.toLowerCase().includes(lowered) || notes.toLowerCase().includes(lowered);
}

function itemMatches(lines: readonly Line[], item: ItemBlock, row: ItemRow, query: string): boolean {
	return matchesQuery(row.title, getItemNotes(lines, item), query);
}

// A done item is hidden once it is archived, unless "Show archived" is on.
export function isShown(row: ItemRow, showArchived: boolean): boolean {
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

export function itemRow(text: string, titleLine: number, now: Date): ItemRow {
	// parseList makes an item only of a line parseItemLine reads.
	const parts = parseItemLine(text) as ItemLineParts;
	const { plain, star } = splitStar(parts.title);
	const label = plain === '' ? (parts.marks + parts.tail).trim() : plain;
	const done = isDoneStatus(parts.status);
	return { kind: 'item', titleLine, title: plain, label, done, archived: done && isArchived(text, now), starred: star !== '', when: whenOf(text) };
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
