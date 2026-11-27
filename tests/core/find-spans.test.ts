import { describe, expect, test } from 'vitest';
import { findSpans, pieceSpans, queryWords, type Span, type WordSearch } from '../../src/core/find-spans';

/** A word's search that reports only its first match, case-insensitive like Obsidian's. */
const first = (word: string): WordSearch => (text) => {
	const at = text.toLowerCase().indexOf(word.toLowerCase());
	return at < 0 ? null : [[at, at + word.length]];
};

/** A word's search that reports every match. */
const every = (word: string): WordSearch => (text) => {
	const spans: Span[] = [];
	const [lower, wordLower] = [text.toLowerCase(), word.toLowerCase()];
	for (let at = lower.indexOf(wordLower); at >= 0; at = lower.indexOf(wordLower, at + word.length)) {
		spans.push([at, at + word.length]);
	}
	return spans.length ? spans : null;
};

describe('findSpans', () => {
	test('finds every place a word appears, though its search reports only the first', () => {
		expect(findSpans('milk and milk', [first('milk')])).toEqual([[0, 4], [9, 13]]);
	});

	test('finds each place once when the search reports them all', () => {
		expect(findSpans('milk and milk', [every('milk')])).toEqual([[0, 4], [9, 13]]);
	});

	test('finds a repeat right after a match, merging the touching spans', () => {
		expect(findSpans('milkmilk', [first('milk')])).toEqual([[0, 8]]);
	});

	test('gives the spans of several words in text order', () => {
		expect(findSpans('Oat milk', [first('milk'), first('oat')])).toEqual([[0, 3], [4, 8]]);
	});

	test('merges overlapping spans', () => {
		expect(findSpans('milk', [first('mil'), first('ilk')])).toEqual([[0, 4]]);
	});

	test('finds nothing when no word matches', () => {
		expect(findSpans('oat milk', [first('rice')])).toEqual([]);
		expect(findSpans('', [first('milk')])).toEqual([]);
	});
});

describe('pieceSpans', () => {
	test('finds a word split over text nodes of one block', () => {
		expect(pieceSpans([{ text: 'oa', block: 0 }, { text: 't milk', block: 0 }], [first('oat')])).toEqual([
			{ start: { piece: 0, offset: 0 }, end: { piece: 1, offset: 1 } },
		]);
	});

	test('ends a match at the end of its piece, not at the next one\'s start', () => {
		expect(pieceSpans([{ text: 'oat', block: 0 }, { text: ' milk', block: 0 }], [first('oat')])).toEqual([
			{ start: { piece: 0, offset: 0 }, end: { piece: 0, offset: 3 } },
		]);
	});

	test('keeps a word from running from one block into the next', () => {
		const cells = [{ text: 'Oat', block: 0 }, { text: 'milk', block: 1 }];
		expect(pieceSpans(cells, [first('tmi')])).toEqual([]);
		expect(pieceSpans(cells, [first('milk')])).toEqual([
			{ start: { piece: 1, offset: 0 }, end: { piece: 1, offset: 4 } },
		]);
	});

	test('colors nothing for a match on the line break between blocks', () => {
		const cells = [{ text: 'Oat', block: 0 }, { text: 'milk', block: 1 }];
		expect(pieceSpans(cells, [first('\n')])).toEqual([]);
	});

	test('passes over an empty text node', () => {
		expect(pieceSpans([{ text: '', block: 0 }, { text: 'milk', block: 0 }], [first('milk')])).toEqual([
			{ start: { piece: 1, offset: 0 }, end: { piece: 1, offset: 4 } },
		]);
	});
});

describe('queryWords', () => {
	test('reads each space-separated word, however many spaces sit between them', () => {
		expect(queryWords('oat  milk ')).toEqual(['oat', 'milk']);
	});
});
