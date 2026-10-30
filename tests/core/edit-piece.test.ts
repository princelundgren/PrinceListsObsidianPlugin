import { describe, expect, test } from 'vitest';
import { mapPieceRange } from '../../src/core/edit-piece';
import { splitLines } from '../../src/core/lines';

describe('mapPieceRange', () => {
	const before = splitLines('a\n\none\ntwo\nthree\n');

	test('moves an empty new range with the line before it', () => {
		const after = splitLines('top\na\n\none\ntwo\nthree\n');
		expect(mapPieceRange(before, after, { start: 5, end: 5 })).toEqual({ start: 6, end: 6 });
	});

	test('loses a piece whose middle line changed', () => {
		const after = splitLines('a\n\none\nTWO\nthree\n');
		expect(mapPieceRange(before, after, { start: 2, end: 5 })).toBeNull();
	});
});
