import { describe, expect, test } from 'vitest';
import { itemTags } from '../../src/core/item-tags';

describe('itemTags', () => {
	test('reads a tag in the tail as a tag and a tail tag', () => {
		expect(itemTags('- [ ] Fries #frozen')).toEqual({ tags: ['frozen'], tailTags: ['frozen'] });
	});

	test('reads a tag in the title as a tag only', () => {
		expect(itemTags('- [ ] #frozen Fries')).toEqual({ tags: ['frozen'], tailTags: [] });
	});

	test('skips what the renderer does not draw as a tag: code and link targets', () => {
		expect(itemTags('- [ ] Fries `#code` [x](#heading) #frozen').tags).toEqual(['frozen']);
	});

	test('leaves out a number after the #, which stays a tail field and is no tag', () => {
		expect(itemTags('- [ ] Fries #1984')).toEqual({ tags: [], tailTags: [] });
	});

	test('leaves out a tail field such as #frozen;, which stays a Tasks field', () => {
		expect(itemTags('- [ ] Fries #frozen;')).toEqual({ tags: [], tailTags: [] });
	});

	test('keeps the first of tags that differ only in case', () => {
		expect(itemTags('- [ ] Fries #Frozen #frozen').tags).toEqual(['Frozen']);
	});

	test('finds the tail tag among the star, the mark, the date and the block ID', () => {
		expect(itemTags('- [x] Fries ⭐ ✔ 2026-11-07 10:00 #frozen ⏳ 2026-11-08 ^id').tags).toEqual(['frozen']);
	});

	test('finds a tag glued to the field after it', () => {
		expect(itemTags('- [ ] Fries #frozen⏳ 2026-11-08').tags).toEqual(['frozen']);
	});

	test('has no tags for a line that is not an item', () => {
		expect(itemTags('A paragraph #frozen')).toEqual({ tags: [], tailTags: [] });
	});
});
