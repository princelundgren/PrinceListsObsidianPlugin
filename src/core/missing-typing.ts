import { parseItemLine } from './item-line';
import { splitLines } from './lines';
import { splitStar } from './star';

// Whether a non-blank line of what was typed in a card's title or notes isn't in the file's text any
// more. A line counts only as a whole line, trimmed, and a title only as an item's title.
export function missingTyping(text: string, typed: string, field: 'title' | 'notes'): boolean {
	const lines = splitLines(text).map((line) => line.text);
	const isPresent = field === 'title'
		? (typedLine: string) => lines.some((line) => isItemTitle(line, typedLine))
		: (typedLine: string) => lines.some((line) => line.trim() === typedLine);
	return splitLines(typed)
		.map((line) => line.text.trim())
		.some((line) => line !== '' && !isPresent(line));
}

// A #tag or Tasks field typed at the end of a title reads as the item's tail, so a typed title also
// counts when it is the whole title, star aside, followed by the start of the tail; a tick's ✔ mark
// between them is left out.
function isItemTitle(line: string, typed: string): boolean {
	const parts = parseItemLine(line);
	if (!parts) return false;
	const title = splitStar(parts.title).plain.trim();
	if (title === typed) return true;
	const rest = title + parts.tail;
	return typed.length > title.length && rest.startsWith(typed) && /^(\s|$)/.test(rest.slice(typed.length));
}

// The notice for a field whose line went: copy what was typed, or try again for a field emptied by
// hand. An untouched field lost nothing.
export function lostFieldNotice(typed: string, opened: string): 'none' | 'retry' | 'copy' {
	if (typed === opened) return 'none';
	return typed.trim() === '' ? 'retry' : 'copy';
}
