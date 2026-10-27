import { parseItemLine } from './item-line';
import { splitLines } from './lines';
import { splitStar } from './star';

// Whether a non-blank line of what was typed in a card's title or notes isn't in the file's text any
// more. A line counts only as a whole line, trimmed, and a title only as an item's title.
export function missingTyping(text: string, typed: string, field: 'title' | 'notes'): boolean {
	const lines = splitLines(text).map((line) => line.text);
	const present = new Set(field === 'title' ? lines.map((line) => splitStar(parseItemLine(line)?.title ?? '').plain.trim()) : lines.map((line) => line.trim()));
	return splitLines(typed)
		.map((line) => line.text.trim())
		.some((line) => line !== '' && !present.has(line));
}

// The notice for a field whose line went: copy what was typed, or try again for a field emptied by
// hand. An untouched field lost nothing.
export function lostFieldNotice(typed: string, opened: string): 'none' | 'retry' | 'copy' {
	if (typed === opened) return 'none';
	return typed.trim() === '' ? 'retry' : 'copy';
}
