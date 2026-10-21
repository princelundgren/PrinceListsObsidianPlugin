import { isDoneStatus, isRepeating, parseItemLine, setTitle, tickLine, untickLine } from './item-line';
import { dominantEol, spliceLines, splitLines, type Line } from './lines';
import { columnOf, isBlank, topLevelBlocks, type ItemBlock, type ListModel, type Section } from './parse';

type MoveTarget = { after: ItemBlock } | { firstIn: Section };

export class RepeatingItemError extends Error {
	constructor() {
		super('A repeating item cannot be ticked');
		this.name = 'RepeatingItemError';
	}
}

// Thrown, with nothing changed, when an edit would change how the rest of the file parses and the
// empty lines it may write can't prevent it.
export class UnsafeEditError extends Error {
	constructor() {
		super('This edit would change how the rest of the list reads');
		this.name = 'UnsafeEditError';
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
	return replaceRun(lines, model, item.titleLine, end, [], { removed: itemKey(lines, item) });
}

export function moveItem(lines: readonly Line[], model: ListModel, item: ItemBlock, to: MoveTarget): Line[] {
	if ('after' in to && to.after.titleLine === item.titleLine) return lines.slice();
	const from = sectionOf(model, item);
	const target = 'after' in to ? sectionOf(model, to.after) : to.firstIn;
	const order =
		from.headingLine === target.headingLine
			? reorderInSection(lines.length, from, item, to)
			: moveAcross(lines, from, item, 'after' in to ? to.after.endLine : firstLineIn(lines, model, target));
	const moved = order.map((i) => lines[i] as Line);
	const before = blockKeys(lines, model.contentStart).map((b) => b.key);
	// A move keeps every line, so the boundaries it makes are where two non-blank lines that weren't
	// neighbors meet. Each index is that of the lower line in `moved`.
	const boundaries = order.flatMap((was, at) =>
		at > 0 && was !== (order[at - 1] as number) + 1 && !isBlankAt(moved, at - 1) && !isBlankAt(moved, at) ? [at] : [],
	);
	const eol = dominantEol(lines);
	const separated = (blankAt: ReadonlySet<number>) =>
		spliceLines(
			lines,
			0,
			lines.length,
			moved.flatMap((line, at) => (blankAt.has(at) ? [{ text: '', eol }, line] : [line])),
		);
	// An empty line goes at each boundary inside a block that no longer parses as it did, pass after
	// pass, since one can uncover the next join.
	const blankAt = new Set<number>();
	for (let pass = 0; pass <= boundaries.length; pass++) {
		const result = separated(blankAt);
		const after = blockKeys(result, model.contentStart);
		if (sameBlocks(after, before)) return result;
		const changed = surplus(after, before);
		const shifted = (at: number) => at + [...blankAt].filter((b) => b <= at).length;
		const next = boundaries.filter((at) => !blankAt.has(at) && changed.some((b) => b.start < shifted(at) && shifted(at) < b.end));
		if (next.length === 0) break;
		for (const at of next) blankAt.add(at);
	}
	// A definition belongs to no block, so a join with one, or a block that vanishes into one, points
	// at no boundary. An empty line at every boundary covers those.
	const result = separated(new Set(boundaries));
	if (sameBlocks(blockKeys(result, model.contentStart), before)) return result;
	throw new UnsafeEditError();
}

export function getItemNotes(lines: readonly Line[], item: ItemBlock): string {
	let start = item.titleLine + 1;
	while (start < item.endLine && isBlank((lines[start] as Line).text)) start++;
	const width = columnOf(item.notesIndent);
	return lines
		.slice(start, item.endLine)
		.map((line) => stripIndent(line.text, width))
		.join('\n');
}

export function setItemNotes(lines: readonly Line[], model: ListModel, item: ItemBlock, markdown: string): Line[] {
	const texts = splitLines(markdown).map((line) => line.text);
	// The editor writes on every keystroke, so an Enter at the end would otherwise leave a blank
	// line that falls outside the item.
	while (texts.length > 0 && isBlank(texts[texts.length - 1] as string)) texts.pop();
	const eol = dominantEol(lines);
	// The blank line after the title keeps a `---` in the notes from turning the title into a heading.
	const notes = texts.length === 0 ? [] : ['', ...texts.map((text) => (isBlank(text) ? '' : item.notesIndent + text))];
	const title = (lines[item.titleLine] as Line).text;
	return replaceRun(lines, model, item.titleLine + 1, item.endLine, notes.map((text) => ({ text, eol })), {
		removed: itemKey(lines, item),
		added: blockKey('item', [title, ...notes]),
	});
}

function replaceLine(lines: readonly Line[], at: number, text: string): Line[] {
	return spliceLines(lines, at, 1, [{ text, eol: (lines[at] as Line).eol }]);
}

function insertAt(lines: readonly Line[], model: ListModel, at: number, title: string): { lines: Line[]; titleLine: number } {
	const line = { text: `- [ ] ${oneLine(title)}`, eol: dominantEol(lines) };
	return { lines: replaceRun(lines, model, at, at, [line], { added: blockKey('item', [line.text]) }), titleLine: at };
}

// A line break in a title would write a second line that no item owns.
function oneLine(title: string): string {
	if (/[\r\n]/.test(title)) throw new Error('A title must be a single line');
	return title;
}

// Writes `run` in place of lines [start, end), where `edit` names the block the run removes and the
// one it adds. Every other block must parse as it did, as a block of the same type and source text.
// If it doesn't, one empty line ends the run; if that doesn't help either, the edit is refused.
function replaceRun(
	lines: readonly Line[],
	model: ListModel,
	start: number,
	end: number,
	run: Line[],
	edit: { removed?: string; added?: string },
): Line[] {
	const expected = blockKeys(lines, model.contentStart).map((b) => b.key);
	const removed = edit.removed === undefined ? -1 : expected.indexOf(edit.removed);
	if (removed !== -1) expected.splice(removed, 1);
	if (edit.added !== undefined) expected.push(edit.added);
	for (const tail of [[], [{ text: '', eol: dominantEol(lines) }]]) {
		const edited = spliceLines(lines, start, end - start, [...run, ...tail]);
		if (sameBlocks(blockKeys(edited, model.contentStart), expected)) return edited;
	}
	throw new UnsafeEditError();
}

// Each top-level block with its type and source text, so that an edit can tell whether a block
// still parses as it did: joined to the text below it, split, or turned from a paragraph into a
// setext heading.
function blockKeys(lines: readonly Line[], contentStart: number): { key: string; start: number; end: number }[] {
	return topLevelBlocks(lines, contentStart).map(({ type, start, end }) => ({
		key: blockKey(type, lines.slice(start, end).map((line) => line.text)),
		start,
		end,
	}));
}

function blockKey(type: string, texts: readonly string[]): string {
	return `${type}:${texts.join('\n')}`;
}

function itemKey(lines: readonly Line[], item: ItemBlock): string {
	return blockKey('item', lines.slice(item.titleLine, item.endLine).map((line) => line.text));
}

// The blocks of `after` whose type and source text `before` has fewer of. All copies count, since a
// changed block can match one that was there all along.
function surplus<T extends { key: string }>(after: T[], before: readonly string[]): T[] {
	const count = new Map<string, number>();
	for (const key of before) count.set(key, (count.get(key) ?? 0) + 1);
	for (const { key } of after) count.set(key, (count.get(key) ?? 0) - 1);
	return after.filter(({ key }) => (count.get(key) as number) < 0);
}

// Order is ignored on purpose: a move reorders items, so only which blocks there are must match.
function sameBlocks(after: { key: string }[], expected: readonly string[]): boolean {
	if (after.length !== expected.length) return false;
	const keys = after.map((b) => b.key).sort();
	const wanted = [...expected].sort();
	return keys.every((key, i) => key === wanted[i]);
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
	return model.sections.find((s) => s.items.some((i) => i.titleLine === item.titleLine)) as Section;
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

function gapEnd(lines: readonly Line[], start: number): number {
	let end = start;
	while (isBlankAt(lines, end)) end++;
	return end;
}

function isBlankAt(lines: readonly Line[], i: number): boolean {
	const line = lines[i];
	return line !== undefined && isBlank(line.text);
}

function range(start: number, end: number): number[] {
	return Array.from({ length: end - start }, (_, i) => start + i);
}

// Removes up to `width` columns of indentation, a tab moving to the next multiple of 4. A tab that
// crosses `width` leaves its remaining columns as spaces, as CommonMark does. A lazy line is indented
// less than the content column, which `width` always reaches, so it loses all its indentation.
function stripIndent(text: string, width: number): string {
	let column = 0;
	let i = 0;
	for (; column < width && (text[i] === ' ' || text[i] === '\t'); i++) {
		column = text[i] === '\t' ? column + 4 - (column % 4) : column + 1;
	}
	return ' '.repeat(Math.max(0, column - width)) + text.slice(i);
}
