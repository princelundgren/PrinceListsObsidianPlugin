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
	/** The spelling in the text, with its `#`. */
	word: string;
}

// The tags closing `text`, last first, and where the text before them ends. A word counts only when
// the renderer draws it as a tag, so one in code or a link doesn't.
function closingTags(text: string): { tags: EndTag[]; before: string } {
	const drawn = inlineTags(text);
	const tags: EndTag[] = [];
	let before = text.trimEnd();
	for (;;) {
		const match = /(?:^|\s)(#\S+)$/.exec(before);
		const word = match?.[1];
		if (!match || !word || !isTagBody(word.slice(1)) || !drawn.some((tag) => sameTag(tag, word.slice(1)))) break;
		tags.push({ tag: word.slice(1), word });
		before = before.slice(0, match.index).trimEnd();
	}
	return { tags, before };
}

/** The tags at the end of a heading's text, after its last word that isn't a tag, once each by sameTag. */
export function headingEndTags(text: string): string[] {
	const tags = closingTags(text).tags.map(({ tag }) => tag).reverse();
	return tags.filter((tag, i) => tags.findIndex((other) => sameTag(other, tag)) === i);
}

/**
 * Adds `#tag` at the end of the heading on `line`, or removes every spelling of it from the end. `none`:
 * nothing to change. `lost`: no heading on `line`. `refused`: the result wouldn't come back as this
 * heading, or would leave it with no text.
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

function withoutTag(text: string, tag: string): string | null {
	const { tags, before } = closingTags(text);
	const kept = tags.filter((end) => !sameTag(end.tag, tag)).reverse();
	if (kept.length === tags.length) return null;
	return [before, ...kept.map(({ word }) => word)].filter((part) => part !== '').join(' ');
}
