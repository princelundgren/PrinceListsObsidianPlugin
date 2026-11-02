import { describe, expect, test } from 'vitest';
import { lostFieldNotice, missingTyping } from '../../src/core/missing-typing';

describe('missingTyping', () => {
	test('is false when the typing is all in the file', () => {
		expect(missingTyping('- [ ] fix\n\tmeasure the counter twice before cutting\n', 'measure the counter twice before cutting', 'notes')).toBe(false);
	});

	test('is true when the file holds only the start of what was typed', () => {
		expect(missingTyping('- [ ] fix\n\tmeasu befo\n', 'measure the counter twice befo', 'notes')).toBe(true);
	});

	test('finds a typed title on a starred item', () => {
		expect(missingTyping('- [ ] milk ⭐\n', 'milk', 'title')).toBe(false);
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

	test('finds a typed title whose ending tag or Tasks field the file reads as the tail', () => {
		expect(missingTyping('- [ ] Buy milk #shop\n', 'Buy milk #shop', 'title')).toBe(false);
		expect(missingTyping('- [ ] Pay rent 📅 2026-11-30\n', 'Pay rent 📅 2026-11-30', 'title')).toBe(false);
		expect(missingTyping('- [ ] Buy #shop 📅 2026-11-01\n', 'Buy #shop', 'title')).toBe(false);
	});

	test('finds a tag typed as the whole title of a starred item', () => {
		expect(missingTyping('- [ ]  ⭐ #shop\n', '#shop', 'title')).toBe(false);
	});

	test('finds a typed title ending in a tag on an item ticked while its title was open', () => {
		expect(missingTyping('- [x] Buy ✔ 2026-11-02 10:00 #shop\n', 'Buy #shop', 'title')).toBe(false);
	});

	test('still misses a typed title the file holds only part of, or inside a longer title', () => {
		expect(missingTyping('- [ ] buy #milk\n', 'buy #mi', 'title')).toBe(true);
		expect(missingTyping('- [ ] buy eggs #shop\n', 'buy', 'title')).toBe(true);
	});

	test('reads a CRLF file', () => {
		const text = '- [ ] fix\r\n\tfirst line\r\n\tsecond line\r\n';
		expect(missingTyping(text, 'first line\nsecond line', 'notes')).toBe(false);
		expect(missingTyping(text, 'first line\nsecond line!', 'notes')).toBe(true);
	});
});

// A field whose line went: an untouched field lost nothing, one emptied by hand has nothing to copy.
test('lostFieldNotice says which notice a field whose line went shows', () => {
	expect(lostFieldNotice('milk', 'milk')).toBe('none');
	expect(lostFieldNotice('', '')).toBe('none');
	expect(lostFieldNotice('  ', 'milk')).toBe('retry');
	expect(lostFieldNotice('oat milk', 'milk')).toBe('copy');
	expect(lostFieldNotice('bread', '')).toBe('copy');
});
