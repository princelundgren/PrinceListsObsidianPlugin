import { describe, expect, test } from 'vitest';
import { mapPieceRange, setNotesPiece, type PieceSession } from '../../src/core/edit-piece';
import { joinLines, splitLines } from '../../src/core/lines';
import { crlf, list } from './edit-helpers';

const FRONTMATTER = '---\nprincelists: true\n---\n';

function save(text: string, piece: PieceSession, typed: string) {
	const { lines, model, item } = list(text);
	const result = setNotesPiece(lines, model, item(0), piece, typed);
	return { text: joinLines(result.lines), piece: result.piece };
}

describe('setNotesPiece', () => {
	test('changes only the piece it saves, byte for byte everywhere else', () => {
		const before = (second: string) =>
			crlf(`${FRONTMATTER}- [ ] a\n\n\tfirst para\nlazy line\n\t \n${second}\n\tthird para\n- [ ] b\n`);
		const result = save(before('\tsecond para'), { range: { start: 8, end: 9 }, indent: '\t', separator: false }, 'second\nmore');
		expect(result.text).toBe(before('\tsecond\n\tmore'));
		expect(result.piece.range).toEqual({ start: 8, end: 10 });
	});

	test('gives a new piece at the end an empty line before it, and takes it again when erased', () => {
		const text = `${FRONTMATTER}- [ ] a\n\n\tfirst\n- [ ] b\n`;
		const added = save(text, { range: { start: 6, end: 6 }, indent: '\t', separator: true }, 'new');
		expect(added.text).toBe(`${FRONTMATTER}- [ ] a\n\n\tfirst\n\n\tnew\n- [ ] b\n`);
		expect(added.piece).toEqual({ range: { start: 7, end: 8 }, indent: '\t', separator: true });
		const erased = save(added.text, added.piece, '');
		expect(erased.text).toBe(text);
		expect(erased.piece.range).toEqual({ start: 6, end: 6 });
	});

	test('puts a new item after a nested one on the next line, with no empty line', () => {
		const text = `${FRONTMATTER}- [ ] a\n\t- x\n- [ ] b\n`;
		const result = save(text, { range: { start: 5, end: 5 }, indent: '\t', separator: false }, '- y');
		expect(result.text).toBe(`${FRONTMATTER}- [ ] a\n\t- x\n\t- y\n- [ ] b\n`);
	});
});

describe('mapPieceRange', () => {
	const before = splitLines('a\n\none\ntwo\nthree\n');

	test('moves an empty new range with the line before it', () => {
		const after = splitLines('top\na\n\none\ntwo\nthree\n');
		expect(mapPieceRange(before, after, { start: 5, end: 5 })).toEqual({ start: 6, end: 6 });
	});

	test('loses a piece whose middle line changed', () => {
		const after = splitLines('a\n\none\nTWO\nthree\n');
		expect(mapPieceRange(before, after, { start: 2, end: 5 })).toBeNull();
	});
});
