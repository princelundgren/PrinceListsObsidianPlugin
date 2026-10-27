import { headingText } from './display';
import { deleteHeading, setHeadingText } from './edit-headings';
import type { TrackedLine } from './editing';
import { ownEdit, type OwnEdit } from './follow';
import { joinLines, splitLines, type Line } from './lines';
import { parseList, type ListModel, type Section } from './parse';

/** The heading field: its heading's line, tracked since the field opened, and the heading's raw content then. */
export interface HeadingFieldStart {
	heading: TrackedLine;
	before: string;
}

/**
 * What saving the typed name does. `none`: the name is empty or unchanged. `lost`: the heading can't be
 * found. `refused`: the name wouldn't come back as this heading, at its level and with exactly that
 * text. `write`: `line` is where the heading is in `next`.
 */
export type HeadingSave =
	| { kind: 'none' }
	| { kind: 'lost' }
	| { kind: 'refused' }
	| { kind: 'write'; next: string; line: number; edit: OwnEdit };

// Rename heading and a new heading's name (spec, "Item actions"). The heading's line follows the view's
// own edits and each outside change while the field is open, so those are allowed for, unless one
// changed that line.
export function saveHeadingName(text: string, contentStart: number, field: HeadingFieldStart, typed: string): HeadingSave {
	const name = typed.trim();
	if (name === '' || name === field.before) return { kind: 'none' };
	const found = findHeading(text, contentStart, field);
	if (!found) return { kind: 'lost' };
	const edited = setHeadingText(found.lines, found.model, found.section, name);
	// A setext heading named `===` parses as itself, but reads back as an empty heading.
	if (!edited || headingText(edited, found.line) !== name) return { kind: 'refused' };
	const next = joinLines(edited);
	return { kind: 'write', next, line: found.line, edit: ownEdit(found.line, text, next, 'change') };
}

// A new heading's field closed without a name, so the heading goes again: a cancel, not a delete. null
// when it can't be found or has a name now. Throws UnsafeEditError as deleteHeading does.
export function planHeadingRemoval(text: string, contentStart: number, field: HeadingFieldStart): { next: string; edit: OwnEdit } | null {
	const found = findHeading(text, contentStart, field);
	if (!found || headingText(found.lines, found.line) !== '') return null;
	const next = joinLines(deleteHeading(found.lines, found.model, found.section));
	return { next, edit: { ...ownEdit(found.line, text, next, 'delete'), history: 'cancel' } };
}

function findHeading(
	text: string,
	contentStart: number,
	field: HeadingFieldStart,
): { lines: Line[]; model: ListModel; section: Section; line: number } | null {
	const line = field.heading.line;
	if (line === null) return null;
	const lines = splitLines(text);
	const model = parseList(lines, contentStart);
	const section = model.sections.find((s) => s.headingLine === line);
	return section ? { lines, model, section, line } : null;
}
