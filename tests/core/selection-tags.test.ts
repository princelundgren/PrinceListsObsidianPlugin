import { expect, test } from 'vitest';
import { selectionTags } from '../../src/core/selection-tags';

const FRONT = '---\nprincelists: true\n---\n';
// Lines 3 to 7 of the text.
const TEXT = FRONT + '- [ ] oats #pantry\n- [ ] rice #Pantry #dry\n## Fridge\n- [ ] milk\n- [ ] #pantry flour\n';
const ORDER = ['pantry', 'dry'];

test('counts the items carrying each tail tag, in the given order, spelled as it spells them', () => {
	expect(selectionTags(TEXT, 3, [3, 4, 6], ORDER).chips).toEqual([
		{ tag: 'pantry', count: 2 },
		{ tag: 'dry', count: 1 },
	]);
});
test('counts items only, not headings', () => {
	expect(selectionTags(TEXT, 3, [3, 5, 6], ORDER)).toMatchObject({ items: 2, chips: [{ tag: 'pantry', count: 1 }] });
});
test('leaves a title tag out of the chips but counts it as shared', () => {
	const result = selectionTags(TEXT, 3, [3, 7], ORDER);
	expect(result.chips).toEqual([{ tag: 'pantry', count: 1 }]);
	expect(result.shared).toEqual(['pantry']);
});
test('shares only the tags every selected item has, in any case', () => {
	expect(selectionTags(TEXT, 3, [3, 4], ORDER).shared).toEqual(['pantry']);
	expect(selectionTags(TEXT, 3, [3, 6], ORDER).shared).toEqual([]);
});
test('puts a tag the order lacks after the rest', () => {
	expect(selectionTags(TEXT, 3, [4], ['pantry']).chips.map((chip) => chip.tag)).toEqual(['pantry', 'dry']);
});
test('has no chips for a selection with no tag', () => {
	expect(selectionTags(TEXT, 3, [6], ORDER)).toEqual({ items: 1, chips: [], shared: [] });
});

test('spells a chip as the order spells it, whatever the items spell', () => {
	expect(selectionTags(TEXT, 3, [3, 4], ['Pantry', 'dry']).chips[0]).toEqual({ tag: 'Pantry', count: 2 });
});
test('spells a tag the order lacks as the first item with it spells it', () => {
	const text = FRONT + '- [ ] a #Dry\n- [ ] b #dry\n';
	expect(selectionTags(text, 3, [3, 4], []).chips).toEqual([{ tag: 'Dry', count: 2 }]);
});
