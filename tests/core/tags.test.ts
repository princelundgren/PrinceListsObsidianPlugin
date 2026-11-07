import { describe, expect, test } from 'vitest';
import { isTagBody, sameTag, tagBodyAt, tagOfTyped } from '../../src/core/tags';

describe('tagBodyAt', () => {
	test('reads letters, numbers, _ - / and marks', () => {
		expect(tagBodyAt('frozen rest')).toBe('frozen');
		expect(tagBodyAt('shop/frozen')).toBe('shop/frozen');
		expect(tagBodyAt('a_b-c')).toBe('a_b-c');
		const decomposed = 'café'.normalize('NFD');
		expect(tagBodyAt(decomposed)).toBe(decomposed);
	});

	test('reads emoji whole', () => {
		for (const emoji of ['🧊', '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}', '❄\uFE0F', '🇸🇪', 'frozen🧊']) {
			expect(tagBodyAt(emoji)).toBe(emoji);
		}
	});

	test('needs a character that isn\'t a number', () => {
		expect(tagBodyAt('1984')).toBeNull();
		expect(tagBodyAt('1984x')).toBe('1984x');
		expect(tagBodyAt('')).toBeNull();
		expect(tagBodyAt(' frozen')).toBeNull();
		expect(tagBodyAt('.x')).toBeNull();
		expect(tagBodyAt('\u200D\uFE0F')).toBeNull();
	});

	test('reads symbols outside ASCII, and stops at ASCII ones', () => {
		expect(tagBodyAt('a€b')).toBe('a€b');
		expect(tagBodyAt('20°')).toBe('20°');
		expect(tagBodyAt('a+b')).toBe('a');
		expect(tagBodyAt('a$')).toBe('a');
	});

	test('stops at punctuation', () => {
		expect(tagBodyAt('frozen.')).toBe('frozen');
		expect(tagBodyAt('frozen,pantry')).toBe('frozen');
		expect(tagBodyAt('frozen#x')).toBe('frozen');
		expect(tagBodyAt('frozen;')).toBe('frozen');
	});
});

describe('isTagBody', () => {
	test('is true only when the whole text is a tag body', () => {
		expect(isTagBody('shop/frozen')).toBe(true);
		expect(isTagBody('frozen pantry')).toBe(false);
	});
});

describe('sameTag', () => {
	test('ignores case only', () => {
		expect(sameTag('Frozen', 'frozen')).toBe(true);
		expect(sameTag('shop', 'shop/frozen')).toBe(false);
	});
});

describe('tagOfTyped', () => {
	test('trims and drops one leading #', () => {
		expect(tagOfTyped('#frozen')).toBe('frozen');
		expect(tagOfTyped(' frozen ')).toBe('frozen');
	});

	test('refuses text that isn\'t a tag body', () => {
		for (const typed of ['#', '# frozen', '1984', 'frozen pantry', '##frozen']) {
			expect(tagOfTyped(typed)).toBeNull();
		}
	});
});
