import { splitLines, type Line } from './lines';
import { isBlank } from './parse';

// The lines of what a field holds, without the blank lines at its end. A field saves on every
// keystroke, so an Enter at the end would otherwise leave a blank line outside the notes it typed.
export function typedLines(markdown: string): string[] {
	const texts = splitLines(markdown).map((line) => line.text);
	while (texts.length > 0 && isBlank(texts[texts.length - 1] as string)) texts.pop();
	return texts;
}

// A new piece's field opens holding the empty line it's saved after, which the save writes itself.
const SEPARATOR_LINE = /^[ \t]*\n/;

export function holdsSeparatorLine(markdown: string): boolean {
	return SEPARATOR_LINE.test(markdown);
}

export function withoutSeparatorLine(markdown: string): string {
	return markdown.replace(SEPARATOR_LINE, '');
}

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
