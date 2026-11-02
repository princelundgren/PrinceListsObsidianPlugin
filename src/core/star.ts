import { joinItemLine, parseItemLine, setTitle, type ItemLineParts } from './item-line';

const STAR = ' ⭐';
// A star counts only after a space, so `5⭐` is a title, not a starred `5`.
const TRAILING_STAR = / ⭐️?$/;

export function splitStar(title: string): { plain: string; star: string } {
	const star = TRAILING_STAR.exec(title)?.[0] ?? '';
	return { plain: title.slice(0, title.length - star.length), star };
}

export function isStarred(line: string): boolean {
	const title = parseItemLine(line)?.title;
	return title !== undefined && splitStar(title).star !== '';
}

// Only the title changes: the ✔ marks and the tail after it stay as written, spacing included,
// except that a tag the star would touch gets the space a tag needs.
export function setStar(line: string, starred: boolean): string {
	const parts = parseItemLine(line);
	if (!parts) return line;
	const { plain, star } = splitStar(parts.title);
	if (starred === (star !== '')) return line;
	return starred ? withStar(parts, STAR) : joinItemLine({ ...parts, title: plain });
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

function withStar(parts: ItemLineParts, star: string): string {
	const tail = parts.tail.startsWith('#') ? ` ${parts.tail}` : parts.tail;
	return joinItemLine({ ...parts, title: parts.title + star, tail });
}
