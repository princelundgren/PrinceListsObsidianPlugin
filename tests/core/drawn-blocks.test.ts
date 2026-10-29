import { describe, expect, test } from 'vitest';
import { drawnBlocks, spanCrossed } from '../../src/core/drawn-blocks';

// Where each block is and what kind, apart from its Markdown, which the last tests check.
const found = (markdown: string) => drawnBlocks(markdown).map(({ lines, kind }) => ({ lines, kind }));
const markdownOf = (markdown: string) => drawnBlocks(markdown).map((block) => block.markdown);

describe('drawnBlocks', () => {
	test('draws a table, header to last row', () => {
		expect(found('Intro\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nAfter')).toEqual([{ lines: { start: 2, end: 5 }, kind: 'table' }]);
	});

	test('draws a table that follows a paragraph line, without that line', () => {
		expect(found('Text\n| a | b |\n| - | - |')).toEqual([{ lines: { start: 1, end: 3 }, kind: 'table' }]);
	});

	test('draws no table when the delimiter row has another number of cells', () => {
		expect(found('| a | b |\n| - |\nc')).toEqual([]);
	});

	test('draws no table from a header line without a pipe, nor from a delimiter row that ends the paragraph', () => {
		expect(found('a\n| - |')).toEqual([]);
		expect(found('| a | b |\n- | -')).toEqual([]);
	});

	test("draws no table that starts after a paragraph's first line when that line has a pipe, as @lezer/markdown", () => {
		expect(found('a | b\nc | d\n| - | - |\n| 1 | 2 |')).toEqual([]);
	});

	test('counts cells past escaped and outer pipes', () => {
		expect(found('a \\| b | c\n| - | - |')).toEqual([{ lines: { start: 0, end: 2 }, kind: 'table' }]);
		expect(found('| a | b\n| - | -')).toEqual([{ lines: { start: 0, end: 2 }, kind: 'table' }]);
	});

	test('draws a fence whole, an empty line inside included', () => {
		expect(found('```js\nx\n\ny\n```')).toEqual([{ lines: { start: 0, end: 5 }, kind: 'code' }]);
	});

	test('draws indented code', () => {
		expect(found('Text\n\n    code\n    more')).toEqual([{ lines: { start: 2, end: 4 }, kind: 'code' }]);
	});

	test('draws a callout whole, and nothing inside it', () => {
		const notes = '> [!note] Title\n> - a\n> - [ ] b\n>\n> | a | b |\n> | - | - |\n> | 1 | 2 |';
		expect(found(notes)).toEqual([{ lines: { start: 0, end: 7 }, kind: 'callout' }]);
	});

	test('draws no plain quote, nor anything inside one', () => {
		expect(found('> quote\n> - [ ] a\n>\n> ```\n> x\n> ```')).toEqual([]);
	});

	test('draws a $$ block whole, an empty line inside included', () => {
		expect(found('$$\nx\n\ny\n$$')).toEqual([{ lines: { start: 0, end: 5 }, kind: 'math' }]);
	});

	test('draws no %% comment', () => {
		expect(found('%%\n- [ ] a\n%%')).toEqual([]);
	});

	test('draws an embedded note alone on its line', () => {
		expect(found('Text\n\n![[Other note]]\n\nMore')).toEqual([{ lines: { start: 2, end: 3 }, kind: 'embed' }]);
	});

	test('draws no picture embed, nor an embed beside other text', () => {
		expect(found('![[p.png]]\n\nsee ![[Other note]]')).toEqual([]);
	});

	test('draws no HTML comment, which the renderer draws as nothing', () => {
		expect(found('Before\n\n<!-- a comment -->\n\nAfter')).toEqual([]);
	});

	test('draws an HTML block', () => {
		expect(found('<div>\nhi\n</div>')).toEqual([{ lines: { start: 0, end: 3 }, kind: 'html' }]);
	});

	test('draws a block inside a list item, only its own lines', () => {
		const notes = '- a\n\n  ```\n  code\n  ```\n- b\n\n  ![[Other note]]\n\n  | a | b |\n  | - | - |';
		expect(found(notes)).toEqual([
			{ lines: { start: 2, end: 5 }, kind: 'code' },
			{ lines: { start: 7, end: 8 }, kind: 'embed' },
			{ lines: { start: 9, end: 11 }, kind: 'table' },
		]);
	});

	test("draws no block that starts on a list item's own line", () => {
		expect(found('- ```\n  x\n  ```\n- a | b |\n  | - | - |\n- > [!note]\n  > x')).toEqual([]);
	});

	test('draws an unclosed fence to the end of the notes', () => {
		expect(found('Text\n\n```\ncode\n\nmore')).toEqual([{ lines: { start: 2, end: 6 }, kind: 'code' }]);
	});

	test('ends an unclosed fence at its last line that is not empty', () => {
		expect(found('Text\n\n```\ncode\n\n\n')).toEqual([{ lines: { start: 2, end: 4 }, kind: 'code' }]);
	});

	test('gives the blocks in order', () => {
		expect(found('$$\nx\n$$\n\n<div>\n</div>\n\n```\ny\n```').map((block) => block.kind)).toEqual(['math', 'html', 'code']);
	});
});

describe('spanCrossed', () => {
	const spans = [
		{ from: 10, to: 20 },
		{ from: 30, to: 40 },
	];

	test('going down, gives the first span whose start it passes or reaches', () => {
		expect(spanCrossed(spans, 5, 35)).toEqual({ from: 10, to: 20 });
		expect(spanCrossed(spans, 5, 10)).toEqual({ from: 10, to: 20 });
	});

	test('going up, gives the first span whose end it passes or reaches', () => {
		expect(spanCrossed(spans, 45, 15)).toEqual({ from: 30, to: 40 });
		expect(spanCrossed(spans, 45, 40)).toEqual({ from: 30, to: 40 });
	});

	test('gives none for a move that stops short, or starts at the edge it would cross', () => {
		expect(spanCrossed(spans, 5, 9)).toBeUndefined();
		expect(spanCrossed(spans, 10, 25)).toBeUndefined();
		expect(spanCrossed(spans, 20, 5)).toBeUndefined();
		expect(spanCrossed(spans, 25, 25)).toBeUndefined();
	});
});

describe("a drawn block's Markdown", () => {
	test("is its lines less the first line's indent", () => {
		expect(markdownOf('- a\n\n  ```js\n  x\n    y\n  ```')).toEqual(['```js\nx\n  y\n```']);
		expect(markdownOf('- a\n\n  | a | b |\n  | - | - |')).toEqual(['| a | b |\n| - | - |']);
	});

	test('keeps indented code as code, as CommonMark reads it', () => {
		expect(markdownOf('p\n\n    code\n\n      more')).toEqual(['    code\n    \n      more']);
		expect(markdownOf('p\n\n        a\n    b')).toEqual(['        a\n    b']);
		expect(markdownOf('- a\n\n        deep\n      shallow')).toEqual(['      deep\n    shallow']);
		expect(markdownOf('p\n\n\tcode\n    more')).toEqual(['    code\n    more']);
		expect(markdownOf('- a\n\n      %%\n      hidden\n      %%')).toEqual(['    %%\n    hidden\n    %%']);
	});

	test('keeps indented code that starts with a fence as code', () => {
		expect(markdownOf('p\n\n    ```\n    x')).toEqual(['    ```\n    x']);
	});

	test('is a tilde fence less its indent', () => {
		expect(markdownOf('- a\n\n  ~~~\n  x\n  ~~~')).toEqual(['~~~\nx\n~~~']);
	});
});
