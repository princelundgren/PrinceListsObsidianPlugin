import { followLine, moveEdit, type OwnEdit } from './follow';
import { joinLines, splitLines } from './lines';
import { endOfSection, planItemMove, planSectionMove, type ItemPlace, type PlannedMove } from './list-actions';
import { itemAt, parseList, type ItemBlock, type ListModel, type Section } from './parse';
import { reorderChecked } from './reorder';

export interface PlannedGroupEdit {
	next: string;
	edit: OwnEdit;
}

/**
 * Where a group of rows goes: an item place; before the section whose heading is on a line, or at the
 * end when null; or after the last item of the section whose heading is on a line, or of the part
 * before the first heading when null.
 */
export type GroupPlace = ItemPlace | { beforeSection: number | null } | { endOf: number | null };

interface Group {
	/** Selected items outside every selected section, in file order. */
	items: ItemBlock[];
	/** Selected headings' sections, in file order. */
	sections: Section[];
}

/** Where the loose items go, and the section that place is in, which never moves. */
interface Landing {
	place: ItemPlace;
	section: Section;
}

/**
 * Moves the rows on `rows`, item title lines and heading lines in any order, to `place` in one write:
 * the loose items in file order, then the sections in file order, each section with its items. A
 * place on a moving row resolves to the nearest one around the group that isn't moving. Returns null
 * when a row or the place is gone, or when nothing would change; throws UnsafeEditError when the
 * rest of the list wouldn't read as it did, as the single moves do.
 */
export function planGroupMove(text: string, contentStart: number, rows: readonly number[], place: GroupPlace): PlannedGroupEdit | null {
	const lines = splitLines(text);
	const model = parseList(lines, contentStart);
	const group = groupOf(model, rows);
	const landing = group && landingOf(model, group, place);
	if (!group || !landing) return null;
	const edits = steps(text, contentStart, model, group, landing);
	if (edits.length === 0) return null;
	// The steps only decide the order. One reorder of the original lines adds an empty line only where
	// the final arrangement needs one, where a step alone may have needed one the next step undid.
	const ends = lines.map((_, line) => followAll(line, edits));
	const kept = lines.map((_, line) => line).filter((line) => ends[line] !== null);
	kept.sort((a, b) => (ends[a] as number) - (ends[b] as number));
	// Only empty lines a step dropped from the end go nowhere; last again, the reorder drops them too.
	const dropped = lines.map((_, line) => line).filter((line) => ends[line] === null);
	const moved = reorderChecked(lines, model, [...kept, ...dropped]);
	const next = joinLines(moved.lines);
	return next === text ? null : { next, edit: moveEdit(moved.moved) };
}

/**
 * What a group move of the rows on `rows` names in its message: the selected headings, and the
 * selected items outside their sections, which come with them. A row that is neither counts for nothing.
 */
export function groupCount(text: string, contentStart: number, rows: readonly number[]): { items: number; headings: number } {
	const group = carried(parseList(splitLines(text), contentStart), rows);
	return { items: group.items.length, headings: group.sections.length };
}

/**
 * The heading of the section a group move of the rows on `rows` to `place` puts its loose items in,
 * which a collapsed list opens to show them. null with no loose items, when they land before the
 * first heading, or when a row or the place is gone.
 */
export function landingHeading(text: string, contentStart: number, rows: readonly number[], place: GroupPlace): number | null {
	const model = parseList(splitLines(text), contentStart);
	const group = groupOf(model, rows);
	if (!group || group.items.length === 0) return null;
	return landingOf(model, group, place)?.section.headingLine ?? null;
}

function groupOf(model: ListModel, rows: readonly number[]): Group | null {
	const unique = [...new Set(rows)];
	if (unique.length === 0 || unique.some((row) => !sectionAt(model, row) && !itemAt(model, row))) return null;
	return carried(model, unique);
}

// The rows that are headings or items, the items in a selected section left out.
function carried(model: ListModel, rows: readonly number[]): Group {
	const sections: Section[] = [];
	const items: ItemBlock[] = [];
	for (const row of new Set(rows)) {
		const section = sectionAt(model, row);
		const item = itemAt(model, row);
		if (section) sections.push(section);
		else if (item) items.push(item);
	}
	const loose = items.filter((item) => !sections.includes(sectionOf(model, item)));
	return {
		items: loose.sort((a, b) => a.titleLine - b.titleLine),
		sections: sections.sort((a, b) => (a.headingLine as number) - (b.headingLine as number)),
	};
}

function landingOf(model: ListModel, group: Group, place: GroupPlace): Landing | null {
	if (place === 'first') return { place, section: model.sections[0] as Section };
	if ('after' in place) {
		const item = itemAt(model, place.after);
		return item ? stillPlaceFrom(model, group, sectionOf(model, item), item) : null;
	}
	if ('firstUnder' in place) {
		const section = sectionAt(model, place.firstUnder);
		return section ? stillPlaceFrom(model, group, section, null) : null;
	}
	const headingLine = 'beforeSection' in place ? place.beforeSection : place.endOf;
	const named = headingLine === null ? null : sectionAt(model, headingLine);
	if (named === undefined) return null;
	const heading = named && stillSectionFrom(model, group, model.sections.indexOf(named));
	if ('endOf' in place) {
		const section = heading ?? (model.sections[0] as Section);
		return { place: endOfSection(section), section };
	}
	const section = stillSectionBefore(model, group, heading ? model.sections.indexOf(heading) : model.sections.length);
	return { place: endOfSection(section), section };
}

// The nearest item place at or above `from` in its section that isn't moving: after an item, first
// under its heading, first in the list, or, when its heading moves too, the end of the section above.
function stillPlaceFrom(model: ListModel, group: Group, section: Section, from: ItemBlock | null): Landing {
	const above = section.items.slice(0, from ? section.items.indexOf(from) + 1 : 0);
	const item = above.reverse().find((candidate) => !group.items.includes(candidate));
	const moves = group.sections.includes(section);
	if (item && !moves) return { place: { after: item.titleLine }, section };
	if (section.headingLine === null) return { place: 'first', section };
	if (!moves) return { place: { firstUnder: section.headingLine }, section };
	const still = stillSectionBefore(model, group, model.sections.indexOf(section));
	return { place: endOfSection(still), section: still };
}

// The first section from `index` on that isn't moving, or null.
function stillSectionFrom(model: ListModel, group: Group, index: number): Section | null {
	return model.sections.slice(index).find((section) => !group.sections.includes(section)) ?? null;
}

// The last section before `index` that isn't moving. The part before the first heading never moves.
function stillSectionBefore(model: ListModel, group: Group, index: number): Section {
	return model.sections
		.slice(0, index)
		.reverse()
		.find((section) => !group.sections.includes(section)) as Section;
}

// Each loose item after the one before it, the first to the landing place; then each section before
// the first heading after the landing section that isn't moving. A step that changes nothing is skipped.
function steps(text: string, contentStart: number, model: ListModel, group: Group, landing: Landing): OwnEdit[] {
	const edits: OwnEdit[] = [];
	let running = text;
	const now = (line: number) => followAll(line, edits) as number;
	const take = (step: PlannedMove | null) => {
		if (!step) return;
		running = step.next;
		edits.push(step.edit);
	};
	let place = landing.place;
	for (const item of group.items) {
		take(planItemMove(running, contentStart, now(item.titleLine), placeNow(place, now)));
		place = { after: item.titleLine };
	}
	const before = stillSectionFrom(model, group, model.sections.indexOf(landing.section) + 1)?.headingLine ?? null;
	for (const section of group.sections) {
		take(planSectionMove(running, contentStart, now(section.headingLine as number), before === null ? null : now(before)));
	}
	return edits;
}

function placeNow(place: ItemPlace, now: (line: number) => number): ItemPlace {
	if (place === 'first') return place;
	return 'after' in place ? { after: now(place.after) } : { firstUnder: now(place.firstUnder) };
}

function followAll(line: number, edits: readonly OwnEdit[]): number | null {
	return edits.reduce<number | null>((at, edit) => (at === null ? null : followLine(at, edit)), line);
}

function sectionAt(model: ListModel, headingLine: number): Section | undefined {
	return model.sections.find((section) => section.headingLine === headingLine);
}

function sectionOf(model: ListModel, item: ItemBlock): Section {
	return model.sections.find((section) => section.items.includes(item)) as Section;
}
