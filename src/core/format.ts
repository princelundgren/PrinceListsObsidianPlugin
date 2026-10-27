import { codeBlock, toggleLineFormat, type LineFormat } from './format-lines';

export type Format = 'bold' | 'italic' | 'code' | 'link' | 'codeBlock' | 'table' | LineFormat;

/** Replace `from`..`to` with `insert`, then select `selectionStart`..`selectionEnd` in the new text. */
export interface FormatEdit {
	from: number;
	to: number;
	insert: string;
	selectionStart: number;
	selectionEnd: number;
}

const TABLE_HEADER = 'Column 1';
const TABLE = `| ${TABLE_HEADER} | Column 2 |\n| --- | --- |\n|  |  |`;

// What Cmd+B, Cmd+I, Cmd+K and the card's format bar do to a field's text, as in a note.
export function formatSelection(text: string, start: number, end: number, format: Format): FormatEdit {
	switch (format) {
		case 'bold':
			return toggleStars(text, start, end, 2);
		case 'italic':
			return toggleStars(text, start, end, 1);
		case 'code':
			return toggleCode(text, start, end);
		case 'link':
			return link(text, start, end);
		case 'codeBlock':
			return codeBlock(text, start, end);
		case 'table':
			return table(text, start);
		case 'bulleted':
		case 'numbered':
		case 'checklist':
			return toggleLineFormat(text, start, end, format);
	}
}

// In a run of stars around the selection, two or more mean bold and an odd count means italic.
function toggleStars(text: string, start: number, end: number, size: 1 | 2): FormatEdit {
	[start, end] = insideMarkers(text, ...trimmed(text, start, end), '*');
	const run = Math.min(markersBefore(text, start, '*'), markersAfter(text, end, '*'));
	const isOn = size === 2 ? run >= 2 : run % 2 === 1;
	const selected = text.slice(start, end);
	if (isOn) return { from: start - size, to: end + size, insert: selected, selectionStart: start - size, selectionEnd: end - size };
	const marker = '*'.repeat(size);
	return { from: start, to: end, insert: marker + selected + marker, selectionStart: start + size, selectionEnd: end + size };
}

function toggleCode(text: string, start: number, end: number): FormatEdit {
	[start, end] = insideMarkers(text, ...trimmed(text, start, end), '`');
	const selected = text.slice(start, end);
	if (text[start - 1] === '`' && text[end] === '`') {
		return { from: start - 1, to: end + 1, insert: selected, selectionStart: start - 1, selectionEnd: end - 1 };
	}
	return { from: start, to: end, insert: '`' + selected + '`', selectionStart: start + 1, selectionEnd: end + 1 };
}

// Markers inside the spaces at a selection's ends, where `** word **` wouldn't render as bold.
function trimmed(text: string, start: number, end: number): [number, number] {
	while (start < end && /\s/.test(text[start] ?? '')) start++;
	while (end > start && /\s/.test(text[end - 1] ?? '')) end--;
	return [start, end];
}

// A selection that takes in its own markers, as a drag or a triple-click does, stands for the text
// inside them, unless that text holds the marker too, as two bold spans do.
function insideMarkers(text: string, start: number, end: number, marker: string): [number, number] {
	const run = Math.min(markersAfter(text, start, marker), markersBefore(text, end, marker));
	if (run === 0 || end - start <= 2 * run || text.slice(start + run, end - run).includes(marker)) return [start, end];
	return [start + run, end - run];
}

function markersBefore(text: string, at: number, marker: string): number {
	let count = 0;
	while (text[at - count - 1] === marker) count++;
	return count;
}

function markersAfter(text: string, at: number, marker: string): number {
	let count = 0;
	while (text[at + count] === marker) count++;
	return count;
}

function link(text: string, start: number, end: number): FormatEdit {
	const selected = text.slice(start, end);
	const caret = selected === '' ? start + 1 : start + selected.length + 3;
	return { from: start, to: end, insert: `[${selected}]()`, selectionStart: caret, selectionEnd: caret };
}

// In place of a blank line, else on new lines after the caret's line, a blank line apart from any
// text around it so it isn't read as part of a paragraph.
function table(text: string, at: number): FormatEdit {
	const lineStart = text.slice(0, at).lastIndexOf('\n') + 1;
	const next = text.indexOf('\n', at);
	const lineEnd = next < 0 ? text.length : next;
	const nextLine = next < 0 ? null : text.slice(next + 1).split('\n', 1)[0] ?? '';
	const after = nextLine !== null && nextLine.trim() !== '' ? '\n' : '';
	const isBlank = text.slice(lineStart, lineEnd).trim() === '';
	const lineBefore = lineStart === 0 ? null : text.slice(0, lineStart - 1).split('\n').pop() ?? '';
	const before = !isBlank ? '\n\n' : lineBefore !== null && lineBefore.trim() !== '' ? '\n' : '';
	const from = isBlank ? lineStart : lineEnd;
	const selectionStart = from + before.length + 2;
	return { from, to: lineEnd, insert: before + TABLE + after, selectionStart, selectionEnd: selectionStart + TABLE_HEADER.length };
}
