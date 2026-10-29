import { describe, expect, test } from 'vitest';
import { drawnBlocks } from '../../src/core/drawn-blocks';

describe('drawnBlocks', () => {
	test('draws a table, header to last row', () => {
		expect(drawnBlocks('Intro\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\nAfter')).toEqual([{ lines: { start: 2, end: 5 }, kind: 'table' }]);
	});

	test('draws a table that follows a paragraph line, without that line', () => {
		expect(drawnBlocks('Text\n| a | b |\n| - | - |')).toEqual([{ lines: { start: 1, end: 3 }, kind: 'table' }]);
	});

	test('draws no table when the delimiter row has another number of cells', () => {
		expect(drawnBlocks('| a | b |\n| - |\nc')).toEqual([]);
	});

	test('draws no table from a header line without a pipe, nor from a delimiter row that ends the paragraph', () => {
		expect(drawnBlocks('a\n| - |')).toEqual([]);
		expect(drawnBlocks('| a | b |\n- | -')).toEqual([]);
	});

	test("draws no table that starts after a paragraph's first line when that line has a pipe, as @lezer/markdown", () => {
		expect(drawnBlocks('a | b\nc | d\n| - | - |\n| 1 | 2 |')).toEqual([]);
	});

	test('counts cells past escaped and outer pipes', () => {
		expect(drawnBlocks('a \\| b | c\n| - | - |')).toEqual([{ lines: { start: 0, end: 2 }, kind: 'table' }]);
		expect(drawnBlocks('| a | b\n| - | -')).toEqual([{ lines: { start: 0, end: 2 }, kind: 'table' }]);
	});

	test('draws a fence whole, an empty line inside included', () => {
		expect(drawnBlocks('```js\nx\n\ny\n```')).toEqual([{ lines: { start: 0, end: 5 }, kind: 'code' }]);
	});

	test('draws indented code', () => {
		expect(drawnBlocks('Text\n\n    code\n    more')).toEqual([{ lines: { start: 2, end: 4 }, kind: 'code' }]);
	});

	test('draws a callout whole, and nothing inside it', () => {
		const notes = '> [!note] Title\n> - a\n> - [ ] b\n>\n> | a | b |\n> | - | - |\n> | 1 | 2 |';
		expect(drawnBlocks(notes)).toEqual([{ lines: { start: 0, end: 7 }, kind: 'callout' }]);
	});

	test('draws no plain quote, nor anything inside one', () => {
		expect(drawnBlocks('> quote\n> - [ ] a\n>\n> ```\n> x\n> ```')).toEqual([]);
	});

	test('draws a $$ block whole, an empty line inside included', () => {
		expect(drawnBlocks('$$\nx\n\ny\n$$')).toEqual([{ lines: { start: 0, end: 5 }, kind: 'math' }]);
	});

	test('draws no %% comment', () => {
		expect(drawnBlocks('%%\n- [ ] a\n%%')).toEqual([]);
	});

	test('draws an embedded note alone on its line', () => {
		expect(drawnBlocks('Text\n\n![[Other note]]\n\nMore')).toEqual([{ lines: { start: 2, end: 3 }, kind: 'embed' }]);
	});

	test('draws no picture embed, nor an embed beside other text', () => {
		expect(drawnBlocks('![[p.png]]\n\nsee ![[Other note]]')).toEqual([]);
	});

	test('draws no HTML comment, which the renderer draws as nothing', () => {
		expect(drawnBlocks('Before\n\n<!-- a comment -->\n\nAfter')).toEqual([]);
	});

	test('draws an HTML block', () => {
		expect(drawnBlocks('<div>\nhi\n</div>')).toEqual([{ lines: { start: 0, end: 3 }, kind: 'html' }]);
	});

	test('draws a block inside a list item, only its own lines', () => {
		const notes = '- a\n\n  ```\n  code\n  ```\n- b\n\n  ![[Other note]]\n\n  | a | b |\n  | - | - |';
		expect(drawnBlocks(notes)).toEqual([
			{ lines: { start: 2, end: 5 }, kind: 'code' },
			{ lines: { start: 7, end: 8 }, kind: 'embed' },
			{ lines: { start: 9, end: 11 }, kind: 'table' },
		]);
	});

	test("draws no block that starts on a list item's own line", () => {
		expect(drawnBlocks('- ```\n  x\n  ```\n- a | b |\n  | - | - |\n- > [!note]\n  > x')).toEqual([]);
	});

	test('draws an unclosed fence to the end of the notes', () => {
		expect(drawnBlocks('Text\n\n```\ncode\n\nmore')).toEqual([{ lines: { start: 2, end: 6 }, kind: 'code' }]);
	});

	test('ends an unclosed fence at its last line that is not empty', () => {
		expect(drawnBlocks('Text\n\n```\ncode\n\n\n')).toEqual([{ lines: { start: 2, end: 4 }, kind: 'code' }]);
	});

	test('gives the blocks in order', () => {
		expect(drawnBlocks('$$\nx\n$$\n\n<div>\n</div>\n\n```\ny\n```').map((block) => block.kind)).toEqual(['math', 'html', 'code']);
	});
});
