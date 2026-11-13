import { findRunStart, joinItemLine, parseItemLine, splitTail, tailFields } from './item-line';
import { itemTags } from './item-tags';
import { isTagBody, sameTag } from './tags';

const isWhitespace = (char: string) => /\s/.test(char);

/**
 * `line` with `#tag` at the end of its tail's fields, before the block ID and trailing whitespace.
 * `line` itself when `tag` isn't a tag body, the line isn't an item, or the item already has the
 * tag (in its title or its tail, in any letter case).
 */
export function addTag(line: string, tag: string): string {
	const parts = parseItemLine(line);
	if (!parts || !isTagBody(tag) || itemTags(line).tags.some((have) => sameTag(have, tag))) return line;
	const { fields, end } = splitTail(parts.tail);
	const hasNothingBeforeTag = (parts.title + parts.end + parts.marks + fields).length === 0;
	return joinItemLine({ ...parts, tail: `${fields}${hasNothingBeforeTag ? '' : ' '}#${tag}${end}` });
}

/**
 * `line` without its tail's `#tag` fields that are the same tag as `tag`, each with the whitespace
 * before it. A field glued to the next keeps that whitespace; the line's first content takes the
 * whitespace after it instead. Tags in the title stay.
 */
export function removeTag(line: string, tag: string): string {
	const parts = parseItemLine(line);
	if (!parts) return line;
	const { fields, end } = splitTail(parts.tail);
	let kept = '';
	let copied = 0;
	for (const { from, to } of tailFields(fields)) {
		if (fields.charAt(from) !== '#' || !sameTag(fields.slice(from + 1, to), tag)) continue;
		const runStart = findRunStart(fields, from, isWhitespace);
		const spaceEnd = to + fields.slice(to).search(/\S|$/);
		const isGlued = spaceEnd === to && to < fields.length;
		const startsAfterStatus = from === 0 && parts.title + parts.end + parts.marks === '';
		const spaceBeforeIsGone = copied > runStart;
		const takesSpaceAfter = !isGlued && (startsAfterStatus || spaceBeforeIsGone);
		kept += fields.slice(copied, isGlued || takesSpaceAfter ? from : runStart);
		copied = takesSpaceAfter ? spaceEnd : to;
	}
	return joinItemLine({ ...parts, tail: kept + fields.slice(copied) + end });
}
