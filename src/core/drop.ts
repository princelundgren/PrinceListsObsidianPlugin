import type { ItemPlace } from './list-actions';

/** A row or heading the view shows, by its first line. Hidden rows aren't shown. */
export interface ShownRow {
	line: number;
	kind: 'heading' | 'item' | 'untouched';
}

/** Where a dragged item goes, and the row or heading the drop line shows under, or above when `above`. */
export interface Drop {
	place: ItemPlace;
	line: number;
	above: boolean;
}

// The drop for the pointer over the shown row or heading on `over.line`: below it in its lower half,
// above it otherwise. `shown` is in the order the view shows it. null when the item would stay where
// it shows, or when the line or the item isn't shown.
export function dropAt(shown: readonly ShownRow[], dragged: number, over: { line: number; below: boolean }): Drop | null {
	const at = shown.findIndex((row) => row.line === over.line);
	const from = shown.findIndex((row) => row.kind === 'item' && row.line === dragged);
	if (at === -1 || from === -1) return null;
	const drop = dropAbove(shown, over.below ? at + 1 : at);
	const here = dropAbove(shown, from);
	const stays = (drop.line === dragged && !drop.above) || (drop.line === here.line && drop.above === here.above);
	return stays ? null : drop;
}

/** Where a dragged section goes: before the heading on `before`, or to the end when null. */
export interface SectionDrop {
	before: number | null;
	line: number;
	above: boolean;
}

// The drop for a dragged heading, over the shown row on `over.line` as dropAt reads it. The section
// goes before the first heading shown at or after the gap, so never above the items before the first
// heading, or to the end, with the drop line under the last row. null when it would stay where it is.
export function sectionDropAt(shown: readonly ShownRow[], dragged: number, over: { line: number; below: boolean }): SectionDrop | null {
	const at = shown.findIndex((row) => row.line === over.line);
	const from = shown.findIndex((row) => row.kind === 'heading' && row.line === dragged);
	if (at === -1 || from === -1) return null;
	const headingFrom = (gap: number) => shown.slice(gap).find((row) => row.kind === 'heading') ?? null;
	const before = headingFrom(over.below ? at + 1 : at);
	const next = headingFrom(from + 1);
	if (before?.line === dragged || before?.line === next?.line) return null;
	if (before) return { before: before.line, line: before.line, above: true };
	return { before: null, line: (shown[shown.length - 1] as ShownRow).line, above: false };
}

// The drop for the gap before shown[gap]: after the nearest item above it, or first under the nearest
// heading. A move changes only the order of items, so an untouched row between doesn't count.
function dropAbove(shown: readonly ShownRow[], gap: number): Drop {
	for (let i = gap - 1; i >= 0; i--) {
		const row = shown[i] as ShownRow;
		if (row.kind === 'item') return { place: { after: row.line }, line: row.line, above: false };
		if (row.kind === 'heading') return { place: { firstUnder: row.line }, line: row.line, above: false };
	}
	return { place: 'first', line: (shown[0] as ShownRow).line, above: true };
}
