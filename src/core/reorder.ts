import { blockKeys, modelBlockKeys, sameBlocks, UnsafeEditError } from './edit-check';
import { isBlankAt } from './edit-lines';
import { dominantEol, spliceLines, type Line } from './lines';
import type { ListModel } from './parse';

// The lines in `order`, every one of them kept, with an empty line at each place where two lines that
// weren't neighbors meet and a block no longer parses as it did. `moved[i]` is the line that line `i`
// went to, or null for an empty line dropped from the end (spliceLines). Throws UnsafeEditError when
// empty lines don't keep the blocks as they were.
export function reorderChecked(
	lines: readonly Line[],
	model: ListModel,
	order: readonly number[],
): { lines: Line[]; moved: (number | null)[] } {
	const reordered = order.map((i) => lines[i] as Line);
	const before = modelBlockKeys(lines, model).map((b) => b.key);
	// A move keeps every line, so the boundaries it makes are where two non-blank lines that weren't
	// neighbors meet. Each index is that of the lower line in `reordered`.
	const boundaries = order.flatMap((was, at) =>
		at > 0 && was !== (order[at - 1] as number) + 1 && !isBlankAt(reordered, at - 1) && !isBlankAt(reordered, at) ? [at] : [],
	);
	const eol = dominantEol(lines);
	const separated = (blankAt: ReadonlySet<number>) =>
		spliceLines(
			lines,
			0,
			lines.length,
			reordered.flatMap((line, at) => (blankAt.has(at) ? [{ text: '', eol }, line] : [line])),
		);
	// An empty line goes at each boundary inside a block that no longer parses as it did, pass after
	// pass, since one can uncover the next join.
	const blankAt = new Set<number>();
	for (let pass = 0; pass <= boundaries.length; pass++) {
		const result = separated(blankAt);
		const after = blockKeys(result, model.contentStart);
		if (sameBlocks(after, before)) return { lines: result, moved: newIndexes(order, blankAt, result.length) };
		const changed = surplus(after, before);
		const shifted = (at: number) => at + [...blankAt].filter((b) => b <= at).length;
		const next = boundaries.filter((at) => !blankAt.has(at) && changed.some((b) => b.start < shifted(at) && shifted(at) < b.end));
		if (next.length === 0) break;
		for (const at of next) blankAt.add(at);
	}
	// A definition belongs to no block, so a join with one, or a block that vanishes into one, points
	// at no boundary. An empty line at every boundary covers those.
	const everyBoundary = new Set(boundaries);
	const result = separated(everyBoundary);
	if (sameBlocks(blockKeys(result, model.contentStart), before)) {
		return { lines: result, moved: newIndexes(order, everyBoundary, result.length) };
	}
	throw new UnsafeEditError();
}

// The blocks of `after` whose type and source text `before` has fewer of. All copies count, since a
// changed block can match one that was there all along.
function surplus<T extends { key: string }>(after: T[], before: readonly string[]): T[] {
	const count = new Map<string, number>();
	for (const key of before) count.set(key, (count.get(key) ?? 0) + 1);
	for (const { key } of after) count.set(key, (count.get(key) ?? 0) - 1);
	return after.filter(({ key }) => (count.get(key) as number) < 0);
}

// The line each line went to: its place in `order`, plus the empty lines written before it. Only
// empty lines at the end are dropped, so a place at or past `count` is one of them.
function newIndexes(order: readonly number[], blankAt: ReadonlySet<number>, count: number): (number | null)[] {
	const moved: (number | null)[] = [];
	let blanks = 0;
	order.forEach((was, at) => {
		if (blankAt.has(at)) blanks++;
		moved[was] = at + blanks < count ? at + blanks : null;
	});
	return moved;
}

export function range(start: number, end: number): number[] {
	return Array.from({ length: end - start }, (_, i) => start + i);
}
