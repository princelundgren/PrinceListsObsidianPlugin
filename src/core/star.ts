import { joinItemLine, parseItemLine, setTitle, type ItemLineParts } from './item-line';

const STAR = ' ⭐';
// A star counts only after a space, so `5⭐` is a title, not a starred `5`.
const TRAILING_STAR = / ⭐️?$/;
const TAG_FIRST = /^\s*#/;

export function splitStar(title: string): { plain: string; star: string } {
	const star = TRAILING_STAR.exec(title)?.[0] ?? '';
	return { plain: title.slice(0, title.length - star.length), star };
}

export function isStarred(line: string): boolean {
	const title = parseItemLine(line)?.title;
	return title !== undefined && splitStar(title).star !== '';
}

// Only the title changes, except with no title or ✔ mark and a tag first in the tail: starring always
// adds a space before the tail and unstarring takes one back, so the line comes back as it was.
export function setStar(line: string, starred: boolean): string {
	const parts = parseItemLine(line);
	if (!parts) return line;
	const { plain, star } = splitStar(parts.title);
	if (starred === (star !== '')) return line;
	const tagFirst = plain === '' && parts.end === '' && parts.marks === '' && TAG_FIRST.test(parts.tail);
	if (starred) return joinItemLine({ ...parts, title: parts.title + STAR, tail: tagFirst ? ` ${parts.tail}` : parts.tail });
	const tail = tagFirst && parts.tail.startsWith(' ') ? parts.tail.slice(1) : parts.tail;
	return joinItemLine({ ...parts, title: plain, tail });
}

/**
 * The line with its title set to `typed`, as `setTitle` sets it, and its star, if it had one, put back
 * once at the end of the new title. The title field shows the title without its star, and a `#tag` or
 * Tasks field typed at the end of the title stays the item's tail.
 */
export function setTitleKeepingStar(line: string, typed: string): string {
	const { star } = splitStar(parseItemLine(line)?.title ?? '');
	if (star === '') return setTitle(line, typed);
	const titled = setTitle(line, splitStar(typed).plain);
	const parts = parseItemLine(titled);
	return parts ? withStar({ ...parts, title: splitStar(parts.title).plain }, star) : titled;
}

// Puts back a star the line had, so it adds a space only where a tag would touch the star.
function withStar(parts: ItemLineParts, star: string): string {
	const tail = parts.tail.startsWith('#') ? ` ${parts.tail}` : parts.tail;
	return joinItemLine({ ...parts, title: parts.title + star, tail });
}
