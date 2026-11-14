import { untickChecklist } from './checklist';
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
