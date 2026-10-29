import { replaceRun } from './edit-check';
import { stripIndent } from './edit-items';
import { isBlankAt } from './edit-lines';
import { listNoteAround, noteText, replaceListNoteRun, writesBlankAfter } from './edit-list-note';
import { itemNotesKeys } from './edit-piece';
import type { LineRange } from './follow';
import { dominantEol, type Line } from './lines';
import { columnOf, isBlank, type ItemBlock, type ListModel } from './parse';

/**
 * Lines [from, to) of the notes, as the editor held them before the change, become `lines`.
 * `from === to` inserts; an empty `lines` deletes.
 */
export interface NotesChange {
	from: number;
	to: number;
	lines: string[];
}

/**
 * The shortest run of whole lines that differs between two texts: the lines between those they
 * share at their start and those they share at their end, which never overlap. null when the texts
 * are equal.
 */
export function changedLines(before: string, after: string): NotesChange | null {
	if (before === after) return null;
	const old = before.split('\n');
	const now = after.split('\n');
	const shorter = Math.min(old.length, now.length);
	let start = 0;
	while (start < shorter && old[start] === now[start]) start++;
	let end = 0;
	while (end < shorter - start && old[old.length - 1 - end] === now[now.length - 1 - end]) end++;
	return { from: start, to: old.length - end, lines: now.slice(start, now.length - end) };
}

/**
 * The notes an editor holds, in file lines: editor line n is file line `range.start + n`. An empty
 * `range` is empty notes, which the editor holds as one empty line that maps to no file line. Lines
 * past the file's end are empty lines that a file without a final newline can't keep at its end
 * (spliceLines). A new line takes `indent`. `separator`: the empty line above `range.start` is the
 * one the notes' first text wrote under the title, which emptying them takes again. `blankAfter` is
 * the list note's, as in ListNotePiece.
 */
export interface NotesSpan {
	range: LineRange;
	indent: string;
	separator: boolean;
	blankAfter: boolean;
}

/** The notes as the editor holds them: the span's lines without the notes' indent. */
export function spanLines(lines: readonly Line[], span: NotesSpan): string[] {
	const { start, end } = span.range;
	if (start === end) return [''];
	const width = columnOf(span.indent);
	return Array.from({ length: end - start }, (_, i) => stripIndent(textAt(lines, start + i), width));
}

/** Saves `change` to a card's notes. Throws UnsafeEditError when the list's layout can't take it. */
export function saveItemNotesLines(
	lines: readonly Line[],
	model: ListModel,
	item: ItemBlock,
	span: NotesSpan,
	change: NotesChange,
): { lines: Line[]; span: NotesSpan } {
	const write = planWrite(lines, span, change);
	const { from, to, run } = fileRun(lines, write.from, write.to, write.texts);
	const eol = dominantEol(lines);
	const edited = replaceRun(lines, model, from, to, run.map((text) => ({ text, eol })), itemNotesKeys(lines, item, from, to, run));
	return { lines: edited, span: { ...span, range: write.range } };
}

/**
 * Saves `change` to the list note, with its blank line after it (writesBlankAfter). `from` is the
 * first line it wrote, and `note` the whole note as saved, which its warnings check. Throws
 * UnsafeEditError when the list's layout can't take it.
 */
export function saveListNoteLines(
	lines: readonly Line[],
	model: ListModel,
	span: NotesSpan,
	change: NotesChange,
): { lines: Line[]; span: NotesSpan; note: string; from: number } {
	const write = planWrite(lines, span, change);
	const { range, blankAfter } = span;
	// Emptying the note takes the blank line it wrote after it too, while that is still blank.
	const to = write.emptied && blankAfter && isBlankAt(lines, range.end) ? range.end + 1 : write.to;
	const writesBlank = !write.emptied && write.to === range.end && writesBlankAfter(lines, model, span, range.end, write.texts[write.texts.length - 1]);
	const { from, to: end, run: texts } = fileRun(lines, write.from, to, writesBlank ? [...write.texts, ''] : write.texts);
	const eol = dominantEol(lines);
	const run = texts.map((text) => ({ text, eol }));
	const note = listNoteAround(lines, model, from, end, run);
	const edited = replaceListNoteRun(lines, model, from, end, run, note);
	const next = { ...span, range: write.range, blankAfter: !write.emptied && (blankAfter || writesBlank) };
	return { lines: edited, span: next, note: noteText(note.after), from };
}

// The file lines a change writes, [from, to) becoming `texts`, and the span's range after it.
interface PlannedWrite {
	from: number;
	to: number;
	texts: string[];
	range: LineRange;
	emptied: boolean;
}

function planWrite(lines: readonly Line[], span: NotesSpan, change: NotesChange): PlannedWrite {
	const held = spanLines(lines, span);
	if (change.from < 0 || change.from > change.to || change.to > held.length) {
		throw new Error(`Lines ${change.from} to ${change.to} are not in the ${held.length} lines of these notes; open them again`);
	}
	const after = [...held.slice(0, change.from), ...change.lines, ...held.slice(change.to)];
	const { range, indent, separator } = span;
	if (after.length === 1 && isBlank(after[0] as string)) {
		const from = separator && range.end > range.start && isBlank(textAt(lines, range.start - 1)) ? range.start - 1 : range.start;
		return { from, to: range.end, texts: [], range: { start: from, end: from }, emptied: true };
	}
	if (range.start === range.end) {
		const texts = after.map((text) => newLine(indent, text));
		const start = separator ? range.start + 1 : range.start;
		return { from: range.start, to: range.start, texts: separator ? ['', ...texts] : texts, range: { start, end: start + texts.length }, emptied: false };
	}
	const width = columnOf(indent);
	const kept = change.to - change.from;
	const texts = change.lines.map((text, i) =>
		i < kept ? touchedLine(textAt(lines, range.start + change.from + i), width, indent, text) : newLine(indent, text),
	);
	const end = range.end + change.lines.length - kept;
	return { from: range.start + change.from, to: range.start + change.to, texts, range: { start: range.start, end }, emptied: false };
}

const newLine = (indent: string, text: string) => (isBlank(text) ? '' : indent + text);

// A touched line keeps the indent it has in the file while the editor's line keeps the part of it
// that shows, which a tab crossing the notes' column shows as spaces. A lazy line, short of that
// column, takes the notes' indent instead, so a list marker typed on it stays in the notes.
function touchedLine(old: string, width: number, indent: string, text: string): string {
	if (isBlank(text)) return '';
	const own = leadingSpace(old);
	const shown = leadingSpace(stripIndent(old, width));
	return columnOf(own) >= width && text.startsWith(shown) ? own + text.slice(shown.length) : newLine(indent, text);
}

const leadingSpace = (text: string) => (/^[ \t]*/.exec(text) as RegExpExecArray)[0];

// A write past the file's end starts with the empty lines the file couldn't keep there.
function fileRun(lines: readonly Line[], from: number, to: number, texts: string[]): { from: number; to: number; run: string[] } {
	const start = Math.min(from, lines.length);
	const missing = texts.length > 0 ? from - start : 0;
	return { from: start, to: Math.min(to, lines.length), run: [...Array<string>(missing).fill(''), ...texts] };
}

const textAt = (lines: readonly Line[], i: number) => lines[i]?.text ?? '';
