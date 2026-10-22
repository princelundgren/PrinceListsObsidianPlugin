import { parseItemLine } from './item-line';
import { splitLines } from './lines';

// Whether a non-blank line of what was typed in a card's title or notes isn't in the file's text any
// more. A line counts only as a whole line, trimmed, and a title only as an item's title.
export function missingTyping(text: string, typed: string, field: 'title' | 'notes'): boolean {
	const lines = splitLines(text).map((line) => line.text);
	const present = new Set(field === 'title' ? lines.map((line) => parseItemLine(line)?.title.trim()) : lines.map((line) => line.trim()));
	return splitLines(typed)
		.map((line) => line.text.trim())
		.some((line) => line !== '' && !present.has(line));
}
