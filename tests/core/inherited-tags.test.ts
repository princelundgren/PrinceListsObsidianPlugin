import { expect, test } from 'vitest';
import { carriedTags, inheritedTags, listTagsOf, withoutListTags } from '../../src/core/inherited-tags';

test('a section inherits the list tags then its heading tags', () => {
	expect(inheritedTags(['work'], [null, 'Office #calls', 'Home']).bySection).toEqual([['work'], ['work', 'calls'], ['work']]);
});
test('carriedTags keeps the own spelling and adds what is missing', () => {
	expect(carriedTags(['Work', 'x'], ['work', 'calls'])).toEqual(['Work', 'x', 'calls']);
});
test('withoutListTags drops a list tag and its parents', () => {
	expect(withoutListTags(['Work', 'work/acme', 'calls', 'workshop'], ['work/acme'])).toEqual(['calls', 'workshop']);
});
test('listTagsOf cleans what Obsidian returns', () => {
	expect(listTagsOf(['#work', '#Work', '#work,home', '#1984', '#home'])).toEqual(['work', 'home']);
	expect(listTagsOf(null)).toEqual([]);
	expect(listTagsOf([])).toEqual([]);
});
