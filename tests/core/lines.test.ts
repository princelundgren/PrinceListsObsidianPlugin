import { expect, test } from 'vitest';
import { dominantEol, joinLines, lineIndexAt, splitLines } from '../../src/core/lines';

test('round-trips every line-ending shape byte for byte', () => {
	for (const t of ['', 'a', 'a\n', 'a\r\nb\r\n', 'a\nb\r\nc\rd', '\n\n', 'x\n\n']) {
		expect(joinLines(splitLines(t))).toBe(t);
	}
});
test('keeps NFD text untouched', () => {
	const nfd = 'Crème brûlée à la carte'.normalize('NFD');
	expect(joinLines(splitLines(nfd + '\n'))).toBe(nfd + '\n');
});
test('splitLines records the missing final newline', () => {
	expect(splitLines('a\nb')).toEqual([{ text: 'a', eol: '\n' }, { text: 'b', eol: '' }]);
});
test('dominantEol picks CRLF for a CRLF file and LF when there are no endings', () => {
	expect(dominantEol(splitLines('a\r\nb\r\nc\n'))).toBe('\r\n');
	expect(dominantEol(splitLines('a'))).toBe('\n');
});
test('lineIndexAt maps a character offset to its line', () => {
	expect(lineIndexAt('ab\ncd\nef', 4)).toBe(1);
	expect(lineIndexAt('---\nx: 1\n---\nbody', 13)).toBe(3);
	expect(lineIndexAt('---\nx: 1\n---', 12)).toBe(3); // an offset at the end maps past the last line
});
test('splitLines reads \\r\\n as one ending, not \\r then \\n', () => {
	expect(splitLines('a\r\nb')).toEqual([{ text: 'a', eol: '\r\n' }, { text: 'b', eol: '' }]);
});
test('splitLines handles lone and mixed carriage returns', () => {
	expect(splitLines('\r')).toEqual([{ text: '', eol: '\r' }]);
	expect(splitLines('\r\r\n')).toEqual([{ text: '', eol: '\r' }, { text: '', eol: '\r\n' }]);
	expect(splitLines('\n\r')).toEqual([{ text: '', eol: '\n' }, { text: '', eol: '\r' }]);
	expect(splitLines('a\r')).toEqual([{ text: 'a', eol: '\r' }]);
	for (const t of ['\r', '\r\r\n', '\n\r', 'a\r']) {
		expect(joinLines(splitLines(t))).toBe(t);
	}
});
test('lineIndexAt keeps an offset between \\r and \\n on that line', () => {
	expect(lineIndexAt('a\r\nb', 2)).toBe(0);
	expect(lineIndexAt('a\r\nb', 3)).toBe(1);
});
