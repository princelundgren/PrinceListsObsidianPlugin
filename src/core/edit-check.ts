import { dominantEol, spliceLines, type Line } from './lines';
import { topLevelBlocks, type Block, type ListModel } from './parse';

// Thrown, with nothing changed, when an edit would change how the rest of the file parses and the
// empty lines it may write can't prevent it.
export class UnsafeEditError extends Error {
	constructor() {
		super('This edit would change how the rest of the list reads');
		this.name = 'UnsafeEditError';
	}
}

// Writes `run` in place of lines [start, end), where `edit` names the blocks the run removes and the
// ones it adds. Every other block must parse as it did, as a block of the same type and source text.
// If it doesn't, one empty line ends the run; if that doesn't help either, the edit is refused.
export function replaceRun(
	lines: readonly Line[],
	model: ListModel,
	start: number,
	end: number,
	run: Line[],
	edit: { removed?: string[]; added?: string[] },
): Line[] {
	const expected = modelBlockKeys(lines, model).map((b) => b.key);
	for (const key of edit.removed ?? []) {
		const removed = expected.indexOf(key);
		if (removed !== -1) expected.splice(removed, 1);
	}
	expected.push(...(edit.added ?? []));
	for (const tail of [[], [{ text: '', eol: dominantEol(lines) }]]) {
		const edited = spliceLines(lines, start, end - start, [...run, ...tail]);
		if (sameBlocks(blockKeys(edited, model.contentStart), expected)) return edited;
	}
	throw new UnsafeEditError();
}

// Each top-level block with its type and source text, so that an edit can tell whether a block
// still parses as it did: joined to the text below it, split, or turned from a paragraph into a
// setext heading.
export function blockKeys(lines: readonly Line[], contentStart: number): BlockKey[] {
	return keysOf(lines, topLevelBlocks(lines, contentStart));
}

/** As blockKeys, from the blocks `model` was read from, which must be `lines`, without parsing them again. */
export function modelBlockKeys(lines: readonly Line[], model: ListModel): BlockKey[] {
	return keysOf(lines, model.blocks);
}

interface BlockKey extends Block {
	key: string;
}

function keysOf(lines: readonly Line[], blocks: readonly Block[]): BlockKey[] {
	return blocks.map(({ type, start, end }) => ({
		type,
		key: blockKey(type, lines.slice(start, end).map((line) => line.text)),
		start,
		end,
	}));
}

export function blockKey(type: string, texts: readonly string[]): string {
	return `${type}:${texts.join('\n')}`;
}

// Order is ignored on purpose: a move reorders items, so only which blocks there are must match.
export function sameBlocks(after: { key: string }[], expected: readonly string[]): boolean {
	if (after.length !== expected.length) return false;
	const keys = after.map((b) => b.key).sort();
	const wanted = [...expected].sort();
	return keys.every((key, i) => key === wanted[i]);
}
