import { describe, expect, test } from 'vitest';
import { missingTyping } from '../../src/core/missing-typing';

describe('missingTyping', () => {
	test('is false when the typing is all in the file', () => {
		expect(missingTyping('- [ ] fix\n\tmeasure the counter twice before cutting\n', 'measure the counter twice before cutting', 'notes')).toBe(false);
	});

	test('is true when the file holds only the start of what was typed', () => {
		expect(missingTyping('- [ ] fix\n\tmeasu befo\n', 'measure the counter twice befo', 'notes')).toBe(true);
	});

	test('is false for an empty or blank field', () => {
		expect(missingTyping('- [ ] fix\n', '', 'notes')).toBe(false);
		expect(missingTyping('- [ ] fix\n', '  \n\t\n', 'notes')).toBe(false);
	});

	test('is true when one line of several notes lines is missing', () => {
		const text = '- [ ] fix\n\tfirst line\n\tthird line\n';
		expect(missingTyping(text, 'first line\nsecond line\nthird line', 'notes')).toBe(true);
		expect(missingTyping(text, 'first line\n\nthird line', 'notes')).toBe(false);
	});

	test('counts a notes line only when the file holds it as a whole line', () => {
		expect(missingTyping('- [ ] eggs and ham\n- [ ] milk\n', 'eggs', 'notes')).toBe(true);
		expect(missingTyping('- [ ] fix\n\teggs \n', '  eggs', 'notes')).toBe(false);
	});

	test("counts a title only when it is an item's title", () => {
		expect(missingTyping('- [ ] buy eggs\n- [ ] milk\n', 'eggs', 'title')).toBe(true);
		expect(missingTyping('- [ ] milk\n\teggs\n', 'eggs', 'title')).toBe(true);
		expect(missingTyping('- [ ] milk\n- [x] eggs ✔ 2026-10-22 14:30 📅 2026-10-23\n', 'eggs', 'title')).toBe(false);
		// A typed tag the file lost is typing to offer back, even though the title it follows is there.
		expect(missingTyping('- [ ] buy\n', 'buy #milk', 'title')).toBe(true);
	});

	test('reads a CRLF file', () => {
		const text = '- [ ] fix\r\n\tfirst line\r\n\tsecond line\r\n';
		expect(missingTyping(text, 'first line\nsecond line', 'notes')).toBe(false);
		expect(missingTyping(text, 'first line\nsecond line!', 'notes')).toBe(true);
	});
});
