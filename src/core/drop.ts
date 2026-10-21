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
