import { setItemTitle } from './edit-items';
import { parseItemLine } from './item-line';
import { spliceLines, type Line } from './lines';
import type { ItemBlock } from './parse';
import { keepStar } from './star';

/**
 * An item's title field while it has focus. `saved` is the title line as it was when the field took
 * focus, and `written` is the line the field last wrote.
 */
export interface TitleField {
	saved: string;
	written: string;
}

// A title is one line, and setItemTitle throws on a line break, so typed or pasted ones become spaces,
// as do the Unicode line and paragraph separators, which editors may show as line breaks.
export function oneLineTitle(typed: string): string {
	return typed.replace(/\r\n|\r|\n|\u2028|\u2029/g, ' ');
}

// A block field's typed title, with each run of white space that holds a line break as one space. Each
// run is matched once: `\s*\n\s*` would retry every start in a long run.
export function joinTypedLines(typed: string): string {
	return typed.replace(/\s+/g, (run) => (run.includes('\n') ? ' ' : run));
}

export function startTitleField(line: string): TitleField {
	return { saved: line, written: line };
}

// Each keystroke edits the saved line, not the current one: the current line holds what was typed so
// far, and parsing it would read a typed `#tag`, `📅 date` or ` ^id` as the tail and copy it again on
// every keystroke.
export function typeTitle(
	lines: readonly Line[],
	item: ItemBlock,
	field: TitleField,
	typed: string,
): { lines: Line[]; field: TitleField } {
	const { eol } = lines[item.titleLine] as Line;
	const withSaved = spliceLines(lines, item.titleLine, 1, [{ text: field.saved, eol }]);
	const savedTitle = parseItemLine(field.saved)?.title ?? '';
	const edited = setItemTitle(withSaved, item, keepStar(savedTitle, oneLineTitle(typed)));
	return { lines: edited, field: { saved: field.saved, written: (edited[item.titleLine] as Line).text } };
}

// The saved line changes only when something other than the field changed the line. A line that is
// still what the field wrote keeps the saved line, or the next keystroke would read the typed text as
// the line's own and copy its tail. One of the view's own edits, such as a tick, passes `retitle` and
// is made to the saved line too, for the same reason: in the ticked line, a typed `#tag` reads as the
// tail.
export function syncTitleField(field: TitleField, current: string, retitle?: (line: string) => string): TitleField {
	if (current === field.written) return field;
	return retitle ? { saved: retitle(field.saved), written: current } : startTitleField(current);
}
