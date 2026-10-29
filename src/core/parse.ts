import { Parser, type Node } from 'commonmark';
import { parseItemLine } from './item-line';
import { joinLines, type Line } from './lines';

// Line numbers are 0-based indexes into the file's lines, and every end is exclusive. No range
// ends in a blank line.
export interface ItemBlock {
	titleLine: number;
	endLine: number;
	/**
	 * The indent new or rewritten notes take: the notes' own when it reaches the content column, where
	 * the title's `[` starts, but not 4 columns past it. Otherwise a tab when that column is 4 or less,
	 * else that many spaces.
	 */
	notesIndent: string;
}

export interface Section {
	/** null only for sections[0], the unnamed top section, which is always there. */
	headingLine: number | null;
	items: ItemBlock[];
	/** Ends where the next section starts, so untouched content after its last item counts. */
	endLine: number;
}

/** A top-level CommonMark block, or one item of a top-level list. */
export interface Block {
	/** commonmark's node type, such as `paragraph`, `heading` or `item`. */
	type: string;
	start: number;
	end: number;
}

export interface ListModel {
	contentStart: number;
	listNote: { start: number; end: number };
	sections: Section[];
	untouched: { start: number; end: number }[];
	/** The top-level blocks it was read from, so an edit's check needn't parse the same lines again. */
	blocks: Block[];
}

// CommonMark's fence lines. A backtick fence's info string can't hold a backtick.
const COLUMN_ZERO_FENCE = /^(?:`{3,}(?!.*`)|~{3,})/;
const INDENTED_FENCE = /^ {1,3}(?:`{3,}(?!.*`)|~{3,})/;
const CLOSING_FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const LEADING_FENCE_RUN = /^[ \t]*(`+|~+)/;
const OBSIDIAN_DELIMITERS = ['%%', '$$'];
// CommonMark HTML blocks of types 1 to 5 (spec 0.31.2, 4.6) end only at their end condition, so like
// a fence they can run to the end of the file. The start patterns are commonmark.js's own, which it
// tests after the line's indentation.
const HTML_BLOCK_ENDS: [start: RegExp, end: RegExp][] = [
	[/^<(?:script|pre|textarea|style)(?:\s|>|$)/i, /<\/(?:script|pre|textarea|style)>/i],
	[/^<!--/, /-->/],
	[/^<\?/, /\?>/],
	[/^<![A-Za-z]/, />/],
	[/^<!\[CDATA\[/, /\]\]>/],
];

export function maskBlocks(
	lines: readonly Line[],
	contentStart: number,
): { text: string; unclosedStart: number | null } {
	const masked = maskLines(lines, contentStart);
	const text = joinLines(masked);
	return { text, unclosedStart: unclosedStart(new Parser().parse(text), masked, contentStart) };
}

// The item whose title is on `titleLine`, if one is.
export function itemAt(model: ListModel, titleLine: number): ItemBlock | undefined {
	for (const section of model.sections) {
		const item = section.items.find((candidate) => candidate.titleLine === titleLine);
		if (item) return item;
	}
	return undefined;
}

export function topLevelBlocks(lines: readonly Line[], contentStart: number): Block[] {
	return blocksOf(lines, contentStart, topLevelParts);
}

// The document's own blocks, a whole list as one.
export function documentBlocks(lines: readonly Line[], contentStart: number): Block[] {
	return blocksOf(lines, contentStart, childrenOf);
}

function blocksOf(lines: readonly Line[], contentStart: number, partsOf: (doc: Node) => Iterable<Node>): Block[] {
	const doc = new Parser().parse(joinLines(maskLines(lines, contentStart)));
	return [...partsOf(doc)].map((node) => {
		const start = contentStart + node.sourcepos[0][0] - 1;
		const end = trimBlankEnd(lines, start + 1, Math.min(lines.length, contentStart + node.sourcepos[1][0]));
		return { type: node.type, start, end };
	});
}

export function parseList(lines: readonly Line[], contentStart: number): ListModel {
	const sections: Section[] = [{ headingLine: null, items: [], endLine: contentStart }];
	const untouched: ListModel['untouched'] = [];
	// Before the first heading or item, everything is part of the list note.
	let firstHeadingOrItem: number | null = null;
	let covered = contentStart;

	const blocks = topLevelBlocks(lines, contentStart);
	for (const block of blocks) {
		const { type, end } = block;
		const start = type === 'heading' ? headingContentStart(lines, block.start, end) : block.start;
		// Non-blank lines no node covers, such as link reference definitions that commonmark drops from
		// the tree, are untouched content too.
		if (firstHeadingOrItem !== null) untouched.push(...nonBlankRuns(lines, covered, start));
		covered = end;
		const parts = type === 'item' ? parseItemLine((lines[start] as Line).text) : null;
		if (type === 'heading') {
			sections.push({ headingLine: start, items: [], endLine: start });
		} else if (parts) {
			const notesIndent = indentForNotes(lines, start, end, columnOf(parts.before.slice(0, -1)));
			(sections[sections.length - 1] as Section).items.push({ titleLine: start, endLine: end, notesIndent });
		} else {
			if (firstHeadingOrItem !== null) untouched.push({ start, end });
			continue;
		}
		firstHeadingOrItem ??= start;
	}
	if (firstHeadingOrItem !== null) untouched.push(...nonBlankRuns(lines, covered, lines.length));

	sections.forEach((section, i) => {
		const next = sections[i + 1]?.headingLine ?? lines.length;
		section.endLine = trimBlankEnd(lines, section.headingLine ?? contentStart, next);
	});
	const listNoteEnd = trimBlankEnd(lines, contentStart, firstHeadingOrItem ?? lines.length);
	return { contentStart, listNote: { start: contentStart, end: listNoteEnd }, sections, untouched, blocks };
}

// Obsidian's %% comments and $$ math aren't CommonMark, so a checkbox line inside one would parse as
// an item. Each region that opens at column 0 becomes a fenced code block in the copy that is parsed.
// Column 0 keeps it top-level: an item's notes are indented, and a fence is never a lazy line. Fences
// and HTML blocks, whose content isn't masked, are tracked at column 0 for the same reason: an
// indented one may sit in notes, and then the end of the item closes it. A top-level fence indented
// 1 to 3 spaces is tracked too, once commonmark finds it in a masked copy.
function maskLines(lines: readonly Line[], contentStart: number): Line[] {
	const content = lines.slice(contentStart);
	let trackedFenceStarts = new Set<number>();
	let masked = maskRegions(content, trackedFenceStarts);
	// Masking runs top-down, and only the lines above a fence decide whether it's top-level, so each pass
	// gets right at least the first fence the last one got wrong: one pass per line is more than enough.
	for (let pass = 0; pass < content.length; pass++) {
		const found = indentedFenceStarts(content, masked);
		if (found.size === trackedFenceStarts.size && [...found].every((n) => trackedFenceStarts.has(n))) break;
		trackedFenceStarts = found;
		masked = maskRegions(content, trackedFenceStarts);
	}
	return masked;
}

function maskRegions(content: readonly Line[], trackedFenceStarts: ReadonlySet<number>): Line[] {
	const masked = content.slice();
	let closesOpenBlock: ((text: string) => boolean) | null = null;
	for (let i = 0; i < masked.length; i++) {
		const { text } = masked[i] as Line;
		if (closesOpenBlock) {
			if (closesOpenBlock(text)) closesOpenBlock = null;
			continue;
		}
		const fence = COLUMN_ZERO_FENCE.exec(text)?.[0] ?? (trackedFenceStarts.has(i) ? fenceRun(text) : undefined);
		if (fence) {
			closesOpenBlock = (line) => closesFence(fence, line);
			continue;
		}
		const htmlEnd = HTML_BLOCK_ENDS.find(([start]) => start.test(text))?.[1];
		if (htmlEnd) {
			if (!htmlEnd.test(text)) closesOpenBlock = (line) => htmlEnd.test(line);
			continue;
		}
		const delimiter = OBSIDIAN_DELIMITERS.find((d) => text.startsWith(d) && !text.includes(d, d.length));
		if (!delimiter) continue;
		// Obsidian doesn't document where a comment or math block ends; the next line holding it ends it.
		let close = i + 1;
		while (close < masked.length && !(masked[close] as Line).text.includes(delimiter)) close++;
		// Longer than any fence inside, so nothing in the region can close it early.
		const longestInside = masked.slice(i + 1, close).reduce((n, l) => Math.max(n, fenceRun(l.text).length), 0);
		const mask = '`'.repeat(Math.max(3, longestInside + 1));
		for (const at of [i, close]) {
			const line = masked[at];
			if (line) masked[at] = { text: mask, eol: line.eol };
		}
		i = close;
	}
	return masked;
}

// The lines that open a top-level fence indented 1 to 3 spaces in `masked`. Only a parse tells one from
// a fence in an item's notes, so it runs only when `content` has such a fence and a %% or $$ line.
function indentedFenceStarts(content: readonly Line[], masked: readonly Line[]): Set<number> {
	const starts = new Set<number>();
	const startsWithDelimiter = (text: string) => OBSIDIAN_DELIMITERS.some((d) => text.startsWith(d));
	if (!content.some((l) => INDENTED_FENCE.test(l.text)) || !content.some((l) => startsWithDelimiter(l.text))) return starts;
	for (const node of childrenOf(new Parser().parse(joinLines(masked)))) {
		const start = node.sourcepos[0][0] - 1;
		if (node.type === 'code_block' && node.info !== null && INDENTED_FENCE.test((masked[start] as Line).text)) starts.add(start);
	}
	return starts;
}

// Only the last top-level block can run to the end of the file. It never closed when its last line
// doesn't end it, which covers masked %% and $$ regions too.
function unclosedStart(doc: Node, masked: readonly Line[], contentStart: number): number | null {
	const last = doc.lastChild;
	if (!last) return null;
	const first = last.sourcepos[0][0] - 1;
	const lastLine = last.sourcepos[1][0] - 1;
	const opening = (masked[first] as Line).text;
	const closing = masked[lastLine]?.text ?? '';
	let closed = true;
	if (last.type === 'code_block' && last.info !== null) {
		closed = lastLine > first && closesFence(fenceRun(opening), closing);
	} else if (last.type === 'html_block') {
		// An HTML block's first line can also end it, as `<!-- note -->` does.
		const end = HTML_BLOCK_ENDS.find(([start]) => start.test(opening.trimStart()))?.[1];
		closed = end === undefined || end.test(closing);
	}
	return closed ? null : contentStart + first;
}

function* childrenOf(node: Node): Generator<Node> {
	for (let child = node.firstChild; child; child = child.next) yield child;
}

// Top-level blocks, with each list split into its items.
function* topLevelParts(doc: Node): Generator<Node> {
	for (let block = doc.firstChild; block; block = block.next) {
		if (block.type !== 'list') yield block;
		else for (let item = block.firstChild; item; item = item.next) yield item;
	}
}

// A setext heading's position starts at any link reference definitions its paragraph opened with.
// Parsed alone, its content lines give a paragraph whose start commonmark moves past them.
function headingContentStart(lines: readonly Line[], start: number, end: number): number {
	// An ATX heading is one line, and one content line leaves no room for a definition.
	if (end - start < 3) return start;
	const paragraph = new Parser().parse(joinLines(lines.slice(start, end - 1))).firstChild;
	return start + (paragraph ? paragraph.sourcepos[0][0] - 1 : 0);
}

function indentForNotes(lines: readonly Line[], titleLine: number, endLine: number, contentColumn: number): string {
	const firstNote = lines.slice(titleLine + 1, endLine).find((line) => !isBlank(line.text));
	const indent = firstNote ? (/^[ \t]*/.exec(firstNote.text) as RegExpExecArray)[0] : '';
	// A lazy line, indented less than the content column, can't lend its indent: written back after
	// the blank line below the title, it would leave the item. Nor can indented code, 4 columns or
	// more past it: every note written with that indent would become code.
	const column = columnOf(indent);
	if (firstNote && column >= contentColumn && column < contentColumn + 4) return indent;
	return contentColumn <= 4 ? '\t' : ' '.repeat(contentColumn);
}

// The column after `prefix`, with a tab moving to the next multiple of 4, as in CommonMark.
export function columnOf(prefix: string): number {
	let column = 0;
	for (const char of prefix) column = char === '\t' ? column + 4 - (column % 4) : column + 1;
	return column;
}

function trimBlankEnd(lines: readonly Line[], start: number, end: number): number {
	while (end > start && isBlank((lines[end - 1] as Line).text)) end--;
	return end;
}

export function nonBlankRuns(lines: readonly Line[], start: number, end: number): ListModel['untouched'] {
	const runs: ListModel['untouched'] = [];
	for (let i = start; i < end; i++) {
		if (isBlank((lines[i] as Line).text)) continue;
		const runStart = i;
		while (i < end && !isBlank((lines[i] as Line).text)) i++;
		runs.push({ start: runStart, end: i });
	}
	return runs;
}

export function isBlank(text: string): boolean {
	return /^[ \t]*$/.test(text);
}

// CommonMark's closing fence: the opening fence's character, at least as many, and nothing else.
function closesFence(open: string, text: string): boolean {
	const run = CLOSING_FENCE.exec(text)?.[1];
	return run !== undefined && run[0] === open[0] && run.length >= open.length;
}

function fenceRun(text: string): string {
	return LEADING_FENCE_RUN.exec(text)?.[1] ?? '';
}
