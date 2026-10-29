import { blockKey, replaceRun, UnsafeEditError } from './edit-check';
import { gapEnd, hasLineBreak, isBlankAt, typedLines } from './edit-lines';
import { isDoneStatus, isRepeating, parseItemLine, setTitle, tickLine, untickLine } from './item-line';
import { dominantEol, spliceLines, type Line } from './lines';
import { columnOf, isBlank, type ItemBlock, type ListModel, type Section } from './parse';
import { range, reorderChecked } from './reorder';

// Callers of the item edits import it from here.
export { UnsafeEditError };

export type MoveTarget = { after: ItemBlock } | { firstIn: Section };

export class RepeatingItemError extends Error {
	constructor() {
		super('A repeating item cannot be ticked');
		this.name = 'RepeatingItemError';
	}
}

export function toggleItem(lines: readonly Line[], item: ItemBlock, now: Date): Line[] {
	const { text } = lines[item.titleLine] as Line;
	const parts = parseItemLine(text);
	if (parts && isDoneStatus(parts.status)) return replaceLine(lines, item.titleLine, untickLine(text));
	// Ticking without creating the next occurrence would quietly end the repeat.
	if (isRepeating(text)) throw new RepeatingItemError();
	return replaceLine(lines, item.titleLine, tickLine(text, now));
}

export function setItemTitle(lines: readonly Line[], item: ItemBlock, title: string): Line[] {
	return replaceLine(lines, item.titleLine, setTitle((lines[item.titleLine] as Line).text, oneLine(title)));
}

export function insertItem(
	lines: readonly Line[],
	model: ListModel,
	after: ItemBlock | null,
	title: string,
): { lines: Line[]; titleLine: number } {
	const at = after ? after.endLine : firstLineIn(lines, model, model.sections[0] as Section);
	return insertAt(lines, model, at, title);
}

export function insertItemInSection(
	lines: readonly Line[],
	model: ListModel,
	section: Section,
	title: string,
): { lines: Line[]; titleLine: number } {
	return insertAt(lines, model, firstLineIn(lines, model, section), title);
}

export function deleteItem(lines: readonly Line[], model: ListModel, item: ItemBlock): Line[] {
	const gapBefore = isBlankAt(lines, item.titleLine - 1);
	const end = gapBefore ? gapEnd(lines, item.endLine) : item.endLine;
	return replaceRun(lines, model, item.titleLine, end, [], { removed: [itemKey(lines, item)] });
}

export function moveItem(lines: readonly Line[], model: ListModel, item: ItemBlock, to: MoveTarget): Line[] {
	return moveItemWithLineMap(lines, model, item, to).lines;
}

// moveItem, and `moved[i]`, the line that line `i` went to, or null for an empty line it dropped from
// the end (spliceLines).
export function moveItemWithLineMap(
	lines: readonly Line[],
	model: ListModel,
	item: ItemBlock,
	to: MoveTarget,
): { lines: Line[]; moved: (number | null)[] } {
	if ('after' in to && to.after.titleLine === item.titleLine) return { lines: lines.slice(), moved: range(0, lines.length) };
	const from = sectionOf(model, item);
	const target = 'after' in to ? sectionOf(model, to.after) : to.firstIn;
	const order =
		from.headingLine === target.headingLine
			? reorderInSection(lines.length, from, item, to)
			: moveAcross(lines, from, item, 'after' in to ? to.after.endLine : firstLineIn(lines, model, target));
	return reorderChecked(lines, model, order);
}

// The first line of the item's notes, past the blank lines after its title, or its endLine.
export function notesStartLine(lines: readonly Line[], item: ItemBlock): number {
	let start = item.titleLine + 1;
	while (start < item.endLine && isBlank((lines[start] as Line).text)) start++;
	return start;
}

export function getItemNotes(lines: readonly Line[], item: ItemBlock): string {
	const start = notesStartLine(lines, item);
	const width = columnOf(item.notesIndent);
	return lines
		.slice(start, item.endLine)
		.map((line) => stripIndent(line.text, width))
		.join('\n');
}

// A field that saves on every keystroke passes the indent the notes had when it took focus. Re-parsed
// after a save, notesIndent takes in spaces typed at the start of the notes, and the next save would
// add them to every line, turning a paragraph into code.
export function setItemNotes(
	lines: readonly Line[],
	model: ListModel,
	item: ItemBlock,
	markdown: string,
	indent = item.notesIndent,
): Line[] {
	const texts = typedLines(markdown);
	const eol = dominantEol(lines);
	// The blank line after the title keeps a `---` in the notes from turning the title into a heading.
	const notes = texts.length === 0 ? [] : ['', ...texts.map((text) => (isBlank(text) ? '' : indent + text))];
	const title = (lines[item.titleLine] as Line).text;
	return replaceRun(lines, model, item.titleLine + 1, item.endLine, notes.map((text) => ({ text, eol })), {
		removed: [itemKey(lines, item)],
		added: [blockKey('item', [title, ...notes])],
	});
}

function replaceLine(lines: readonly Line[], at: number, text: string): Line[] {
	return spliceLines(lines, at, 1, [{ text, eol: (lines[at] as Line).eol }]);
}

function insertAt(lines: readonly Line[], model: ListModel, at: number, title: string): { lines: Line[]; titleLine: number } {
	const line = { text: `- [ ] ${oneLine(title)}`, eol: dominantEol(lines) };
	return { lines: replaceRun(lines, model, at, at, [line], { added: [blockKey('item', [line.text])] }), titleLine: at };
}

function oneLine(title: string): string {
	if (hasLineBreak(title)) throw new Error('A title must be a single line');
	return title;
}

function itemKey(lines: readonly Line[], item: ItemBlock): string {
	return blockKey('item', lines.slice(item.titleLine, item.endLine).map((line) => line.text));
}

// A named section without items takes the item after its content: right under the heading, a
// paragraph there would become the item's lazy line. The top section's content is the list note, so
// the item goes past the note's blank lines, at the first heading or the end of the file.
function firstLineIn(lines: readonly Line[], model: ListModel, section: Section): number {
	const first = section.items[0];
	if (first) return first.titleLine;
	if (section.headingLine !== null) return section.endLine;
	return model.sections[1]?.headingLine ?? lines.length;
}

function sectionOf(model: ListModel, item: ItemBlock): Section {
	const section = model.sections.find((s) => s.items.some((i) => i.titleLine === item.titleLine));
	if (!section) throw new Error('The item is not in this model; parse the current lines again');
	return section;
}

// Within a section the items trade slots, and every gap and untouched block stays in its own.
function reorderInSection(count: number, section: Section, item: ItemBlock, to: MoveTarget): number[] {
	const items = section.items.filter((i) => i.titleLine !== item.titleLine);
	items.splice('after' in to ? items.findIndex((i) => i.titleLine === to.after.titleLine) + 1 : 0, 0, item);
	const start = (section.items[0] as ItemBlock).titleLine;
	const order = range(0, start);
	let cursor = start;
	section.items.forEach((slot, k) => {
		const next = items[k] as ItemBlock;
		order.push(...range(cursor, slot.titleLine), ...range(next.titleLine, next.endLine));
		cursor = slot.endLine;
	});
	order.push(...range(cursor, count));
	return order;
}

function moveAcross(lines: readonly Line[], section: Section, item: ItemBlock, at: number): number[] {
	const gap = gapThatMoves(lines, section, item);
	const inGap = (i: number) => gap !== null && i >= gap.start && i < gap.end;
	const order: number[] = [];
	for (let i = 0; i <= lines.length; i++) {
		if (gap && i === section.endLine) order.push(...range(gap.start, gap.end));
		// Gaps belong to slots, not to items, so the item joins its new section without one.
		if (i === at) order.push(...range(item.titleLine, item.endLine));
		if (i < lines.length && (i < item.titleLine || i >= item.endLine) && !inGap(i)) order.push(i);
	}
	return order;
}

// When an item leaves its section, the gap after it moves to the section's end if it would
// otherwise double the gap before the item, as deleteItem's does, or if it sat between the item and
// the next one with no item directly before. The gap before the item never moves: whatever follows
// the item would then follow the previous item directly, and a paragraph there would become its
// lazy line.
function gapThatMoves(lines: readonly Line[], section: Section, item: ItemBlock): { start: number; end: number } | null {
	const k = section.items.findIndex((i) => i.titleLine === item.titleLine);
	const after = { start: item.endLine, end: gapEnd(lines, item.endLine) };
	if (after.end === after.start) return null;
	if (isBlankAt(lines, item.titleLine - 1)) return after;
	const previousIsAdjacent = section.items[k - 1]?.endLine === item.titleLine;
	return section.items[k + 1]?.titleLine === after.end && !previousIsAdjacent ? after : null;
}

// Removes up to `width` columns of indentation, a tab moving to the next multiple of 4. A tab that
// crosses `width` leaves its remaining columns as spaces, as CommonMark does. A lazy line is indented
// less than the content column, which `width` always reaches, so it loses all its indentation.
export function stripIndent(text: string, width: number): string {
	let column = 0;
	let i = 0;
	for (; column < width && (text[i] === ' ' || text[i] === '\t'); i++) {
		column = text[i] === '\t' ? column + 4 - (column % 4) : column + 1;
	}
	return ' '.repeat(Math.max(0, column - width)) + text.slice(i);
}
