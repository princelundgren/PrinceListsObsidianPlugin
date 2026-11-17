import { plainNotesLines } from './checklist';
import { moveEdit } from './follow';
import type { PlannedGroupEdit } from './group-actions';
import { isHeading } from './group-edits';
import { joinItemLine, parseItemLine, splitTail, tailFields, untickLine } from './item-line';
import { dominantEol, joinLines, spliceLines, splitLines, type Line } from './lines';
import { isBlank, itemAt, parseList, type ItemBlock } from './parse';

export interface PlannedDuplicate extends PlannedGroupEdit {
	/** Each copy's title line in `next`, in list order. */
	copies: number[];
}

// A block id names one block, and a Tasks id one task, so a copy keeps neither.
const BARE_BLOCK_ID = /^\^[A-Za-z0-9-]+$/;
const BLOCK_ID_LINE = /^[ \t]*\^[A-Za-z0-9-]+[ \t]*$/;
const BLOCK_ID_END = /[ \t]+\^[A-Za-z0-9-]+[ \t]*$/;
const TASKS_ID = /^🆔/;

/**
 * Copies each item on `rows`, with its notes, right below itself, in one write. A copy is unticked
 * and loses its block ids and Tasks ids, also a sub-task's in its notes; the rest of its text is the
 * item's, and a code block or other block the notes editor draws whole is copied as it is. The edit
 * maps every line to where it went, so history inverts it. Returns null when a row is a heading or
 * not an item.
 */
export function planGroupDuplicate(text: string, contentStart: number, rows: readonly number[]): PlannedDuplicate | null {
	const lines = splitLines(text);
	const model = parseList(lines, contentStart);
	const eol = dominantEol(lines);
	const blocks: { end: number; copy: Line[] }[] = [];
	for (const row of [...new Set(rows)].sort((a, b) => a - b)) {
		const item = itemAt(model, row);
		if (isHeading(model, row) || !item) return null;
		blocks.push({ end: item.endLine, copy: copyOf(lines, item, eol) });
	}
	if (blocks.length === 0) return null;
	let next = lines;
	// From the bottom up, so each insert leaves the blocks above it where they are.
	for (const { end, copy } of [...blocks].reverse()) next = spliceLines(next, end, 0, copy);
	const addedBefore = (line: number) => blocks.filter((block) => block.end <= line).reduce((sum, block) => sum + block.copy.length, 0);
	return {
		next: joinLines(next),
		edit: moveEdit(lines.map((_, line) => line + addedBefore(line))),
		copies: blocks.map((block) => block.end + addedBefore(block.end - 1)),
	};
}

function copyOf(lines: readonly Line[], item: ItemBlock, eol: '\n' | '\r\n'): Line[] {
	const plain = new Set(plainNotesLines(lines, item));
	const title = lines[item.titleLine] as Line;
	const copy: Line[] = [{ text: withoutIds(untickLine(title.text)), eol: title.eol }];
	for (let at = item.titleLine + 1; at < item.endLine; at++) {
		const line = lines[at] as Line;
		if (!plain.has(at)) copy.push(line);
		else if (!BLOCK_ID_LINE.test(line.text)) copy.push({ text: parseItemLine(line.text) ? withoutIds(line.text) : line.text.replace(BLOCK_ID_END, ''), eol: line.eol });
	}
	while (copy.length > 1 && isBlank((copy[copy.length - 1] as Line).text)) copy.pop();
	return copy.map((line) => ({ text: line.text, eol: line.eol || eol }));
}

// An item line without its block id or Tasks id field; a title that is only a block id goes too.
function withoutIds(text: string): string {
	const parts = parseItemLine(text);
	if (!parts) return text;
	const { fields, end } = splitTail(parts.tail);
	let kept = fields;
	for (const { from, to } of tailFields(fields).reverse()) {
		if (!TASKS_ID.test(fields.slice(from))) continue;
		// The space before it goes too, unless the next field follows with none of its own.
		let start = from;
		if (to === kept.length || /\s/.test(kept.charAt(to))) while (start > 0 && /\s/.test(kept.charAt(start - 1))) start--;
		kept = kept.slice(0, start) + kept.slice(to);
	}
	const blockId = end.trimEnd() !== '';
	const title = BARE_BLOCK_ID.test(parts.title) && kept === '' ? '' : parts.title;
	return joinItemLine({ ...parts, title, tail: kept + (blockId ? '' : end) });
}
