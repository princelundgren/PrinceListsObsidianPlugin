import { joinItemLine, parseItemLine } from './item-line';

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
	if (!starred) return joinItemLine({ ...parts, title: plain });
	const tail = parts.tail.startsWith('#') ? ` ${parts.tail}` : parts.tail;
	return joinItemLine({ ...parts, title: parts.title + STAR, tail });
}

// The title field shows the title without its star, so saving puts the saved star back, once.
export function keepStar(savedTitle: string, typed: string): string {
	const { star } = splitStar(savedTitle);
	return star === '' ? typed : splitStar(typed).plain + star;
}
