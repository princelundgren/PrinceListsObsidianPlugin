import { expect, test } from 'vitest';
import { listInheritedTags } from '../../src/core/display';
import { carriedTags, inheritedTags, listTagsOf, sharedCarried, withoutListTags } from '../../src/core/inherited-tags';
import { splitLines } from '../../src/core/lines';
import { parseList } from '../../src/core/parse';

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

test('sharedCarried lists the tags every selected item carries, own or inherited', () => {
	const lines = splitLines('---\nprincelists: true\n---\n## Office #work\n- [ ] call\n- [ ] mail #urgent\n## Home\n- [ ] sweep #work\n');
	const model = parseList(lines, 3);
	const inherited = listInheritedTags(lines, model, ['home']);
	expect(sharedCarried(lines, model, inherited, [4, 5])).toEqual(['home', 'work']);
	expect(sharedCarried(lines, model, inherited, [4, 7])).toEqual(['home', 'work']);
	expect(sharedCarried(lines, model, inherited, [5, 7])).toEqual(['home', 'work']);
	expect(sharedCarried(lines, model, inherited, [3])).toEqual([]);
	expect(sharedCarried(lines, model, listInheritedTags(lines, model, ['Home']), [4, 7])).toEqual(['Home', 'work']);
});
