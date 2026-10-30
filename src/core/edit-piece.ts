import { blockKey } from './edit-check';
import { mapRange, type LineRange } from './follow';
import type { Line } from './lines';
import { isBlank, type ItemBlock } from './parse';

/** The item's block, as replaceRun names it, before and after lines [from, to) become `run`. */
export function itemNotesKeys(
	lines: readonly Line[],
	item: ItemBlock,
	from: number,
	to: number,
	run: readonly string[],
): { removed: string[]; added: string[] } {
	const before = lines.slice(item.titleLine, item.endLine).map((line) => line.text);
	const after = lines.slice(item.titleLine, Math.max(item.endLine, to)).map((line) => line.text);
	after.splice(from - item.titleLine, to - from, ...run);
	while (after.length > 1 && isBlank(after[after.length - 1] as string)) after.pop();
	return { removed: [blockKey('item', before)], added: [blockKey('item', after)] };
}

// After an outside change: a visit's lines where it put them, or null when it changed any of them.
export function mapPieceRange(oldLines: readonly Line[], newLines: readonly Line[], range: LineRange): LineRange | null {
	const mapped = mapRange(oldLines, newLines, range);
	if (!mapped || mapped.end - mapped.start !== range.end - range.start) return null;
	const isKept = newLines.slice(mapped.start, mapped.end).every((line, i) => line.text === oldLines[range.start + i]?.text);
	return isKept ? mapped : null;
}
