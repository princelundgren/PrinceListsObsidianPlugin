import { Parser, type Node } from 'commonmark';
import { notesAtMargin, plainNotesLines, untickChecklist } from './checklist';
import { tableStart } from './drawn-blocks';
import { moveEdit } from './follow';
import type { PlannedGroupEdit } from './group-actions';
import { BARE_BLOCK_ID, BLOCK_ID_PATTERN, joinItemLine, parseItemLine, splitTail, tailFields, untickLine } from './item-line';
import { dominantEol, joinLines, spliceLines, splitLines, type Line } from './lines';
import { isBlank, itemAt, maskBlocks, parseList, type ItemBlock } from './parse';

export interface PlannedDuplicate extends PlannedGroupEdit {
	/** How many items it copies. */
	copied: number;
}

// A block id names one block, and a Tasks id one task, so a copy keeps neither.
const TASKS_ID = /^🆔\ufe0f? */;
const DEPENDS_ON = /^⛔\ufe0f? */;

const QUOTE_MARKER = /^[ \t]*>/;

/**
 * Copies each item on `rows`, with its notes, right below itself, in one write. A copy is unticked,
 * as is its checklist, and loses its block ids and Tasks ids, also a sub-task's in its notes, and
 * those ids in its `⛔` fields; the rest of its text is the item's, and a code block or other block
 * the notes editor draws whole is copied as it is. The edit maps every line to where it went, so
 * history inverts it. Returns null when a row is a heading or not an item.
 */
export function planGroupDuplicate(text: string, contentStart: number, rows: readonly number[]): PlannedDuplicate | null {
	const lines = splitLines(text);
	const model = parseList(lines, contentStart);
	const eol = dominantEol(lines);
	const blocks: { end: number; copy: Line[] }[] = [];
	for (const row of [...new Set(rows)].sort((a, b) => a - b)) {
		const item = itemAt(model, row);
		if (!item) return null;
		blocks.push({ end: item.endLine, copy: copyOf(lines, item, eol) });
	}
	if (blocks.length === 0) return null;
	let next = lines;
	// From the bottom up, so each insert leaves the blocks above it where they are.
	for (const { end, copy } of [...blocks].reverse()) next = spliceLines(next, end, 0, copy);
	const addedBefore = (line: number) => blocks.filter((block) => block.end <= line).reduce((sum, block) => sum + block.copy.length, 0);
	return { next: joinLines(next), edit: moveEdit(lines.map((_, line) => line + addedBefore(line))), copied: blocks.length };
}

function copyOf(original: readonly Line[], item: ItemBlock, eol: '\n' | '\r\n'): Line[] {
	const lines = untickChecklist(original, item);
	const plain = new Set(plainNotesLines(lines, item));
	const ends = blockEnds(lines, item);
	const itemLines = [item.titleLine, ...plain].filter((at) => parseItemLine((lines[at] as Line).text));
	const dropped = new Set(itemLines.flatMap((at) => tasksIds((lines[at] as Line).text)));
	const title = lines[item.titleLine] as Line;
	const copy: Line[] = [{ text: withoutItemBlockId(withoutTasksIds(untickLine(title.text), dropped)), eol: title.eol }];
	for (let at = item.titleLine + 1; at < item.endLine; at++) {
		const line = lines[at] as Line;
		if (!plain.has(at)) copy.push(line);
		else if (parseItemLine(line.text)) {
			const text = withoutTasksIds(line.text, dropped);
			copy.push({ text: ends.has(at) ? withoutItemBlockId(text) : text, eol: line.eol });
		} else if (!ends.has(at)) copy.push(line);
		else if (!BARE_BLOCK_ID.test(line.text.trim())) copy.push({ text: withoutBlockId(line.text), eol: line.eol });
	}
	while (copy.length > 1 && isBlank((copy[copy.length - 1] as Line).text)) copy.pop();
	return copy.map((line) => ({ text: line.text, eol: line.eol || eol }));
}

// The notes lines that end a paragraph or heading, where Obsidian reads a block id at the end.
function blockEnds(lines: readonly Line[], item: ItemBlock): Set<number> {
	const notes = notesAtMargin(lines, item);
	const ends = new Set<number>();
	const walker = new Parser().parse(maskBlocks(notes, 0).text).walker();
	for (let step = walker.next(); step; step = walker.next()) {
		const { node, entering } = step;
		if (!entering || (node.type !== 'paragraph' && node.type !== 'heading')) continue;
		const [[startLine], [endLine]] = node.sourcepos;
		// An underlined heading ends on its last line of text, above the underline.
		ends.add(item.titleLine + (node.type === 'heading' && startLine < endLine ? endLine - 1 : endLine));
		if (node.type !== 'paragraph') continue;
		// A table that starts on a later line of a paragraph ends a paragraph on the line above it.
		const depth = quoteDepth(node);
		const paragraph = notes.slice(startLine - 1, endLine).map((line) => insideQuotes(line.text, depth));
		const table = tableStart(paragraph, 1);
		if (table !== undefined) ends.add(item.titleLine + startLine - 1 + table);
	}
	return ends;
}

function quoteDepth(node: Node): number {
	let depth = 0;
	for (let parent = node.parent; parent; parent = parent.parent) if (parent.type === 'block_quote') depth++;
	return depth;
}

// `text` without the `>` markers of the `depth` quotes around it, as many of them as it has.
function insideQuotes(text: string, depth: number): string {
	let inside = text;
	for (let quote = 0; quote < depth && QUOTE_MARKER.test(inside); quote++) inside = inside.replace(QUOTE_MARKER, '');
	return inside;
}

function withoutBlockId(text: string): string {
	const trimmed = text.trimEnd();
	const blockId = BLOCK_ID_PATTERN.exec(trimmed);
	return blockId ? trimmed.slice(0, blockId.index) : text;
}

// The values of an item line's Tasks id fields.
function tasksIds(text: string): string[] {
	const parts = parseItemLine(text);
	if (!parts) return [];
	const { fields } = splitTail(parts.tail);
	return tailFields(fields)
		.map(({ from, to }) => fields.slice(from, to))
		.filter((field) => TASKS_ID.test(field))
		.map((field) => field.replace(TASKS_ID, ''));
}

// An item line without its Tasks id fields and the ids of `dropped` in its ⛔ fields, and without a
// ⛔ field left empty.
function withoutTasksIds(text: string, dropped: ReadonlySet<string>): string {
	const parts = parseItemLine(text);
	if (!parts) return text;
	const { fields, end } = splitTail(parts.tail);
	const startsLine = parts.title + parts.end + parts.marks === '';
	let kept = fields;
	for (const { from, to } of tailFields(fields).reverse()) {
		const field = kept.slice(from, to);
		const left = DEPENDS_ON.test(field) ? dependsOnWithout(field, dropped) : field;
		if (left !== '' && !TASKS_ID.test(field)) kept = kept.slice(0, from) + left + kept.slice(to);
		else kept = withoutField(kept, from, to, startsLine);
	}
	// With every field gone from the start of the line, the block id after them needs no space before it.
	const tail = startsLine && kept === '' && fields !== '' ? end.trimStart() : kept + end;
	return joinItemLine({ ...parts, tail });
}

// An item line without its block id; a title that is only a block id goes too.
function withoutItemBlockId(text: string): string {
	const parts = parseItemLine(text);
	if (!parts) return text;
	const { fields, end } = splitTail(parts.tail);
	const title = BARE_BLOCK_ID.test(parts.title) && fields === '' ? '' : parts.title;
	return joinItemLine({ ...parts, title, tail: fields + (end.trimEnd() !== '' ? '' : end) });
}

// A ⛔ field without the ids of `dropped`, or '' when none is left.
function dependsOnWithout(field: string, dropped: ReadonlySet<string>): string {
	const prefix = DEPENDS_ON.exec(field)?.[0] ?? '';
	const ids = field.slice(prefix.length).split(/ *, */);
	const left = ids.filter((id) => !dropped.has(id));
	if (left.length === ids.length) return field;
	return left.length === 0 ? '' : prefix + left.join(',');
}

// `fields` without the field from `from` to `to`, and the space before it, unless the next field
// follows with none of its own; at the start of the line, the space after it instead.
function withoutField(fields: string, from: number, to: number, startsLine: boolean): string {
	let start = from;
	let stop = to;
	if (stop === fields.length || /\s/.test(fields.charAt(stop))) while (start > 0 && /\s/.test(fields.charAt(start - 1))) start--;
	if (start === 0 && startsLine) while (/\s/.test(fields.charAt(stop))) stop++;
	return fields.slice(0, start) + fields.slice(stop);
}
