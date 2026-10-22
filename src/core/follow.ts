import { mapLine } from './guard';
import { splitLines, type Line } from './lines';

export interface LineRange {
	start: number;
	end: number;
}

/**
 * One of the view's own edits, as the view learns it from the edit it called: the run starts at the
 * item's `titleLine`, the section's `headingLine`, the list note's `start`, or the line an insert
 * returns. `delta` is the change in the number of lines.
 */
export interface OwnEdit {
	start: number;
	delta: number;
	/**
	 * A `change` keeps the line at `start`, such as the item being typed in; an `insert` puts new
	 * lines before it; a `delete` removes it.
	 */
	kind: 'change' | 'insert' | 'delete';
	/**
	 * For an edit of the item line at `start`, such as a tick: the same edit as a function of the
	 * line, so a title field can make it to the line it saved (see syncTitleField).
	 */
	retitle?: (line: string) => string;
}

// A write that moves no line. It starts past every line, so it leaves the list note's range too.
export const NO_LINES_MOVED: OwnEdit = { start: Number.POSITIVE_INFINITY, delta: 0, kind: 'change' };

export function ownEdit(start: number, before: string, after: string, kind: OwnEdit['kind']): OwnEdit {
	return { start, delta: splitLines(after).length - splitLines(before).length, kind };
}

// For the view's own edits only. mapLine, for outside changes, compares lines by text, so it can't
// tell two empty new items apart.
export function followLine(line: number, edit: OwnEdit): number | null {
	if (line < edit.start) return line;
	if (line === edit.start && edit.kind === 'change') return line;
	if (line === edit.start && edit.kind === 'delete') return null;
	return line + edit.delta;
}

// The list note's range comes first in the file, so every edit but its own saves starts at or after
// its end. One that starts inside it can't be followed, and the editor reads the note again.
export function followRange(range: LineRange, edit: OwnEdit): LineRange | null {
	return edit.start >= range.end ? range : null;
}

// After an outside change: the range's first and last lines, mapped. An empty range is a position
// rather than a line, so it follows the line before it: the line at its start is the first item's, and
// an item added above that one goes after the note.
export function mapRange(oldLines: readonly Line[], newLines: readonly Line[], range: LineRange): LineRange | null {
	if (range.start === range.end) {
		if (range.start === 0) return range;
		const before = mapLine(oldLines, newLines, range.start - 1);
		return before === null ? null : { start: before + 1, end: before + 1 };
	}
	const start = mapLine(oldLines, newLines, range.start);
	const last = mapLine(oldLines, newLines, range.end - 1);
	return start === null || last === null ? null : { start, end: last + 1 };
}
