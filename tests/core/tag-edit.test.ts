import { describe, expect, test } from 'vitest';
import { planItemLineEdit } from '../../src/core/list-actions';
import { splitLines } from '../../src/core/lines';
import { addTag, removeTag } from '../../src/core/tag-edit';
import { contentStartOf, crlf } from './edit-helpers';

const ADDED: [string, string, string][] = [
	['- [ ] Fries', 'frozen', '- [ ] Fries #frozen'],
	['- [ ] ', 'errand', '- [ ] #errand'],
	['- [ ]  ⭐', 'errand', '- [ ]  ⭐ #errand'],
	[
		'- [x] Fries ⭐ ✔ 2026-11-07 10:00 ⏳ 2026-11-08 ^id  ',
		'frozen',
		'- [x] Fries ⭐ ✔ 2026-11-07 10:00 ⏳ 2026-11-08 #frozen ^id  ',
	],
];

describe('addTag', () => {
	test.each(ADDED)('puts the tag at the end of the tail fields: %j + %s', (line, tag, expected) => {
		expect(addTag(line, tag)).toBe(expected);
	});

	test.each([
		['- [ ] Fries #Frozen', 'frozen'],
		['- [ ] #frozen Fries', 'frozen'],
		['- [ ] Fries', '1984'],
	])('leaves %j alone for %s', (line, tag) => {
		expect(addTag(line, tag)).toBe(line);
	});
});

describe('removeTag', () => {
	test.each([
		['- [ ] Fries #frozen', 'frozen', '- [ ] Fries'],
		['- [ ] #errand', 'errand', '- [ ] '],
		['- [ ]  ⭐ #errand', 'errand', '- [ ]  ⭐'],
		['- [ ] Fries #frozen ⏳ 2026-11-08 ^id', 'frozen', '- [ ] Fries ⏳ 2026-11-08 ^id'],
		['- [ ] Fries #frozen⏳ 2026-11-08', 'frozen', '- [ ] Fries ⏳ 2026-11-08'],
		['- [ ] Fries #Frozen #pantry #frozen', 'frozen', '- [ ] Fries #pantry'],
		['- [ ] #errand ⏳ 2026-11-08', 'errand', '- [ ] ⏳ 2026-11-08'],
		['- [ ] #frozen Fries', 'frozen', '- [ ] #frozen Fries'],
	])('%j without %s is %j', (line, tag, expected) => {
		expect(removeTag(line, tag)).toBe(expected);
	});

	test.each(ADDED)('undoes addTag: %j + %s', (line, tag) => {
		expect(removeTag(addTag(line, tag), tag)).toBe(line);
	});
});

describe('removeTag and addTag edge cases', () => {
	test.each([
		['- [ ] #a #a ⏳ 2026-11-08', 'a', '- [ ] ⏳ 2026-11-08'],
		['- [ ] #a #a', 'a', '- [ ] '],
		['- [ ] #frozen Fries #frozen', 'frozen', '- [ ] #frozen Fries'],
		['- [ ] Fries ^id', 'frozen', '- [ ] Fries ^id'],
		['- [ ] Fries', '1984', '- [ ] Fries'],
		['- [ ] Fries #frozen  ', 'frozen', '- [ ] Fries  '],
	])('removeTag %j without %s is %j', (line, tag, expected) => {
		expect(removeTag(line, tag)).toBe(expected);
	});

	test('addTag leaves a line whose title already has the tag', () => {
		expect(addTag('- [ ] #frozen Fries #frozen', 'frozen')).toBe('- [ ] #frozen Fries #frozen');
	});
});

describe('through planItemLineEdit', () => {
	test('changes only the item line, keeping CRLF and a missing final newline', () => {
		const file = crlf('---\nprincelists: true\n---\n## H\n- [ ] a\n- [ ] b');
		expect(file.endsWith('\n')).toBe(false);
		const start = contentStartOf(splitLines(file));
		const added = planItemLineEdit(file, start, 4, (line) => addTag(line, 'frozen'))?.next;
		expect(added).toBe(file.replace('- [ ] a', '- [ ] a #frozen'));
		const removed = planItemLineEdit(added as string, start, 4, (line) => removeTag(line, 'frozen'))?.next;
		expect(removed).toBe(file);
	});
});
