import { describe, expect, test } from 'vitest';
import { themeColorOf } from '../../src/core/theme-color';

describe('themeColorOf', () => {
	test('keeps a stored choice', () => {
		expect(themeColorOf('blue', 'none')).toBe('blue');
		expect(themeColorOf('none', 'yellow')).toBe('none');
	});

	test.each([undefined, 'crimson', 1, null])('reads %s as the fallback', (stored) => {
		expect(themeColorOf(stored, 'yellow')).toBe('yellow');
	});
});
