import { splitLines } from './lines';

// Whether a non-blank line of what was typed in a field is not in the file's text any more.
export function missingTyping(text: string, typed: string): boolean {
	return splitLines(typed)
		.map((line) => line.text.trim())
		.some((line) => line !== '' && !text.includes(line));
}
