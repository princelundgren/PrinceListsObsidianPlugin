import { splitLines } from './lines';

/** A row's line and that line's text, without its ending. */
export interface RowText {
	line: number;
	text: string;
}

/** Each of `lines` with its text in `text`; a line past the end reads as empty. */
export function rowTexts(text: string, lines: readonly number[]): RowText[] {
	const split = splitLines(text);
	return lines.map((line) => ({ line, text: split[line]?.text ?? '' }));
}

/** Whether `a` and `b` hold the same lines, in the same order, each with the same text. */
export function sameRowTexts(a: readonly RowText[], b: readonly RowText[]): boolean {
	return a.length === b.length && a.every((row, i) => row.line === b[i]?.line && row.text === b[i]?.text);
}
