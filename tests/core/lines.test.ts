import { expect, test } from 'vitest';
import { dominantEol, joinLines, lineIndexAt, spliceLines, splitLines } from '../../src/core/lines';

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
test('spliceLines gives a line that moves off the end the dominant ending, and the new last line the old one', () => {
	expect(joinLines(spliceLines(splitLines('a\nb'), 2, 0, [{ text: 'c', eol: '\n' }]))).toBe('a\nb\nc');
	expect(joinLines(spliceLines(splitLines('a\r\nb'), 1, 1, []))).toBe('a');
});
test('spliceLines ends a line that moves off the end of a CRLF file with CRLF, and of a lone-CR file with LF', () => {
	expect(joinLines(spliceLines(splitLines('a\r\nb'), 2, 0, [{ text: 'c', eol: '\r\n' }]))).toBe('a\r\nb\r\nc');
	expect(joinLines(spliceLines(splitLines('a\rb'), 2, 0, [{ text: 'c', eol: '\n' }]))).toBe('a\rb\nc');
	expect(joinLines(spliceLines(splitLines('a\nb\n'), 2, 0, [{ text: 'c', eol: '\n' }]))).toBe('a\nb\nc\n');
});
test('in a file without a final newline, spliceLines drops the empty lines an edit leaves at the end', () => {
	expect(joinLines(spliceLines(splitLines('a\n\nb'), 2, 1, []))).toBe('a');
	expect(joinLines(spliceLines(splitLines('a\r\n\r\nb'), 2, 1, []))).toBe('a');
	expect(joinLines(spliceLines(splitLines('a\n\n\n\tb'), 3, 1, []))).toBe('a');
	expect(joinLines(spliceLines(splitLines('a\nb'), 2, 0, [{ text: '', eol: '\n' }]))).toBe('a\nb');
});
test('spliceLines keeps a whitespace-only last line, which writes its spaces, and empty last lines in a file that ends with a newline', () => {
	expect(joinLines(spliceLines(splitLines('a\n\n \n\tb'), 3, 1, []))).toBe('a\n\n ');
	expect(joinLines(spliceLines(splitLines('a\nb\n  '), 0, 1, [{ text: 'c', eol: '\n' }]))).toBe('c\nb\n  ');
	expect(joinLines(spliceLines(splitLines('a\n\nb\n'), 2, 1, []))).toBe('a\n\n');
});
