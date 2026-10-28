import { mapLine } from './guard';
import { splitLines, type Line } from './lines';

export interface LineRange {
	start: number;
	end: number;
}

/** One of the view's own edits, which the line-based state follows. */
export type OwnEdit = RunEdit | MoveEdit;

/**
 * How an edit stands to the undo history: `new` adds an empty item or heading, whose first typing or
 * name joins its step; `cancel` removes one again; `undo` and `redo` step through the history. An
 * edit without one is an ordinary action.
 */
export type HistoryMark = 'new' | 'cancel' | 'undo' | 'redo';

/**
 * An edit of one run of lines, as the view learns it from the edit it called: the run starts at the
 * item's `titleLine`, the section's `headingLine`, the list note's `start`, or the line an insert
 * returns. `delta` is the change in the number of lines.
 */
export interface RunEdit {
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
	history?: HistoryMark;
}

/**
 * A drag's move, which changes lines in two places: `moved[i]` is the line that line `i` went to, or
 * null for an empty line it dropped, and `start` is the first line that moved.
 */
export interface MoveEdit {
	start: number;
	kind: 'move';
	moved: readonly (number | null)[];
	history?: HistoryMark;
}

// A write that moves no line. It starts past every line, so it leaves the list note's range too.
export const NO_LINES_MOVED: RunEdit = { start: Number.POSITIVE_INFINITY, delta: 0, kind: 'change' };

export function ownEdit(start: number, before: string, after: string, kind: RunEdit['kind']): RunEdit {
	return { start, delta: splitLines(after).length - splitLines(before).length, kind };
}

export function moveEdit(moved: readonly (number | null)[]): MoveEdit {
	const start = moved.findIndex((to, from) => to !== from);
	return { start: start === -1 ? Number.POSITIVE_INFINITY : start, kind: 'move', moved };
}

// For the view's own edits only. mapLine, for outside changes, compares lines by text, so it can't
// tell two empty new items apart.
export function followLine(line: number, edit: OwnEdit): number | null {
	if (edit.kind === 'move') return edit.moved[line] ?? null;
	if (line < edit.start) return line;
	if (line === edit.start && edit.kind === 'change') return line;
	if (line === edit.start && edit.kind === 'delete') return null;
	return line + edit.delta;
}

// The lines an edit replaces: a change its `start` line, a delete the lines it removed from `start`,
// an insert none. Only an edit that replaces a line of the range loses it. A change that adds or
// removes lines, a notes save or its undo, rewrote a run whose end it doesn't give.
export function followRange(range: LineRange, edit: OwnEdit): LineRange | null {
	if (edit.kind === 'move') return moveRange(range, edit.moved);
	if (edit.start >= range.end) return range;
	if (edit.kind === 'change' && edit.delta !== 0) return null;
	const coverEnd = edit.kind === 'change' ? edit.start + 1 : edit.kind === 'delete' ? edit.start - edit.delta : edit.start;
	return coverEnd <= range.start ? { start: range.start + edit.delta, end: range.end + edit.delta } : null;
}

// An empty range is a position, so it goes with the line before it.
function moveRange(range: LineRange, moved: readonly (number | null)[]): LineRange | null {
	if (range.start === range.end) {
		if (range.start === 0) return range;
		const before = moved[range.start - 1] ?? null;
		return before === null ? null : { start: before + 1, end: before + 1 };
	}
	const start = moved[range.start] ?? null;
	const last = moved[range.end - 1] ?? null;
	if (start === null || last === null || last - start !== range.end - 1 - range.start) return null;
	return { start, end: last + 1 };
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
