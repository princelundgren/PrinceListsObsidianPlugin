import { describe, expect, test } from 'vitest';
import type { GroupState } from '../../src/core/group-edits';
import { barButtons, changeMessage, groupEntries, placesBelow, tagChangeMessage } from '../../src/core/group-menu';

const NONE: GroupState = {
	items: 0,
	headings: 0,
	anyUnticked: false,
	anyTicked: false,
	anyUnstarred: false,
	anyStarred: false,
	anyDated: false,
};
const MIXED: GroupState = { ...NONE, items: 3, anyUnticked: true, anyTicked: true, anyUnstarred: true, anyStarred: true, anyDated: true };

describe('groupEntries', () => {
	test('shows every entry for a mixed selection of items, in the menu order', () => {
		expect(groupEntries(MIXED, true)).toEqual([
			'move',
			'tick',
			'untick',
			'tag',
			'addStar',
			'removeStar',
			'today',
			'tomorrow',
			'pickDate',
			'removeDate',
			'newItem',
			'newHeading',
			'delete',
		]);
	});

	test('shows only the entries that change something', () => {
		const state = { ...NONE, items: 2, anyUnticked: true, anyStarred: true };
		expect(groupEntries(state, true)).toEqual(['move', 'tick', 'tag', 'removeStar', 'today', 'tomorrow', 'pickDate', 'newItem', 'newHeading', 'delete']);
	});

	test('hides Move to heading while a heading is selected', () => {
		expect(groupEntries({ ...MIXED, headings: 1 }, true)).not.toContain('move');
	});

	test('hides Move to heading in a list without headings', () => {
		expect(groupEntries(MIXED, false)).not.toContain('move');
	});

	test('offers only Tag…, the new entries and Delete for a selection of headings', () => {
		expect(groupEntries({ ...NONE, headings: 2 }, true)).toEqual(['tag', 'newItem', 'newHeading', 'delete']);
	});

	test('keeps to one group of entries when asked', () => {
		expect(groupEntries(MIXED, true, 'date')).toEqual(['today', 'tomorrow', 'pickDate', 'removeDate']);
		expect(groupEntries(MIXED, true, 'more')).toEqual(['tick', 'untick', 'tag', 'addStar', 'removeStar', 'newItem', 'newHeading']);
		expect(groupEntries({ ...NONE, headings: 2 }, true, 'more')).toEqual(['tag', 'newItem', 'newHeading']);
		expect(groupEntries({ ...NONE, headings: 2 }, true, 'date')).toEqual([]);
	});
});

describe('placesBelow', () => {
	test('puts a new item right after a selected item, and a new heading after it', () => {
		expect(placesBelow({ kind: 'item', line: 7 })).toEqual({ item: { after: 7 }, heading: { afterItem: 7 } });
	});

	test('puts a new item first under a selected heading, and a new heading after its section', () => {
		expect(placesBelow({ kind: 'heading', line: 4 })).toEqual({ item: { firstUnder: 4 }, heading: { afterSection: 4 } });
	});
});

describe('barButtons', () => {
	test('enables every button for a mixed selection of items in a list with headings', () => {
		expect(barButtons(MIXED, true)).toEqual({ move: true, date: true, more: true, delete: true });
	});

	test('enables only More and Delete for a selection of headings', () => {
		expect(barButtons({ ...NONE, headings: 2 }, true)).toEqual({ move: false, date: false, more: true, delete: true });
	});

	test('disables Move to while a heading is selected', () => {
		expect(barButtons({ ...MIXED, headings: 1 }, true).move).toBe(false);
	});

	test('disables Move to in a list without headings', () => {
		expect(barButtons(MIXED, false).move).toBe(false);
	});

	test('enables Date and More for one item, whatever it holds', () => {
		const ticked = { ...NONE, items: 1, anyTicked: true, anyUnstarred: true };
		expect(barButtons(ticked, true)).toEqual({ move: true, date: true, more: true, delete: true });
	});
});

describe('changeMessage', () => {
	test('names what changed on how many items', () => {
		expect(changeMessage('tick', { changed: 3, skipped: 0 })).toBe('3 items ticked.');
		expect(changeMessage('untick', { changed: 3, skipped: 0 })).toBe('3 items unticked.');
		expect(changeMessage('addStar', { changed: 2, skipped: 0 })).toBe('2 items starred.');
		expect(changeMessage('removeStar', { changed: 2, skipped: 0 })).toBe('Star removed from 2 items.');
		expect(changeMessage('setDate', { changed: 4, skipped: 0 })).toBe('Date set on 4 items.');
		expect(changeMessage('removeDate', { changed: 4, skipped: 0 })).toBe('Date removed from 4 items.');
	});

	test('counts one item in the singular', () => {
		expect(changeMessage('tick', { changed: 1, skipped: 0 })).toBe('1 item ticked.');
		expect(changeMessage('removeStar', { changed: 1, skipped: 0 })).toBe('Star removed from 1 item.');
	});

	test("adds the items a tick skipped because they can't repeat", () => {
		expect(changeMessage('tick', { changed: 3, skipped: 1 })).toBe("3 items ticked. 1 item that can't repeat skipped.");
		expect(changeMessage('tick', { changed: 3, skipped: 2 })).toBe("3 items ticked. 2 items that can't repeat skipped.");
	});
});

test('names the tag and how many items the write changed', () => {
	expect(tagChangeMessage('addTag', 'pantry', 3, 0)).toBe('#pantry added to 3 items.');
	expect(tagChangeMessage('removeTag', 'pantry', 5, 0)).toBe('#pantry removed from 5 items.');
	expect(tagChangeMessage('addTag', 'pantry', 1, 0)).toBe('#pantry added to 1 item.');
});

test('tagChangeMessage counts the headings it changed', () => {
	expect(tagChangeMessage('addTag', 'work', 2, 1)).toBe('#work added to 2 items and 1 heading.');
	expect(tagChangeMessage('removeTag', 'work', 0, 2)).toBe('#work removed from 2 headings.');
});
