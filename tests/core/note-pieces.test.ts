import { describe, expect, test } from 'vitest';
import { blockAfter, blockBelow, notePieces, pieceText } from '../../src/core/note-pieces';
import type { NotesChange } from '../../src/core/notes-lines';

const NOTES = [
	'Intro paragraph',
	'second line',
	'',
	'| a | b |',
	'| - | - |',
	'| 1 | 2 |',
	'',
	'```js',
	'let x = 1;',
	'',
	'let y = 2;',
	'```',
	'',
	'> [!note] Callout',
	'> - [ ] inside callout',
	'',
	'1. first',
	'   - [ ] child a',
	'     - grand',
	'   - [x] child b',
	'2. second',
	'',
	'$$',
	'a',
	'',
	'b',
	'$$',
	'',
	'[ref]: https://example.com',
].join('\n');

const LIST = { start: 16, end: 21 };

describe('notePieces', () => {
	test('gives one range per top-level block, a whole list as one, and a link definition its own', () => {
		expect(notePieces(NOTES)).toEqual([
			{ start: 0, end: 2 },
			{ start: 3, end: 6 },
			{ start: 7, end: 12 },
			{ start: 13, end: 15 },
			LIST,
			{ start: 22, end: 27 },
			{ start: 28, end: 29 },
		]);
	});
});

describe('notePieces edge cases', () => {
	test.each([
		['CRLF line endings', 'a\r\n\r\n- b\r\n- c\r\n', [{ start: 0, end: 1 }, { start: 2, end: 4 }]],
		['a list right after a paragraph', 'a\n- b\n- c', [{ start: 0, end: 1 }, { start: 1, end: 3 }]],
		['a loose list', '- a\n\n- b\n\n\nc', [{ start: 0, end: 3 }, { start: 5, end: 6 }]],
		['an unclosed fence', '```\na\n\nb', [{ start: 0, end: 4 }]],
		['a %% block with an empty line inside', '%%\n- [ ] a\n\nb\n%%', [{ start: 0, end: 5 }]],
	])('splits %s', (_, notes, pieces) => {
		expect(notePieces(notes)).toEqual(pieces);
	});

	test("gives a nested item's text in a CRLF note", () => {
		const notes = '- a\r\n  - b\r\n';
		expect(pieceText(notes, { start: 1, end: 2 })).toEqual({ text: '- b', indent: '  ' });
	});
});

describe('pieceText', () => {
	test('takes the first line indent off every line of a nested item', () => {
		expect(pieceText(NOTES, { start: 17, end: 19 })).toEqual({ text: '- [ ] child a\n  - grand', indent: '   ' });
	});
});

describe('blockAfter', () => {
	test('a block added after a paragraph goes right after it', () => {
		expect(blockAfter('para one\n\npara two', { start: 0, end: 1 })).toBe(1);
	});

	test('a block added after an item goes after its whole list', () => {
		expect(blockAfter('- a\n- b\n- c\n\nafter', { start: 1, end: 2 })).toBe(3);
	});

	test('a block added after a heading goes after the paragraph right under it', () => {
		expect(blockAfter('### H\npara\n\nnext', { start: 0, end: 1 })).toBe(2);
	});

	test('a block added where an emptied item was goes after its list', () => {
		expect(blockAfter('- x\n- z\n\nafter', { start: 1, end: 1 })).toBe(2);
		expect(blockAfter('- x\n\nafter', { start: 1, end: 1 })).toBe(1);
	});

	test('a block added goes after every piece that follows with no empty line between', () => {
		expect(blockAfter('### A\n### B\npara\n\nnext', { start: 0, end: 1 })).toBe(3);
	});

	test('a block added after the last piece goes at the end of the notes', () => {
		expect(blockAfter('one\n\ntwo', { start: 2, end: 3 })).toBe(3);
	});
});

describe('blockBelow', () => {
	const PICTURE = ['![[p.png]]'];
	// The notes after the change, and the line the caret goes to.
	const added = (markdown: string, line: number, block = PICTURE) => {
		const { change, caret } = blockBelow(markdown, line, block);
		return { notes: applied(markdown, change), caret };
	};
	const applied = (markdown: string, { from, to, lines }: NotesChange) => {
		const old = markdown.split('\n');
		return [...old.slice(0, from), ...lines, ...old.slice(to)].join('\n');
	};

	test('takes the place of the empty last line of notes that end in a line break', () => {
		expect(added('one\n', 1)).toEqual({ notes: 'one\n\n![[p.png]]\n', caret: 3 });
	});

	test('adds no second empty line after a paragraph followed by the empty last line', () => {
		expect(added('one\n', 0)).toEqual({ notes: 'one\n\n![[p.png]]\n', caret: 3 });
	});

	test("goes after the caret's paragraph, with the caret on the empty line below it", () => {
		expect(added('one\ntwo\n\nnext', 0)).toEqual({ notes: 'one\ntwo\n\n![[p.png]]\n\nnext', caret: 4 });
	});

	test("goes after the whole list of the caret's item", () => {
		expect(added('- a\n- b\n\nafter', 0)).toEqual({ notes: '- a\n- b\n\n![[p.png]]\n\nafter', caret: 4 });
		expect(added('- a\n\n- b\n\nafter', 1)).toEqual({ notes: '- a\n\n- b\n\n![[p.png]]\n\nafter', caret: 5 });
	});

	test('goes after a table', () => {
		expect(added('| a | b |\n| - | - |\n| 1 | 2 |', 1)).toEqual({ notes: '| a | b |\n| - | - |\n| 1 | 2 |\n\n![[p.png]]\n', caret: 5 });
	});

	test('adds an empty line for the caret after the last block', () => {
		expect(added('one', 0)).toEqual({ notes: 'one\n\n![[p.png]]\n', caret: 3 });
	});

	test('takes the place of an empty line between blocks, keeping one empty line on each side', () => {
		expect(added('one\n\n\ntwo', 1)).toEqual({ notes: 'one\n\n![[p.png]]\n\ntwo', caret: 3 });
		expect(added('one\n\n\ntwo', 2)).toEqual({ notes: 'one\n\n![[p.png]]\n\ntwo', caret: 3 });
	});

	test('takes the place of empty notes', () => {
		expect(added('', 0)).toEqual({ notes: '![[p.png]]\n', caret: 1 });
	});

	test('puts the caret below a block of more than one line', () => {
		expect(added('one', 0, ['![[p.png]]', '![[q.png]]'])).toEqual({ notes: 'one\n\n![[p.png]]\n![[q.png]]\n', caret: 4 });
	});
});
