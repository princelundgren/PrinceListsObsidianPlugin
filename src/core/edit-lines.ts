import type { Line } from './lines';
import { isBlank } from './parse';

// Text for a single line, such as a title or a heading: a line break in it would write a second line
// that nothing owns.
export function hasLineBreak(text: string): boolean {
	return /[\r\n]/.test(text);
}

export function gapEnd(lines: readonly Line[], start: number): number {
	let end = start;
	while (isBlankAt(lines, end)) end++;
	return end;
}

export function isBlankAt(lines: readonly Line[], i: number): boolean {
	const line = lines[i];
	return line !== undefined && isBlank(line.text);
}
