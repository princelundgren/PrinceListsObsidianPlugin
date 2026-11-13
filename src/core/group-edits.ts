import { RepeatingItemError } from './edit-items';
import { headingText } from './display';
import { followLine, moveEdit, type OwnEdit } from './follow';
import type { PlannedGroupEdit } from './group-actions';
import { isDoneStatus, isRepeating, parseItemLine, tickLine, untickLine } from './item-line';
import { joinLines, splitLines } from './lines';
import { planHeadingDelete, planItemDelete } from './list-actions';
import { itemAt, parseList, type ListModel } from './parse';
import { isStarred } from './star';
import { whenOf } from './when';

export interface PlannedGroupChange extends PlannedGroupEdit {
	/** The items whose line changed. */
	changed: number;
	/** The repeating items a tick left as they were. */
	skipped: number;
}

/** What a selection holds, for a menu to offer only the actions that change something. */
export interface GroupState {
	items: number;
	headings: number;
	anyUnticked: boolean;
	anyTicked: boolean;
	anyUnstarred: boolean;
	anyStarred: boolean;
	anyDated: boolean;
}

/** A place a group of rows can move to: under the heading on `headingLine`, or the top when null. */
export interface HeadingChoice {
	label: string;
	headingLine: number | null;
}

/** Counts the items and headings in `rows`; a row that is neither counts for nothing. */
export function groupState(text: string, contentStart: number, rows: readonly number[]): GroupState {
	const lines = splitLines(text);
	const model = parseList(lines, contentStart);
	const state: GroupState = {
		items: 0,
		headings: 0,
		anyUnticked: false,
		anyTicked: false,
		anyUnstarred: false,
		anyStarred: false,
		anyDated: false,
	};
	for (const row of new Set(rows)) {
		if (isHeading(model, row)) {
			state.headings++;
			continue;
		}
		const line = lines[row]?.text;
		const parts = line !== undefined && itemAt(model, row) ? parseItemLine(line) : null;
		if (line === undefined || !parts) continue;
		state.items++;
		if (isDoneStatus(parts.status)) state.anyTicked = true;
		else state.anyUnticked = true;
		if (isStarred(line)) state.anyStarred = true;
		else state.anyUnstarred = true;
		if (whenOf(line) !== null) state.anyDated = true;
	}
	return state;
}

/**
 * Applies `change` to the title line of each item on `rows` in one write; headings are skipped. The
 * edit changes lines without adding or removing any. Returns null when a row is neither an item nor
 * a heading, or when no line changes.
 */
export function planGroupLineEdit(
	text: string,
	contentStart: number,
	rows: readonly number[],
	change: (line: string) => string,
): PlannedGroupChange | null {
	const lines = splitLines(text);
	const model = parseList(lines, contentStart);
	const ordered = [...new Set(rows)].sort((a, b) => a - b);
	const next = lines.slice();
	let changed = 0;
	let first = -1;
	for (const row of ordered) {
		const own = lines[row];
		if (own && isHeading(model, row)) continue;
		if (!own || !itemAt(model, row)) return null;
		const edited = change(own.text);
		if (edited === own.text) continue;
		next[row] = { text: edited, eol: own.eol };
		changed++;
		if (first === -1) first = row;
	}
	if (changed === 0) return null;
	return { next: joinLines(next), edit: { start: first, delta: 0, kind: 'change' }, changed, skipped: 0 };
}

/**
 * Ticks (`done`) or unticks the items on `rows` in one write. A repeating item is left as it is and
 * counted in `skipped`; throws RepeatingItemError when every item the tick would change repeats.
 * Returns null when nothing changes.
 */
export function planGroupTick(text: string, contentStart: number, rows: readonly number[], done: boolean, now: Date): PlannedGroupChange | null {
	let skipped = 0;
	const plan = planGroupLineEdit(text, contentStart, rows, (line) => {
		const parts = parseItemLine(line);
		if (!parts || isDoneStatus(parts.status) === done) return line;
		if (!done) return untickLine(line);
		if (isRepeating(line)) {
			skipped++;
			return line;
		}
		return tickLine(line, now);
	});
	if (!plan && skipped > 0) throw new RepeatingItemError('rule');
	return plan && { ...plan, skipped };
}

/**
 * Deletes the items and headings on `rows` in one write. A deleted heading's items join the section
 * above, as the single delete does them. The edit maps every line to where it went, or to null, so
 * history inverts it. Returns null when a row is gone.
 */
export function planGroupDelete(text: string, contentStart: number, rows: readonly number[]): PlannedGroupEdit | null {
	const ordered = [...new Set(rows)].sort((a, b) => b - a);
	if (ordered.length === 0) return null;
	let running = text;
	let where: (number | null)[] = splitLines(text).map((_, line) => line);
	// From the bottom up, so a delete leaves the rows above it where they are.
	for (const row of ordered) {
		const at = where[row] ?? null;
		if (at === null) return null;
		const step = planItemDelete(running, contentStart, at) ?? planHeadingDelete(running, contentStart, at);
		if (!step) return null;
		running = step.next;
		where = where.map((line) => (line === null ? null : afterDelete(line, step.edit)));
	}
	return { next: running, edit: moveEdit(where) };
}

/** The destinations for a move: the top of the list, then each heading, told apart when they read alike. */
export function headingChoices(text: string, contentStart: number): HeadingChoice[] {
	const lines = splitLines(text);
	const headings = parseList(lines, contentStart).sections.flatMap((section) =>
		section.headingLine === null ? [] : [{ line: section.headingLine, name: headingText(lines, section.headingLine) }],
	);
	const choices = headings.map(({ line, name }) => {
		const same = headings.filter((other) => other.name === name);
		const label = same.length > 1 ? `${name}, ${same.findIndex((other) => other.line === line) + 1} of ${same.length}` : name;
		return { label, headingLine: line };
	});
	return [{ label: 'Top of the list', headingLine: null }, ...choices];
}

/** "5 items", "4 items and 1 heading", "2 headings". */
export function countPhrase(items: number, headings: number): string {
	const part = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;
	if (headings === 0) return part(items, 'item');
	return items === 0 ? part(headings, 'heading') : `${part(items, 'item')} and ${part(headings, 'heading')}`;
}

function isHeading(model: ListModel, line: number): boolean {
	return model.sections.some((section) => section.headingLine === line);
}

// A delete removes the run of lines from its start; followLine alone keeps the rest of the run.
function afterDelete(line: number, edit: OwnEdit): number | null {
	if (edit.kind === 'delete' && line >= edit.start && line < edit.start - edit.delta) return null;
	return followLine(line, edit);
}
