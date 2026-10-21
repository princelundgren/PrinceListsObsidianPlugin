import { expect, test } from 'vitest';
import { guardedApply, mapLine } from '../../src/core/guard';
import { splitLines } from '../../src/core/lines';

test('mapLine keeps a line before the change, drops one inside it and shifts one after it', () => {
	const oldLines = splitLines('a\nb\nc\n');
	const newLines = splitLines('a\nx\ny\nc\n');
	expect(mapLine(oldLines, newLines, 0)).toBe(0);
	expect(mapLine(oldLines, newLines, 1)).toBeNull();
	expect(mapLine(oldLines, newLines, 2)).toBe(3);
});

test('mapLine compares lines by text, so a changed ending at the end of the file is no change', () => {
	expect(mapLine(splitLines('a'), splitLines('a\nb'), 0)).toBe(0);
});

test('mapLine never lets the common suffix overlap the common prefix', () => {
	const oldLines = splitLines('a\nb\na\nb\na\n');
	const newLines = splitLines('a\nb\na\n');
	expect(mapLine(oldLines, newLines, 2)).toBe(2);
	expect(mapLine(oldLines, newLines, 3)).toBeNull();
	expect(mapLine(oldLines, newLines, 4)).toBeNull();
});

test('guardedApply writes only over the text it expects', () => {
	expect(guardedApply('x', 'x', 'y')).toBe('y');
	expect(guardedApply('z', 'x', 'y')).toBe('z');
});
