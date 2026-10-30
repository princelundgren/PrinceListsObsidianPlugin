import { blockKeys, modelBlockKeys, replaceRun } from './edit-check';
import { dominantEol, spliceLines, splitLines, type Line } from './lines';
import { isBlank, maskBlocks, parseList, type ListModel } from './parse';

export function getListNote(lines: readonly Line[], model: ListModel): string {
	const { start, end } = model.listNote;
	return lines
		.slice(start, end)
		.map((line) => line.text)
		.join('\n');
}

/** The list note's first line with text, where its editor starts, or its end when it has none. */
export function listNoteStartLine(lines: readonly Line[], model: ListModel): number {
	const { start, end } = model.listNote;
	let line = start;
	while (line < end && isBlank((lines[line] as Line).text)) line++;
	return line;
}

/** The list note's lines before and after lines [from, to) become `run`, up to the end of both. */
export function listNoteAround(
	lines: readonly Line[],
	model: ListModel,
	from: number,
	to: number,
	run: readonly Line[],
): { before: Line[]; after: Line[] } {
	const noteEnd = Math.max(model.listNote.end, to);
	const after = [...lines.slice(model.listNote.start, from), ...run, ...lines.slice(to, noteEnd)];
	// The file's last line, without an ending, can come before the run's lines, which it would join.
	const eol = dominantEol(lines);
	return {
		before: lines.slice(model.listNote.start, noteEnd),
		after: after.map((line, i) => (line.eol === '' && i < after.length - 1 ? { ...line, eol } : line)),
	};
}

/**
 * Writes `run` in place of lines [from, to) of the list note, which reads `note` before and after,
 * through replaceRun's check. Throws UnsafeEditError as replaceRun does.
 */
export function replaceListNoteRun(
	lines: readonly Line[],
	model: ListModel,
	from: number,
	to: number,
	run: Line[],
	note: { before: readonly Line[]; after: readonly Line[] },
): Line[] {
	// The owner's exception: while the note, as saved or as it was, leaves a block open, what follows
	// is hidden or reads differently, so the run saves without the check. Only the run's lines change,
	// so closing the block brings back what follows as it was.
	if ([joinTexts(note.before), joinTexts(note.after)].some(listNoteUnclosedBlock)) {
		return spliceLines(lines, from, to - from, run);
	}
	const noteEnd = model.listNote.start + note.before.length;
	const noteBlocks = modelBlockKeys(lines, model).filter((b) => b.start >= model.listNote.start && b.end <= noteEnd);
	return replaceRun(lines, model, from, to, run, {
		removed: noteBlocks.map((b) => b.key),
		added: blockKeys(note.after, 0).map((b) => b.key),
	});
}

/**
 * Whether a save that ends at line `to`, with `last` its last line, writes one blank line after it:
 * it is the note's last, and an item or heading follows directly (owner, 2026-10-20), since a note
 * that ends in an HTML block such as <div> would take in the item.
 */
export function writesBlankAfter(
	lines: readonly Line[],
	model: ListModel,
	span: { range: { end: number }; blankAfter: boolean },
	to: number,
	last: string | undefined,
): boolean {
	// A block the span leaves open runs the note to the end of the file, so the blank line it wrote marks it last.
	const isLast = span.blankAfter || span.range.end >= model.listNote.end;
	const following = lines[to];
	return last !== undefined && !isBlank(last) && isLast && following !== undefined && !isBlank(following.text);
}

/** The note as saved, without the blank lines at its end, which its warnings check. */
export function noteText(note: readonly Line[]): string {
	const texts = note.map((line) => line.text);
	while (texts.length > 0 && isBlank(texts[texts.length - 1] as string)) texts.pop();
	return texts.join('\n');
}

const joinTexts = (lines: readonly Line[]) => lines.map((line) => line.text).join('\n');

export function listNoteWouldRestructure(markdown: string): boolean {
	const model = parseList(splitLines(markdown), 0);
	return model.sections.length > 1 || (model.sections[0]?.items.length ?? 0) > 0;
}

export function listNoteUnclosedBlock(markdown: string): boolean {
	return maskBlocks(splitLines(markdown), 0).unclosedStart !== null;
}
