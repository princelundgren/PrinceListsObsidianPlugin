import { describe, expect, test } from 'vitest';
import { tagChoices } from '../../src/core/tag-choices';

const LIST_TAGS = ['Frozen', 'pantry', 'shop/frozen'];
const listed = (tag: string) => ({ tag, isNew: false });

describe('tagChoices', () => {
	test('offers every list tag for empty text, none new', () => {
		expect(tagChoices(LIST_TAGS, [], '')).toEqual(LIST_TAGS.map(listed));
	});

	test.each(['fro', '#fro'])('offers the list tags containing %j, then it as a new tag', (typed) => {
		expect(tagChoices(LIST_TAGS, [], typed)).toEqual([listed('Frozen'), listed('shop/frozen'), { tag: 'fro', isNew: true }]);
	});

	test('offers no new tag for one the list has in another case', () => {
		expect(tagChoices(LIST_TAGS, [], 'frozen')).toEqual([listed('Frozen'), listed('shop/frozen')]);
	});

	test("leaves out the item's own tags, in any case", () => {
		expect(tagChoices(LIST_TAGS, ['frozen'], 'fro')).toEqual([listed('shop/frozen'), { tag: 'fro', isNew: true }]);
	});

	test('offers no new tag the item already has', () => {
		expect(tagChoices(LIST_TAGS, ['frozen'], 'frozen')).toEqual([listed('shop/frozen')]);
	});

	test.each(['#', '# frozen', '1984', 'frozen pantry'])('offers no new tag for %j, which is no tag', (typed) => {
		expect(tagChoices(LIST_TAGS, [], typed).filter((choice) => choice.isNew)).toEqual([]);
	});
});
