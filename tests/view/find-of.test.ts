import { describe, expect, test, vi } from 'vitest';

// Obsidian ships only typings; this stands in for prepareSimpleSearch, matching each word's first place.
vi.mock('obsidian', () => ({
	prepareSimpleSearch: (query: string) => (text: string) => {
		const at = text.toLowerCase().indexOf(query.toLowerCase());
		return at < 0 ? null : { score: 0, matches: [[at, at + query.length]] };
	},
}));

const { findOf } = await import('../../src/view/filter');

describe('findOf', () => {
	test("gives each word's matches from Obsidian's search", () => {
		const find = findOf(' oat  milk ');
		expect(find?.words.map((word) => word('Oat milk'))).toEqual([[[0, 3]], [[4, 8]]]);
	});
});
