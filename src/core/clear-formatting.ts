import type { SyntaxNode } from '@lezer/common';
import type { FormatEdit } from './format';
import { obsidianMarkdown } from './obsidian-markdown';

interface Span {
	from: number;
	to: number;
}

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
 * part of one. Links, wikilinks, embeds, math, comments, list markers and escaped characters stay.
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
			if (ref.name === 'Paragraph') underlineOpens.length = 0;
			const markName = SPAN_MARKS[ref.name];
			if (markName && touches(ref)) marks.push(...ref.node.getChildren(markName));
			if (ref.name !== 'HTMLTag') return;
			const tag = text.slice(ref.from, ref.to).toLowerCase();
			if (tag === '<u>') underlineOpens.push(ref.node);
			const open = tag === '</u>' ? underlineOpens.pop() : undefined;
			if (open && touches({ from: open.from, to: ref.to })) marks.push(open, ref.node);
		},
	});
	return marks.map(({ from, to }) => ({ from, to })).sort((a, b) => a.from - b.from);
}

// Where `pos` lands once `marks` are gone; inside a mark, at the place the mark was.
function afterRemoving(marks: readonly Span[], pos: number): number {
	let removed = 0;
	for (const mark of marks) removed += Math.max(0, Math.min(mark.to, pos) - mark.from);
	return pos - removed;
}
