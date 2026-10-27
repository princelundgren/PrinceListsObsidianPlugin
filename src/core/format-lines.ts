import type { FormatEdit } from './format';

export type LineFormat = 'bulleted' | 'numbered' | 'checklist';

const LIST_MARKER = /^(\s*)((?:[-*+]|\d+[.)])[ \t]+)(\[[^\]]\](?:[ \t]+|$))?/;
const BULLET = /^[-*+]/;
const FENCE = '```';

interface Lines {
	from: number;
	to: number;
	lines: string[];
}

// Each selected line that isn't blank becomes an item of that kind, or, when every one already is,
// a plain line again. A checklist keeps a list marker a line has; the other two replace it.
export function toggleLineFormat(text: string, start: number, end: number, format: LineFormat): FormatEdit {
	const { from, to, lines } = selectedLines(text, start, end);
	const isFilled = (line: string) => line.trim() !== '' || lines.length === 1;
	const isOn = lines.filter(isFilled).every((line) => hasFormat(line, format));
	let number = 0;
	const changed = lines.map((line) => {
		if (!isFilled(line)) return line;
		if (isOn) return plainLine(line);
		if (format === 'checklist') return checklistLine(line);
		number++;
		return withMarker(line, format === 'bulleted' ? '- ' : `${number}. `);
	});
	return replaceLines(start, end, { from, to, lines }, changed);
}

// The selected lines between fences, or, on blank lines, an empty block with the caret inside.
export function codeBlock(text: string, start: number, end: number): FormatEdit {
	const { from, to, lines } = selectedLines(text, start, end);
	if (lines.every((line) => line.trim() === '')) {
		const caret = from + FENCE.length + 1;
		return { from, to, insert: `${FENCE}\n\n${FENCE}`, selectionStart: caret, selectionEnd: caret };
	}
	const shift = FENCE.length + 1;
	return { from, to, insert: `${FENCE}\n${lines.join('\n')}\n${FENCE}`, selectionStart: start + shift, selectionEnd: end + shift };
}

// The lines the selection touches, without the one a selection ends at the start of.
function selectedLines(text: string, start: number, end: number): Lines {
	const from = text.slice(0, start).lastIndexOf('\n') + 1;
	const last = end > start && text[end - 1] === '\n' ? end - 1 : end;
	const lineEnd = text.indexOf('\n', last);
	const to = lineEnd < 0 ? text.length : lineEnd;
	return { from, to, lines: text.slice(from, to).split('\n') };
}

// Keeps the selection on the same text: its start moves with the first line's prefix, its end with
// everything before it.
function replaceLines(start: number, end: number, old: Lines, changed: string[]): FormatEdit {
	const insert = changed.join('\n');
	const firstDelta = (changed[0]?.length ?? 0) - (old.lines[0]?.length ?? 0);
	const selectionStart = Math.max(old.from, start + firstDelta);
	const selectionEnd = Math.max(selectionStart, end + insert.length - (old.to - old.from));
	return { from: old.from, to: old.to, insert, selectionStart, selectionEnd };
}

function hasFormat(line: string, format: LineFormat): boolean {
	const match = LIST_MARKER.exec(line);
	if (!match) return false;
	if (format === 'checklist') return match[3] !== undefined;
	return match[3] === undefined && BULLET.test(match[2] ?? '') === (format === 'bulleted');
}

function checklistLine(line: string): string {
	const match = LIST_MARKER.exec(line);
	if (match?.[3] !== undefined) return line;
	if (!match) return withMarker(line, '- [ ] ');
	const head = (match[1] ?? '') + (match[2] ?? '');
	return head + '[ ] ' + line.slice(head.length);
}

function withMarker(line: string, marker: string): string {
	const indent = /^\s*/.exec(line)?.[0] ?? '';
	return indent + marker + plainLine(line).slice(indent.length);
}

function plainLine(line: string): string {
	const match = LIST_MARKER.exec(line);
	return match ? (match[1] ?? '') + line.slice(match[0].length) : line;
}
