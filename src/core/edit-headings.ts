import { blockKey, blockKeys, replaceRun, sameBlocks } from './edit-check';
import { gapEnd, hasLineBreak, isBlankAt } from './edit-lines';
import { dominantEol, spliceLines, type Line } from './lines';
import type { ItemBlock, ListModel, Section } from './parse';

// An ATX heading's opening: up to 3 spaces of indent and the # run, then a space, a tab or the end.
const ATX_OPENING = /^ {0,3}#{1,6}(?=[ \t]|$)/;

export function insertHeading(
	lines: readonly Line[],
	model: ListModel,
	at: { afterItem: ItemBlock } | { afterSection: Section },
	text: string,
): { lines: Line[]; headingLine: number } {
	if (hasLineBreak(text)) throw new Error('A heading must be a single line');
	const headingLine = 'afterItem' in at ? at.afterItem.endLine : at.afterSection.endLine;
	const line = { text: text === '' ? '##' : `## ${text}`, eol: dominantEol(lines) };
	const added = [blockKey('heading', [line.text])];
	return { lines: replaceRun(lines, model, headingLine, headingLine, [line], { added }), headingLine };
}

// The section's items join the section above. As for deleteItem, a heading between two gaps takes
// the gap after it, so no double blank line is left.
export function deleteHeading(lines: readonly Line[], model: ListModel, section: Section): Line[] {
	const { at, heading } = findHeading(lines, model, section);
	const end = isBlankAt(lines, at - 1) ? gapEnd(lines, heading.end) : heading.end;
	return replaceRun(lines, model, at, end, [], { removed: [heading.key] });
}

// Whether the result is still this heading can depend on the lines above it: a setext heading's text
// indented to the content column of an item above joins that item. So, as for the other edits, the
// file is parsed again and every block compared. A setext heading's link reference definitions stay.
export function setHeadingText(
	lines: readonly Line[],
	model: ListModel,
	section: Section,
	text: string,
): Line[] | null {
	if (hasLineBreak(text)) return null;
	const { at, heading, blocks } = findHeading(lines, model, section);
	const own = lines[at] as Line;
	const atx = splitAtx(own.text);
	let rewritten = text;
	if (atx) {
		// `##` gets one space before new text, and none before an empty one, which writes it back as it was.
		const gap = atx.gap === '' && text !== '' ? ' ' : atx.gap;
		rewritten = atx.open + gap + text + atx.close;
		if (splitAtx(rewritten)?.content !== text) return null;
	}
	// The run ends at the setext underline, which stays.
	const end = atx ? at + 1 : heading.end - 1;
	const edited = spliceLines(lines, at, end - at, [{ text: rewritten, eol: own.eol }]);
	const texts = (from: number, to: number) => lines.slice(from, to).map((line) => line.text);
	const added = blockKey('heading', [...texts(heading.start, at), rewritten, ...texts(end, heading.end)]);
	const expected = blocks.map((b) => (b === heading ? added : b.key));
	return sameBlocks(blockKeys(edited, model.contentStart), expected) ? edited : null;
}

function findHeading(lines: readonly Line[], model: ListModel, section: Section) {
	const at = section.headingLine;
	const blocks = blockKeys(lines, model.contentStart);
	const heading = blocks.find((b) => at !== null && b.start <= at && at < b.end);
	if (at === null || heading?.type !== 'heading') throw new Error('The section has no heading here; parse the lines again');
	return { at, heading, blocks };
}

// Splits an ATX heading's line around its raw content, with commonmark.js's closing-sequence pattern:
// the indent and # run, the spaces before the content, and any closing sequence with the spaces
// around it. `after` is empty or starts with a space or tab, so an empty heading's closing sequence,
// as in `## #`, matches that pattern too.
function splitAtx(text: string): { open: string; gap: string; content: string; close: string } | null {
	const open = ATX_OPENING.exec(text)?.[0];
	if (open === undefined) return null;
	const after = text.slice(open.length);
	const inner = after.replace(/[ \t]+#+[ \t]*$/, '');
	const gap = (/^[ \t]*/.exec(inner) as RegExpExecArray)[0];
	const content = inner.slice(gap.length).replace(/[ \t]+$/, '');
	return { open, gap, content, close: after.slice(gap.length + content.length) };
}
