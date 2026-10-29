import { describe, expect, test } from 'vitest';
import { blockAfter, blockBelow, holdsOnly, itemPieces, neighborPiece, nextItemMarker, notePieces, outdentMarker, pieceEnter, pieceText } from '../../src/core/note-pieces';
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

	test('gives item pieces and their text in a CRLF note', () => {
		const notes = '- a\r\n  - b\r\n';
		expect(itemPieces(notes, { start: 0, end: 2 })).toEqual([{ start: 0, end: 2 }, { start: 1, end: 2 }]);
		expect(pieceText(notes, { start: 1, end: 2 })).toEqual({ text: '- b', indent: '  ' });
	});
});

describe('itemPieces', () => {
	test('gives every item of a list at any depth, in document order, over its nested items', () => {
		expect(itemPieces(NOTES, LIST)).toEqual([
			{ start: 16, end: 20 },
			{ start: 17, end: 19 },
			{ start: 18, end: 19 },
			{ start: 19, end: 20 },
			{ start: 20, end: 21 },
		]);
	});

	test('gives none from a list inside a callout', () => {
		expect(itemPieces(NOTES, { start: 13, end: 15 })).toEqual([]);
	});
});

describe('pieceText', () => {
	test('takes the first line indent off every line of a nested item', () => {
		expect(pieceText(NOTES, { start: 17, end: 19 })).toEqual({ text: '- [ ] child a\n  - grand', indent: '   ' });
	});
});

describe('nextItemMarker', () => {
	test.each([
		['- [x] a', '- [ ] '],
		['\t3. b', '\t4. '],
		['1) c', '2) '],
		['* d', '* '],
		['9. e', '10. '],
		['- [x]', '- [ ] '],
		['* * *', null],
		['plain text', null],
	])('gives the item after %j', (line, marker) => {
		expect(nextItemMarker(line)).toBe(marker);
	});
});

describe('pieceEnter', () => {
	test('starts the next item from the end of the last line, an item with text', () => {
		expect(pieceEnter('- [ ] a', 7, false)).toEqual({ kind: 'nextItem', marker: '- [ ] ' });
	});

	test('adds an item inside the field from the end of an earlier item with text', () => {
		expect(pieceEnter('- [ ] a\n- [ ] b', 7, false)).toEqual({
			kind: 'edit',
			edit: { from: 7, to: 7, insert: '\n- [ ] ', selectionStart: 14, selectionEnd: 14 },
		});
	});

	test('turns an empty nested item inside the field into the item one level out', () => {
		const text = '1. a\n   - [ ] ';
		expect(pieceEnter(text, text.length, false)).toEqual({
			kind: 'edit',
			edit: { from: 5, to: 14, insert: '2. ', selectionStart: 8, selectionEnd: 8 },
		});
	});

	test('outdents an empty item at the field own indent when the piece is nested', () => {
		expect(pieceEnter('- [ ] ', 6, true)).toEqual({ kind: 'outdent' });
		expect(pieceEnter('- [ ] b\n- [ ] ', 14, true)).toEqual({ kind: 'outdent' });
	});

	test('takes the field own indent from its first line with text, past a new piece empty line', () => {
		expect(pieceEnter('\n  - a\n  - ', 12, false)).toEqual({ kind: 'endList' });
	});

	test('ends the list on an empty item at the field own indent when the piece is not nested', () => {
		expect(pieceEnter('- [ ] a\n- [ ] ', 14, false)).toEqual({ kind: 'endList' });
	});

	test('is a plain new line with the caret before an empty item marker', () => {
		expect(pieceEnter('- [x] ', 0, false)).toEqual({ kind: 'newline' });
		expect(pieceEnter('- a\n\t- [ ] ', 4, false)).toEqual({ kind: 'newline' });
	});

	test('compares a tab indent with the field own indent by column', () => {
		const text = '- a\n\t- ';
		expect(pieceEnter(text, text.length, false)).toEqual({
			kind: 'edit',
			edit: { from: 4, to: 7, insert: '- ', selectionStart: 6, selectionEnd: 6 },
		});
	});

	test('ends the list on an empty ticked item with no space after it', () => {
		expect(pieceEnter('- a\n- [x]', 9, false)).toEqual({ kind: 'endList' });
	});

	test.each([
		['a fenced code piece', '```\n- x\n```', 7],
		['a paragraph with a numbered lazy line', 'a\n2. foo', 8],
		['a code block inside an item', '- a\n  ```\n  - x\n  ```', 15],
	])('is a plain new line at the end of a list-like line in %s', (_, text, caret) => {
		expect(pieceEnter(text, caret, false)).toEqual({ kind: 'newline' });
	});

	test('is a plain new line after a thematic break', () => {
		expect(pieceEnter('* * *', 5, false)).toEqual({ kind: 'newline' });
	});

	test('is a plain new line elsewhere', () => {
		expect(pieceEnter('hello', 5, false)).toEqual({ kind: 'newline' });
		expect(pieceEnter('- [ ] abc', 7, false)).toEqual({ kind: 'newline' });
	});
});

describe('neighborPiece', () => {
	const ranges = [
		{ start: 13, end: 15 },
		{ start: 16, end: 20 },
		{ start: 17, end: 19 },
		{ start: 18, end: 19 },
		{ start: 19, end: 20 },
		{ start: 20, end: 21 },
	];

	test('goes up from a first child into its parent', () => {
		expect(neighborPiece(ranges, { start: 17, end: 19 }, 'up')).toEqual({ start: 16, end: 20 });
	});

	test('goes down past the items nested in the current one, which its field holds', () => {
		expect(neighborPiece(ranges, { start: 16, end: 20 }, 'down')).toEqual({ start: 20, end: 21 });
		expect(neighborPiece(ranges, { start: 18, end: 19 }, 'down')).toEqual({ start: 19, end: 20 });
	});

	test('goes either way from a piece emptied of its lines', () => {
		expect(neighborPiece(ranges, { start: 19, end: 19 }, 'down')).toEqual({ start: 19, end: 20 });
		expect(neighborPiece(ranges, { start: 19, end: 19 }, 'up')).toEqual({ start: 18, end: 19 });
	});

	test('gives null past either end', () => {
		expect(neighborPiece(ranges, { start: 13, end: 15 }, 'up')).toBeNull();
		expect(neighborPiece(ranges, { start: 20, end: 21 }, 'down')).toBeNull();
	});
});

describe('outdentMarker', () => {
	const notes = '- p\n  - q\n```\ncode\n```';
	const lines = notes.split('\n');

	test('reads the list a new item would end, not the fence right after it', () => {
		expect(notePieces(notes)).toEqual([{ start: 0, end: 2 }, { start: 2, end: 5 }]);
		expect(outdentMarker(notes, lines, { start: 2, end: 2 }, '  - ')).toBe('- ');
	});

	test('reads the list an item is in', () => {
		expect(outdentMarker(notes, lines, { start: 1, end: 2 }, '  - ')).toBe('- ');
	});
});

describe('holdsOnly', () => {
	test('empty notes hold only the new piece', () => {
		expect(holdsOnly('', { start: 0, end: 0 })).toBe(true);
	});

	test('a new piece after another is not alone', () => {
		expect(holdsOnly('Para', { start: 1, end: 1 })).toBe(false);
	});

	test('the only piece, emptied or not, is alone', () => {
		expect(holdsOnly('Para\nmore', { start: 0, end: 2 })).toBe(true);
		expect(holdsOnly('', { start: 0, end: 1 })).toBe(true);
	});

	test('one of two pieces is not alone', () => {
		expect(holdsOnly('One\n\nTwo', { start: 2, end: 3 })).toBe(false);
	});

	test('an item open inside a longer list is not alone', () => {
		expect(holdsOnly('- a\n- b', { start: 1, end: 2 })).toBe(false);
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
