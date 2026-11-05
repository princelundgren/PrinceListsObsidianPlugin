import { describe, expect, test } from 'vitest';
import { buttonPlatformsOf, showsOn, type ButtonPlatforms } from '../../src/core/button-platforms';

describe('showsOn', () => {
	test.each([
		['both', false, true],
		['both', true, true],
		['desktop', false, true],
		['desktop', true, false],
		['mobile', false, false],
		['mobile', true, true],
		['off', false, false],
		['off', true, false],
	])('%s on mobile %s shows: %s', (platforms, isMobile, expected) => {
		expect(showsOn(platforms as ButtonPlatforms, isMobile)).toBe(expected);
	});
});

describe('buttonPlatformsOf', () => {
	test.each([
		['both', 'off'],
		['desktop', 'both'],
		['mobile', 'both'],
		['off', 'both'],
	])('keeps the choice %s', (stored, fallback) => {
		expect(buttonPlatformsOf(stored, fallback as ButtonPlatforms)).toBe(stored);
	});

	test.each([undefined, null, '', 'Both', true, 1])('reads %s as the fallback', (stored) => {
		expect(buttonPlatformsOf(stored, 'off')).toBe('off');
	});
});
