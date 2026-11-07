import { describe, expect, test } from 'vitest';
import { tagStripModeOf } from '../../src/core/tag-strip-mode';

describe('tagStripModeOf', () => {
	test.each(['always', 'filtering'])('keeps the choice %s', (stored) => {
		expect(tagStripModeOf(stored)).toBe(stored);
	});

	test.each([undefined, 'never', 1, null])('reads %s as always', (stored) => {
		expect(tagStripModeOf(stored)).toBe('always');
	});
});
