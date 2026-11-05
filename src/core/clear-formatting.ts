import type { SyntaxNode } from '@lezer/common';
import type { FormatEdit } from './format';
import { obsidianMarkdown } from './obsidian-markdown';

interface Span {
	from: number;
	to: number;
}

// The blocks whose text is read as inline Markdown, so an underline's tags pair only within one.
const INLINE_BLOCK = /^(?:Paragraph|Task|ATXHeading\d|SetextHeading\d|TableCell)$/;

// Each span Clear formatting removes, and the name of its marks.
const SPAN_MARKS: Record<string, string> = {
	Emphasis: 'EmphasisMark',
	StrongEmphasis: 'EmphasisMark',
	Strikethrough: 'StrikethroughMark',
	Highlight: 'HighlightMark',
	InlineCode: 'CodeMark',
};

/**
 * Removes the marks of every bold, italic, strikethrough, underline, highlight and inline code span
 * the selection touches, or the caret is inside, whole spans even where the selection takes in only
 * part of one. Links, wikilinks, embeds, tags, math, comments, list markers and escaped characters
 * stay, and so do the backticks of inline code whose text would read as Markdown without them.
 * The selection keeps its text; with nothing to clear, the edit changes nothing.
 */
export function clearFormatting(text: string, start: number, end: number): FormatEdit {
	const marks = marksToClear(text, start, end);
	if (marks.length === 0) return { from: start, to: start, insert: '', selectionStart: start, selectionEnd: end };
	const from = Math.min(start, ...marks.map((mark) => mark.from));
	const to = Math.max(end, ...marks.map((mark) => mark.to));
	let insert = '';
	let at = from;
	for (const mark of marks) {
		insert += text.slice(at, mark.from);
		at = mark.to;
	}
	insert += text.slice(at, to);
	return { from, to, insert, selectionStart: afterRemoving(marks, start), selectionEnd: afterRemoving(marks, end) };
}

function marksToClear(text: string, start: number, end: number): Span[] {
	const touches = (span: Span) => span.from < end && span.to > start;
	const marks: Span[] = [];
	const underlineOpens: SyntaxNode[] = [];
	obsidianMarkdown.parse(text).iterate({
		enter: (ref) => {
			if (INLINE_BLOCK.test(ref.name)) underlineOpens.length = 0;
			const markName = SPAN_MARKS[ref.name];
			if (markName && touches(ref) && !keepsBackticks(text, ref.node)) marks.push(...ref.node.getChildren(markName));
			if (ref.name !== 'HTMLTag') return;
			const tag = text.slice(ref.from, ref.to).toLowerCase();
			if (tag === '<u>') underlineOpens.push(ref.node);
			const open = tag === '</u>' ? underlineOpens.pop() : undefined;
			if (open && touches({ from: open.from, to: ref.to })) marks.push(open, ref.node);
		},
	});
	return marks.map(({ from, to }) => ({ from, to })).sort((a, b) => a.from - b.from);
}

// Characters Markdown or Obsidian may read as a mark, an entity, a tag or a link, with the text around them.
const MARKUP_CHARACTER = /[*_~=$%<&[#`\\]/;

// Inline code keeps its backticks when its text, with the rest of the word it's in, would read as more
// than plain text without them.
function keepsBackticks(text: string, node: SyntaxNode): boolean {
	if (node.name !== 'InlineCode') return false;
	const { firstChild: open, lastChild: close } = node;
	if (!open || !close) return false;
	const before = text.slice(0, node.from).replace(/^.*\s/s, '');
	const after = text.slice(node.to).replace(/\s.*$/s, '');
	const word = before + text.slice(open.to, close.from) + after;
	if (MARKUP_CHARACTER.test(word)) return true;
	let readsAsMarkdown = false;
	obsidianMarkdown.parse(word).iterate({
		enter: (ref) => {
			readsAsMarkdown ||= ref.name !== 'Document' && ref.name !== 'Paragraph';
		},
	});
	return readsAsMarkdown;
}

// Where `pos` lands once `marks` are gone; inside a mark, at the place the mark was.
function afterRemoving(marks: readonly Span[], pos: number): number {
	let removed = 0;
	for (const mark of marks) removed += Math.max(0, Math.min(mark.to, pos) - mark.from);
	return pos - removed;
}
