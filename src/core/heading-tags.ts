import { headingText } from './display';
import { setHeadingText } from './edit-headings';
import { ownEdit } from './follow';
import type { TagChange } from './group-menu';
import type { HeadingSave } from './heading-field';
import { inlineTags } from './item-tags';
import { joinLines, splitLines } from './lines';
import { parseList } from './parse';
import { isTagBody, sameTag } from './tags';

interface EndTag {
	tag: string;
	/** Where the whitespace before it starts in the text. */
	from: number;
	/** Where its word ends in the text. */
	to: number;
}

// The tags closing `text`, last first. A word counts only when the renderer draws it as a tag, so one
// in code or a link doesn't.
function closingTags(text: string): EndTag[] {
	const drawn = inlineTags(text);
	const tags: EndTag[] = [];
	let before = text.trimEnd();
	for (;;) {
		const word = /(?:^|\s)#(\S+)$/.exec(before)?.[1];
		if (!word || !isTagBody(word) || !drawn.some((tag) => sameTag(tag, word))) break;
		const to = before.length;
		before = before.slice(0, to - word.length - 1).trimEnd();
		tags.push({ tag: word, from: before.length, to });
	}
	return tags;
}

/** The tags at the end of a heading's text, after its last word that isn't a tag, once each by sameTag. */
export function headingEndTags(text: string): string[] {
	const tags = closingTags(text).map(({ tag }) => tag).reverse();
	return tags.filter((tag, i) => tags.findIndex((other) => sameTag(other, tag)) === i);
}

/**
 * Adds `#tag` at the end of the heading on `line`, or removes every spelling of it from the end with
 * the whitespace before each, keeping the rest of the text as it was. `none`: nothing to change.
 * `lost`: no heading on `line`. `refused`: the result wouldn't come back as this heading, or would
 * leave it with no text.
 */
export function planHeadingTag(text: string, contentStart: number, line: number, change: TagChange, tag: string): HeadingSave {
	const lines = splitLines(text);
	const model = parseList(lines, contentStart);
	const section = model.sections.find((s) => s.headingLine === line);
	if (!section) return { kind: 'lost' };
	const before = headingText(lines, line);
	const after = change === 'addTag' ? withTag(before, tag) : withoutTag(before, tag);
	if (after === null) return { kind: 'none' };
	const edited = after === '' ? null : setHeadingText(lines, model, section, after);
	if (!edited || headingText(edited, line) !== after) return { kind: 'refused' };
	const next = joinLines(edited);
	return { kind: 'write', next, line, edit: ownEdit(line, text, next, 'change') };
}

function withTag(text: string, tag: string): string | null {
	if (!isTagBody(tag) || inlineTags(text).some((have) => sameTag(have, tag))) return null;
	return text === '' ? `#${tag}` : `${text} #${tag}`;
}

// Takes each spelling with the whitespace before it, last first so earlier positions hold. A tag that
// opened the text leaves the space after it at the start, which the heading's text never has.
function withoutTag(text: string, tag: string): string | null {
	const gone = closingTags(text).filter((end) => sameTag(end.tag, tag));
	if (gone.length === 0) return null;
	return gone.reduce((kept, { from, to }) => kept.slice(0, from) + kept.slice(to), text).trimStart();
}
