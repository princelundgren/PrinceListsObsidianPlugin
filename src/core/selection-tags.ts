import { headingText } from './display';
import { moveEdit } from './follow';
import type { PlannedGroupEdit } from './group-actions';
import { isHeading } from './group-edits';
import type { TagChange } from './group-menu';
import { headingEndTags, planHeadingTag } from './heading-tags';
import { itemTags } from './item-tags';
import { joinLines, splitLines, type Line } from './lines';
import { itemAt, parseList, type ListModel } from './parse';
import { addTag, removeTag } from './tag-edit';
import { sameTag } from './tags';

/** What the selected rows say about tags, for the tag popover. */
export interface SelectionTags {
	/** The items and headings among the selected rows. */
	total: number;
	/** The items' tail tags and the headings' end tags, each with the number of rows that carry it. */
	chips: { tag: string; count: number }[];
}

/** A tag change on several rows, with the items and headings whose text it changed. */
export interface PlannedGroupTag extends PlannedGroupEdit {
	items: number;
	headings: number;
}

/**
 * Works out the tags of the items and headings on `rows`: an item's tail tags, a heading's end tags;
 * other rows count for nothing. Tags that differ only in letter case are one chip, spelled as `order`
 * spells it; chips follow `order`, then the tags it lacks in the order of the rows, spelled as the
 * first row with the tag spells it.
 */
export function selectionTags(text: string, contentStart: number, rows: readonly number[], order: readonly string[]): SelectionTags {
	const lines = splitLines(text);
	const model = parseList(lines, contentStart);
	const perRow = [...new Set(rows)].sort((a, b) => a - b).flatMap((row) => {
		if (isHeading(model, row)) return [headingEndTags(headingText(lines, row))];
		return itemAt(model, row) ? [itemTags(lines[row]?.text ?? '').tailTags] : [];
	});

	const found: { tag: string; count: number }[] = [];
	for (const tags of perRow) {
		for (const tag of tags) {
			const chip = found.find((candidate) => sameTag(candidate.tag, tag));
			if (chip) chip.count++;
			else found.push({ tag, count: 1 });
		}
	}
	const ordered = order.flatMap((tag) => found.filter((chip) => sameTag(chip.tag, tag)).map((chip) => ({ ...chip, tag })));
	const rest = found.filter((chip) => !order.some((tag) => sameTag(tag, chip.tag)));

	return { total: perRow.length, chips: [...ordered, ...rest] };
}

/**
 * Adds `tag` to, or removes it from, each item and heading on `rows` in one write: an item's tail as
 * the item's Tag does it, a heading's text as its Tag… does it. A heading Tag… would refuse is left as
 * it is. Returns null when a row is neither an item nor a heading, or when nothing changes.
 */
export function planGroupTag(text: string, contentStart: number, rows: readonly number[], change: TagChange, tag: string): PlannedGroupTag | null {
	const model = parseList(splitLines(text), contentStart);
	// From the bottom up, so a heading whose text joins onto one line leaves the rows above it where they are.
	const ordered = [...new Set(rows)].sort((a, b) => b - a);
	if (!allTaggable(model, ordered)) return null;
	let lines: Line[] = splitLines(text);
	let where: (number | null)[] = lines.map((_, line) => line);
	let items = 0;
	let headings = 0;
	let topChanged = -1;
	for (const row of ordered) {
		if (isHeading(model, row)) {
			const save = planHeadingTag(joinLines(lines), contentStart, row, change, tag);
			if (save.kind !== 'write') continue;
			const next = splitLines(save.next);
			const joined = lines.length - next.length;
			where = where.map((line) => (line === null || line <= row ? line : line <= row + joined ? null : line - joined));
			lines = next;
			headings++;
		} else {
			const own = lines[row] as Line;
			const edited = change === 'addTag' ? addTag(own.text, tag) : removeTag(own.text, tag);
			if (edited === own.text) continue;
			lines = lines.slice();
			lines[row] = { text: edited, eol: own.eol };
			items++;
		}
		topChanged = row;
	}
	if (topChanged === -1) return null;
	const moved = where.some((to, from) => to !== from);
	return { next: joinLines(lines), edit: moved ? moveEdit(where) : { start: topChanged, delta: 0, kind: 'change' }, items, headings };
}

/**
 * Whether Tag… refusing a heading on `rows` is why planGroupTag returns null for them in `text`:
 * every row is an item or a heading, and Tag… would refuse the change for one of the headings.
 */
export function anyHeadingRefused(text: string, contentStart: number, rows: readonly number[], change: TagChange, tag: string): boolean {
	if (!allTaggable(parseList(splitLines(text), contentStart), rows)) return false;
	return rows.some((row) => planHeadingTag(text, contentStart, row, change, tag).kind === 'refused');
}

function allTaggable(model: ListModel, rows: readonly number[]): boolean {
	return rows.every((row) => isHeading(model, row) || itemAt(model, row) !== undefined);
}
