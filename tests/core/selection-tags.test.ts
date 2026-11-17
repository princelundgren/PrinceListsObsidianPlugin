import { describe, expect, test } from 'vitest';
import { followLine } from '../../src/core/follow';
import { planGroupTag, selectionTags } from '../../src/core/selection-tags';

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
test('counts a heading among the rows', () => {
	expect(selectionTags(TEXT, 3, [3, 5, 6], ORDER)).toMatchObject({ total: 3, chips: [{ tag: 'pantry', count: 1 }] });
});
test("counts a heading's end tags with the items' tail tags", () => {
	const text = FRONT + '## Office #work #Pantry\n- [ ] call #work\n- [ ] mail\n';
	expect(selectionTags(text, 3, [3, 4, 5], [])).toEqual({ total: 3, chips: [{ tag: 'work', count: 2 }, { tag: 'Pantry', count: 1 }] });
});
test("leaves a tag inside a heading's text out of the chips", () => {
	expect(selectionTags(FRONT + '## The #work trip\n', 3, [3], []).chips).toEqual([]);
});
test('leaves a title tag out of the chips', () => {
	const result = selectionTags(TEXT, 3, [3, 7], ORDER);
	expect(result.chips).toEqual([{ tag: 'pantry', count: 1 }]);
});
test('puts a tag the order lacks after the rest', () => {
	expect(selectionTags(TEXT, 3, [4], ['pantry']).chips.map((chip) => chip.tag)).toEqual(['pantry', 'dry']);
});
test('has no chips for a selection with no tag', () => {
	expect(selectionTags(TEXT, 3, [6], ORDER)).toEqual({ total: 1, chips: [] });
});

test('spells a chip as the order spells it, whatever the items spell', () => {
	expect(selectionTags(TEXT, 3, [3, 4], ['Pantry', 'dry']).chips[0]).toEqual({ tag: 'Pantry', count: 2 });
});
test('spells a tag the order lacks as the first item with it spells it', () => {
	const text = FRONT + '- [ ] a #Dry\n- [ ] b #dry\n';
	expect(selectionTags(text, 3, [3, 4], []).chips).toEqual([{ tag: 'Dry', count: 2 }]);
});

describe('planGroupTag', () => {
	test('adds the tag to every item and heading in one write', () => {
		const result = planGroupTag(FRONT + '## Office\n- [ ] call\n- [ ] mail #work\n', 3, [3, 4, 5], 'addTag', 'work');
		expect(result).toEqual({
			next: FRONT + '## Office #work\n- [ ] call #work\n- [ ] mail #work\n',
			edit: { start: 3, delta: 0, kind: 'change' },
			items: 1,
			headings: 1,
		});
	});
	test('removes the tag from every item and heading', () => {
		const result = planGroupTag(FRONT + '## Office #work\n- [ ] call #Work\n', 3, [3, 4], 'removeTag', 'work');
		expect(result).toMatchObject({ next: FRONT + '## Office\n- [ ] call\n', items: 1, headings: 1 });
	});
	test("keeps a heading's closing hashes", () => {
		expect(planGroupTag(FRONT + '## Office ##\n', 3, [3], 'addTag', 'work')).toMatchObject({ next: FRONT + '## Office #work ##\n' });
	});
	test('leaves a heading the change would empty and changes the rest', () => {
		const result = planGroupTag(FRONT + '## #work\n- [ ] call #work\n', 3, [3, 4], 'removeTag', 'work');
		expect(result).toMatchObject({ next: FRONT + '## #work\n- [ ] call\n', items: 1, headings: 0 });
	});
	test('follows the lines below a setext heading whose text joins onto one line', () => {
		const result = planGroupTag(FRONT + 'Office\nhours\n===\n- [ ] call\n', 3, [3, 6], 'addTag', 'work');
		expect(result).toMatchObject({ next: FRONT + 'Office hours #work\n===\n- [ ] call #work\n', items: 1, headings: 1 });
		const edit = result!.edit;
		expect([3, 4, 5, 6].map((line) => followLine(line, edit))).toEqual([3, null, 4, 5]);
	});
	test('returns null when nothing changes', () => {
		expect(planGroupTag(FRONT + '## Office #work\n- [ ] call #work\n', 3, [3, 4], 'addTag', 'work')).toBeNull();
		expect(planGroupTag(FRONT + '## #work\n', 3, [3], 'removeTag', 'work')).toBeNull();
	});
	test('follows the lines past two setext headings joined in one write', () => {
		const result = planGroupTag(FRONT + 'A\na\n===\n\nB\nb\n===\n- [ ] y\n', 3, [3, 7, 10], 'addTag', 'work');
		expect(result).toMatchObject({ next: FRONT + 'A a #work\n===\n\nB b #work\n===\n- [ ] y #work\n', items: 1, headings: 2 });
		expect([3, 4, 5, 6, 7, 8, 9, 10].map((line) => followLine(line, result!.edit))).toEqual([3, null, 4, 5, 6, null, 7, 8]);
	});
	test('returns null when a row is neither an item nor a heading', () => {
		expect(planGroupTag(FRONT + '- [ ] call\n\nSome words\n', 3, [3, 5], 'addTag', 'work')).toBeNull();
	});
});
