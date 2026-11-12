import { describe, expect, test } from 'vitest';
import type { GroupState } from '../../src/core/group-edits';
import { changeMessage, groupEntries } from '../../src/core/group-menu';

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
			'addStar',
			'removeStar',
			'today',
			'tomorrow',
			'pickDate',
			'removeDate',
			'delete',
		]);
	});

	test('shows only the entries that change something', () => {
		const state = { ...NONE, items: 2, anyUnticked: true, anyStarred: true };
		expect(groupEntries(state, true)).toEqual(['move', 'tick', 'removeStar', 'today', 'tomorrow', 'pickDate', 'delete']);
	});

	test('hides Move to heading while a heading is selected', () => {
		expect(groupEntries({ ...MIXED, headings: 1 }, true)).not.toContain('move');
	});

	test('hides Move to heading in a list without headings', () => {
		expect(groupEntries(MIXED, false)).not.toContain('move');
	});

	test('offers only Delete for a selection of headings', () => {
		expect(groupEntries({ ...NONE, headings: 2 }, true)).toEqual(['delete']);
	});

	test('keeps to one group of entries when asked', () => {
		expect(groupEntries(MIXED, true, 'tick')).toEqual(['tick', 'untick']);
		expect(groupEntries(MIXED, true, 'star')).toEqual(['addStar', 'removeStar']);
		expect(groupEntries(MIXED, true, 'date')).toEqual(['today', 'tomorrow', 'pickDate', 'removeDate']);
		expect(groupEntries({ ...NONE, headings: 2 }, true, 'tick')).toEqual([]);
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

	test('adds the repeating items a tick skipped', () => {
		expect(changeMessage('tick', { changed: 3, skipped: 1 })).toBe('3 items ticked. 1 repeating item skipped.');
		expect(changeMessage('tick', { changed: 3, skipped: 2 })).toBe('3 items ticked. 2 repeating items skipped.');
	});
});
