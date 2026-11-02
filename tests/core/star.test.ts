import { expect, test } from 'vitest';
import { parseItemLine } from '../../src/core/item-line';
import { isStarred, setStar, setTitleKeepingStar, splitStar } from '../../src/core/star';

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

test('setStar keeps a tag after an empty title a tag', () => {
	const starred = setStar('- [ ] #errand', true);
	expect(starred).toBe('- [ ]  ⭐ #errand');
	expect(isStarred(starred)).toBe(true);
	expect(parseItemLine(starred)?.tail).toBe(' #errand');
});

test('setStar removes the space, the star and its U+FE0F, keeping the tail as it is', () => {
	expect(setStar('- [ ] a ⭐' + F + ' #shop  ', false)).toBe('- [ ] a #shop  ');
});

test('setStar leaves a starred item starred', () => {
	expect(setStar('- [ ] a ⭐', true)).toBe('- [ ] a ⭐');
});

test('setTitleKeepingStar puts the star of the line back on what was typed, once', () => {
	expect(setTitleKeepingStar('- [ ] milk ⭐', 'oat milk')).toBe('- [ ] oat milk ⭐');
	expect(setTitleKeepingStar('- [ ] milk ⭐', 'oat milk ⭐')).toBe('- [ ] oat milk ⭐');
	expect(setTitleKeepingStar('- [ ] milk ⭐' + F, 'oat')).toBe('- [ ] oat ⭐' + F);
	expect(setTitleKeepingStar('- [ ] milk', 'milk ⭐')).toBe('- [ ] milk ⭐');
});

test('setTitleKeepingStar puts the star before a tag or Tasks field typed at the end of the title', () => {
	const tagged = setTitleKeepingStar('- [ ] Buy ⭐', 'Buy #shop');
	expect(tagged).toBe('- [ ] Buy ⭐ #shop');
	expect(isStarred(tagged)).toBe(true);
	expect(parseItemLine(tagged)?.tail).toBe(' #shop');
	expect(setTitleKeepingStar('- [ ] Pay ⭐', 'Pay rent 📅 2026-11-30')).toBe('- [ ] Pay rent ⭐ 📅 2026-11-30');
	expect(setTitleKeepingStar('- [ ] milk ⭐ 📅 2026-11-30', 'milk #shop')).toBe('- [ ] milk ⭐ #shop 📅 2026-11-30');
});

test('setTitleKeepingStar adds no second star for a star typed before a typed tag or Tasks field', () => {
	expect(setTitleKeepingStar('- [ ] Buy ⭐', 'Buy ⭐ #shop')).toBe('- [ ] Buy ⭐ #shop');
	expect(setTitleKeepingStar('- [ ] Buy ⭐', 'Buy ⭐ 📅 2026-11-30')).toBe('- [ ] Buy ⭐ 📅 2026-11-30');
});

test('setTitleKeepingStar keeps a typed block ID after the star', () => {
	expect(setTitleKeepingStar('- [ ] Buy ⭐', 'Buy ^abc')).toBe('- [ ] Buy ⭐ ^abc');
});

test('setTitleKeepingStar keeps a tag typed as the whole title a tag', () => {
	expect(setTitleKeepingStar('- [ ] Buy ⭐', '#shop')).toBe('- [ ]  ⭐ #shop');
});

test('setTitleKeepingStar leaves a tag typed mid-title in the title, and keeps the tail of the line', () => {
	expect(setTitleKeepingStar('- [ ] Buy ⭐', 'Buy #shop milk')).toBe('- [ ] Buy #shop milk ⭐');
	expect(setTitleKeepingStar('- [ ] milk ⭐ #shop 📅 2026-11-30', 'oat milk')).toBe('- [ ] oat milk ⭐ #shop 📅 2026-11-30');
});

test('setTitleKeepingStar keeps a done item starred, a typed tag before its mark as on an unstarred one', () => {
	const done = setTitleKeepingStar('- [x] milk ⭐ ✔ 2026-10-27 18:05 ⏳ 2026-10-30', 'oat #shop');
	expect(done).toBe('- [x] oat #shop ⭐ ✔ 2026-10-27 18:05 ⏳ 2026-10-30');
	expect(isStarred(done)).toBe(true);
	const unstarred = setTitleKeepingStar('- [x] milk ✔ 2026-10-27 18:05 ⏳ 2026-10-30', 'oat #shop');
	expect(unstarred).toBe('- [x] oat #shop ✔ 2026-10-27 18:05 ⏳ 2026-10-30');
});

test('isStarred reads the star on an item line only', () => {
	expect(isStarred('- [x] a ⭐ ✔ 2026-10-27 18:05')).toBe(true);
	expect(isStarred('- [ ] a')).toBe(false);
	expect(isStarred('## a ⭐')).toBe(false);
});

test('a starred item whose title is cleared stays starred', () => {
	const line = setTitleKeepingStar('- [ ] milk ⭐', '');
	expect(line).toBe('- [ ]  ⭐');
	expect(isStarred(line)).toBe(true);
});

test('a star before trailing spaces still counts', () => {
	expect(isStarred('- [ ] milk ⭐ ')).toBe(true);
});
