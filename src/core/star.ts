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

// Only the title changes: the ✔ marks and the tail after it stay as written, spacing included.
export function setStar(line: string, starred: boolean): string {
	const parts = parseItemLine(line);
	if (!parts) return line;
	const { plain, star } = splitStar(parts.title);
	if (starred === (star !== '')) return line;
	return joinItemLine({ ...parts, title: starred ? parts.title + STAR : plain });
}

// The title field shows the title without its star, so saving puts the saved star back, once.
export function keepStar(savedTitle: string, typed: string): string {
	const { star } = splitStar(savedTitle);
	return star === '' ? typed : splitStar(typed).plain + star;
}
