import { blockKeys, replaceRun } from './edit-check';
import { typedLines } from './edit-lines';
import { dominantEol, spliceLines, splitLines, type Line } from './lines';
import { isBlank, maskBlocks, parseList, type ListModel } from './parse';

export function getListNote(lines: readonly Line[], model: ListModel): string {
	const { start, end } = model.listNote;
	return lines
		.slice(start, end)
		.map((line) => line.text)
		.join('\n');
}

// `note` is the range of lines the editor's previous save wrote, or the model's list note when the
// field takes focus; the range this save writes comes back for the next keystroke. The caller passes
// that range, mapped with mapLine after an outside change. Re-parsing can't stand in for it: a note
// that opens a block, or turns its last line into a setext underline, changes where the parse ends
// the list note, and replacing that range would delete or repeat lines. A range that isn't in these
// lines throws for the same reason. The note's blocks are replaced by the new note's, which may
// include a heading or an item: the editor warns about those before it saves (spec, "The list note").
export function setListNote(
	lines: readonly Line[],
	model: ListModel,
	note: { start: number; end: number },
	markdown: string,
): { lines: Line[]; note: { start: number; end: number } } {
	const { start, end } = note;
	if (!(model.contentStart <= start && start <= end && end <= lines.length)) {
		throw new Error('The list note range is not in these lines; seed it again from the model');
	}
	const eol = dominantEol(lines);
	const written = typedLines(markdown).map((text) => ({ text, eol }));
	const next = lines[end];
	// Always, not only where the check below would need it (spec, "The list note"): a note that ends in
	// an HTML block such as <div> would take in the item.
	const separated = written.length > 0 && next !== undefined && !isBlank(next.text);
	const run = separated ? [...written, { text: '', eol }] : written;
	const range = { start, end: start + written.length };
	// The owner's exception (spec, "The list note"): while the new note, or the one it replaces, leaves
	// a block open, what follows is hidden or reads differently, so the note saves without the check.
	// Only the range's lines change, so closing the block brings back what follows as it was.
	const replaced = lines.slice(start, end).map((line) => line.text).join('\n');
	if (listNoteUnclosedBlock(markdown) || listNoteUnclosedBlock(replaced)) {
		return { lines: spliceLines(lines, start, end - start, run), note: range };
	}
	const noteBlocks = blockKeys(lines, model.contentStart).filter((b) => b.start >= start && b.end <= end);
	const edited = replaceRun(lines, model, start, end, run, {
		removed: noteBlocks.map((b) => b.key),
		added: blockKeys(written, 0).map((b) => b.key),
	});
	return { lines: edited, note: range };
}

export function listNoteWouldRestructure(markdown: string): boolean {
	const model = parseList(splitLines(markdown), 0);
	return model.sections.length > 1 || (model.sections[0]?.items.length ?? 0) > 0;
}

export function listNoteUnclosedBlock(markdown: string): boolean {
	return maskBlocks(splitLines(markdown), 0).unclosedStart !== null;
}
