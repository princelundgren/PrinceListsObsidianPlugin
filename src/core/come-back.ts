import { untickChecklist } from './checklist';
import { NO_LINES_MOVED, type OwnEdit } from './follow';
import { joinLines, splitLines } from './lines';
import { parseList } from './parse';
import { comeBack } from './repeat-line';

/**
 * `text` with every done repeating item due by `now` written back open and its notes' checklist
 * unticked; null when none is. Every due item counts, hidden ones included.
 * No line is added or removed, so the parsed items stay valid.
 */
export function planComeBacks(
	text: string,
	contentStart: number,
	now: Date,
): { next: string; count: number } | null {
	let lines = splitLines(text);
	let count = 0;
	for (const item of parseList(lines, contentStart).sections.flatMap((section) => section.items)) {
		const title = lines[item.titleLine];
		const back = title ? comeBack(title.text, now) : null;
		if (!title || back === null) continue;
		lines = untickChecklist(lines, item);
		lines[item.titleLine] = { text: back, eol: title.eol };
		count++;
	}
	return count === 0 ? null : { next: joinLines(lines), count };
}

/**
 * The edit planComeBacks at `now` makes, for a view whose card is open on `selected`: the card's title
 * field makes the same change to the line it saved, as for a tick (see syncTitleField). No line moves.
 */
export function comeBackEdit(selected: number | null, now: Date): OwnEdit {
	if (selected === null) return NO_LINES_MOVED;
	return { start: selected, delta: 0, kind: 'change', retitle: (line) => comeBack(line, now) ?? line };
}
