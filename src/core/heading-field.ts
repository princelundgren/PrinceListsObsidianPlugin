import { headingText } from './display';
import { deleteHeading, setHeadingText } from './edit-headings';
import { ownEdit, type OwnEdit } from './follow';
import { mapLine } from './guard';
import { joinLines, splitLines, type Line } from './lines';
import { parseList, type ListModel, type Section } from './parse';

/** What the heading field opened on: the lines, its heading's line among them, and the heading's raw content. */
export interface HeadingFieldStart {
	lines: readonly Line[];
	line: number;
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

// Rename heading and a new heading's name (spec, "Item actions"). The heading's line is mapped from the
// lines the field opened on, so an outside change while it was open is allowed for, unless it changed
// that line.
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
	return { next, edit: ownEdit(found.line, text, next, 'delete') };
}

function findHeading(
	text: string,
	contentStart: number,
	field: HeadingFieldStart,
): { lines: Line[]; model: ListModel; section: Section; line: number } | null {
	const lines = splitLines(text);
	const line = mapLine(field.lines, lines, field.line);
	if (line === null) return null;
	const model = parseList(lines, contentStart);
	const section = model.sections.find((s) => s.headingLine === line);
	return section ? { lines, model, section, line } : null;
}
