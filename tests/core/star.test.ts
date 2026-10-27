import { expect, test } from 'vitest';
import { isStarred, keepStar, setStar, splitStar } from '../../src/core/star';

const F = '️';

test('splitStar takes the trailing space and star off a title, with any U+FE0F', () => {
	expect(splitStar('Buy milk ⭐')).toEqual({ plain: 'Buy milk', star: ' ⭐' });
	expect(splitStar('Buy milk ⭐' + F)).toEqual({ plain: 'Buy milk', star: ' ⭐' + F });
});

test('splitStar needs a space before the star', () => {
	expect(splitStar('5⭐')).toEqual({ plain: '5⭐', star: '' });
	expect(splitStar('⭐')).toEqual({ plain: '⭐', star: '' });
});

test('setStar puts the star at the end of the title and nowhere else', () => {
	expect(setStar('- [ ] Buy milk', true)).toBe('- [ ] Buy milk ⭐');
	const done = '- [x] Buy milk ✔ 2026-10-27 18:05 ⏳ 2026-10-30 ^id';
	const starred = '- [x] Buy milk ⭐ ✔ 2026-10-27 18:05 ⏳ 2026-10-30 ^id';
	expect(setStar(done, true)).toBe(starred);
	expect(setStar(starred, false)).toBe(done);
	expect(setStar('- [ ] a📅 2026-10-30', true)).toBe('- [ ] a ⭐📅 2026-10-30');
});

test('setStar removes the space, the star and its U+FE0F, keeping the tail as it is', () => {
	expect(setStar('- [ ] a ⭐' + F + ' #shop  ', false)).toBe('- [ ] a #shop  ');
});

test('setStar leaves a starred item starred', () => {
	expect(setStar('- [ ] a ⭐', true)).toBe('- [ ] a ⭐');
});

test('keepStar puts the saved star back on what was typed', () => {
	expect(keepStar('milk ⭐', 'oat milk')).toBe('oat milk ⭐');
	expect(keepStar('milk ⭐', 'oat milk ⭐')).toBe('oat milk ⭐');
	expect(keepStar('milk ⭐' + F, 'oat')).toBe('oat ⭐' + F);
	expect(keepStar('milk', 'milk ⭐')).toBe('milk ⭐');
});

test('isStarred reads the star on an item line only', () => {
	expect(isStarred('- [x] a ⭐ ✔ 2026-10-27 18:05')).toBe(true);
	expect(isStarred('- [ ] a')).toBe(false);
	expect(isStarred('## a ⭐')).toBe(false);
});

test('a starred item whose title is cleared stays starred', () => {
	const title = keepStar('milk ⭐', '');
	expect(title).toBe(' ⭐');
	expect(isStarred(`- [ ] ${title}`)).toBe(true);
});

test('a star before trailing spaces still counts', () => {
	expect(isStarred('- [ ] milk ⭐ ')).toBe(true);
});
