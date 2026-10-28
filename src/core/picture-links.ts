import { blockKey, blockKeys, replaceRun } from './edit-check';
import { notesStartLine } from './edit-items';
import type { RunEdit } from './follow';
import { joinLines, splitLines, type Line } from './lines';
import type { PlannedLineEdit } from './list-actions';
import { isBlank, itemAt, parseList, type ListModel } from './parse';
import { PICTURE_EXTENSIONS } from './picture';

/** A link that shows a picture from the vault: its line, its columns [from, to) and the path it links. */
export interface PictureLink {
	line: number;
	from: number;
	to: number;
	linkpath: string;
}

/** A picture's link as the menu found it: its file line, that line's text then, and its columns. */
export interface PictureLinkAt {
	line: number;
	lineText: string;
	from: number;
	to: number;
}

const WIKI_EMBED = /!\[\[([^\]|#]+)[^\]]*\]\]/g;
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * The picture links in `texts`, a run of lines, in reading order: `![[…]]` and `![…](…)` embeds of a
 * file with a picture's extension. Embedded notes, other files and pictures from the web aren't
 * counted, as Obsidian doesn't draw them as a vault picture. Links in code are counted too, so a
 * caller lines them up with the drawn pictures before trusting one.
 */
export function pictureLinks(texts: readonly string[]): PictureLink[] {
	const links: PictureLink[] = [];
	texts.forEach((text, line) => {
		for (const pattern of [WIKI_EMBED, MARKDOWN_IMAGE]) {
			for (const match of text.matchAll(pattern)) {
				const linkpath = linkpathOf(pattern, match[1] ?? '');
				if (linkpath !== null) links.push({ line, from: match.index, to: match.index + match[0].length, linkpath });
			}
		}
	});
	return links.sort((a, b) => a.line - b.line || a.from - b.from);
}

function linkpathOf(pattern: RegExp, raw: string): string | null {
	let linkpath = raw.trim();
	if (pattern === MARKDOWN_IMAGE) {
		if (linkpath.startsWith('<')) linkpath = linkpath.slice(1, -1);
		if (URL_SCHEME.test(linkpath)) return null;
		try {
			linkpath = decodeURIComponent(linkpath);
		} catch {
			// A stray % reads as written.
		}
	}
	const extension = linkpath.slice(linkpath.lastIndexOf('.') + 1).toLowerCase();
	return linkpath.includes('.') && PICTURE_EXTENSIONS.includes(extension) ? linkpath : null;
}

/**
 * Takes the picture link `at` out of the notes of the item at `notesOf`, or of the list note. A line
 * left empty goes, and so does an empty line next to it, so one empty line still separates the
 * blocks around it, and notes left empty leave none under the title. The list note keeps the empty
 * line before an item or heading that follows it. null when the line reads differently now or isn't
 * in those notes; throws UnsafeEditError when the rest of the list would read differently.
 */
export function planPictureRemove(text: string, contentStart: number, notesOf: number | 'listNote', at: PictureLinkAt): PlannedLineEdit | null {
	const lines = splitLines(text);
	const model = parseList(lines, contentStart);
	const notes = notesRange(lines, model, notesOf);
	const line = lines[at.line];
	if (!notes || !line || line.text !== at.lineText || at.line < notes.first || at.line >= notes.end) return null;
	// One space beside the link goes with it: the one before it after text, else the one after it,
	// as the indent before it isn't a space between words.
	const hasTextBefore = !isBlank(line.text.slice(0, at.from));
	const endsAtWordBreak = at.to === line.text.length || isSpaceAt(line.text, at.to);
	const from = hasTextBefore && isSpaceAt(line.text, at.from - 1) && endsAtWordBreak ? at.from - 1 : at.from;
	const to = !hasTextBefore && isSpaceAt(line.text, at.to) ? at.to + 1 : at.to;
	const rest = line.text.slice(0, from) + line.text.slice(to);
	const removed = isBlank(rest) ? linesToRemove(lines, at.line, notes, notesOf === 'listNote') : null;
	const start = removed?.start ?? at.line;
	const end = removed?.end ?? at.line + 1;
	const run = removed ? [] : [{ text: rest, eol: line.eol }];
	const edited = replaceRun(lines, model, start, end, run, guardKeys(lines, model, notes, start, end, run));
	const edit: RunEdit = { start, delta: edited.length - lines.length, kind: removed ? 'delete' : 'change' };
	return { next: joinLines(edited), edit };
}

interface NotesRange {
	// The line after the title, or the list note's first line.
	top: number;
	// The first line of the notes themselves.
	first: number;
	end: number;
	item: { start: number; end: number } | null;
}

function notesRange(lines: readonly Line[], model: ListModel, notesOf: number | 'listNote'): NotesRange | null {
	if (notesOf === 'listNote') return { top: model.contentStart, first: model.listNote.start, end: model.listNote.end, item: null };
	const item = itemAt(model, notesOf);
	if (!item) return null;
	return { top: item.titleLine + 1, first: notesStartLine(lines, item), end: item.endLine, item: { start: item.titleLine, end: item.endLine } };
}

function linesToRemove(lines: readonly Line[], line: number, notes: NotesRange, isListNote: boolean): { start: number; end: number } {
	const blankAbove = line - 1 >= notes.top && isBlankLine(lines, line - 1);
	const blankBelow = isBlankLine(lines, line + 1);
	// Under a card's title, the empty line below is what keeps the next block from joining the title.
	if (blankBelow && (blankAbove || (isListNote && line === notes.top))) return { start: line, end: line + 2 };
	if (blankAbove && !isListNote && line + 1 >= notes.end) return { start: line - 1, end: line + 1 };
	return { start: line, end: line + 1 };
}

// The blocks the edit may change: the item, or the list note's blocks, as they read before and after.
function guardKeys(lines: readonly Line[], model: ListModel, notes: NotesRange, start: number, end: number, run: Line[]) {
	const after = [...lines.slice(0, start), ...run, ...lines.slice(end)];
	const delta = after.length - lines.length;
	const { item } = notes;
	if (item) {
		const texts = (from: readonly Line[], to: number) => from.slice(item.start, to).map((line) => line.text);
		return { removed: [blockKey('item', texts(lines, item.end))], added: [blockKey('item', texts(after, item.end + delta))] };
	}
	const noteBlocks = blockKeys(lines, model.contentStart).filter((block) => block.start >= notes.first && block.end <= notes.end);
	return { removed: noteBlocks.map((block) => block.key), added: blockKeys(after.slice(notes.first, notes.end + delta), 0).map((block) => block.key) };
}

function isBlankLine(lines: readonly Line[], i: number): boolean {
	const line = lines[i];
	return line !== undefined && isBlank(line.text);
}

function isSpaceAt(text: string, i: number): boolean {
	return text[i] === ' ' || text[i] === '\t';
}
