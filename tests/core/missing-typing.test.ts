import { describe, expect, test } from 'vitest';
import { missingTyping } from '../../src/core/missing-typing';

describe('missingTyping', () => {
	test('is false when the typing is all in the file', () => {
		expect(missingTyping('- [ ] fix\n\tmeasure the counter twice before cutting\n', 'measure the counter twice before cutting')).toBe(false);
	});

	test('is true when the file holds only the start of what was typed', () => {
		expect(missingTyping('- [ ] fix\n\tmeasu befo\n', 'measure the counter twice befo')).toBe(true);
	});

	test('is false for an empty or blank field', () => {
		expect(missingTyping('- [ ] fix\n', '')).toBe(false);
		expect(missingTyping('- [ ] fix\n', '  \n\t\n')).toBe(false);
	});

	test('is true when one line of several notes lines is missing', () => {
		const text = '- [ ] fix\n\tfirst line\n\tthird line\n';
		expect(missingTyping(text, 'first line\nsecond line\nthird line')).toBe(true);
		expect(missingTyping(text, 'first line\n\nthird line')).toBe(false);
	});

	test('reads a CRLF file', () => {
		const text = '- [ ] fix\r\n\tfirst line\r\n\tsecond line\r\n';
		expect(missingTyping(text, 'first line\nsecond line')).toBe(false);
		expect(missingTyping(text, 'first line\nsecond line!')).toBe(true);
	});
});
