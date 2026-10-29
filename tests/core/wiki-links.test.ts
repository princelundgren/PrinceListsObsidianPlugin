import { describe, expect, test } from 'vitest';
import { wikiLinks } from '../../src/core/wiki-links';

describe('wikiLinks', () => {
	test('finds a plain link, with its columns and no display text', () => {
		expect(wikiLinks('see [[a]] here')).toEqual([{ from: 4, to: 9, linkpath: 'a', display: null, embed: false }]);
	});

	test('splits the display text from the path at the first bar', () => {
		expect(wikiLinks('[[a|b]]')).toEqual([{ from: 0, to: 7, linkpath: 'a', display: 'b', embed: false }]);
	});

	test('keeps a heading in the path', () => {
		expect(wikiLinks('[[a#h|b]]')).toEqual([{ from: 0, to: 9, linkpath: 'a#h', display: 'b', embed: false }]);
	});

	test('marks an embed, with its ! in the columns', () => {
		expect(wikiLinks('x ![[p.png]]')).toEqual([{ from: 2, to: 12, linkpath: 'p.png', display: null, embed: true }]);
	});

	test('finds two links on one line in order', () => {
		expect(wikiLinks('[[a]] and ![[b|100]]')).toEqual([
			{ from: 0, to: 5, linkpath: 'a', display: null, embed: false },
			{ from: 10, to: 20, linkpath: 'b', display: '100', embed: true },
		]);
	});

	test('finds none in an unclosed link', () => {
		expect(wikiLinks('[[a')).toEqual([]);
	});
});
