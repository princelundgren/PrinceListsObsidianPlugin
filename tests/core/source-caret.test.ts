import { describe, expect, it } from 'vitest';
import { sourceCaret } from '../../src/core/source-caret';

describe('sourceCaret', () => {
	it('puts the caret on the clicked character of plain text', () => {
		expect(sourceCaret('paste\nnori\ntofu', ['paste', 'nori', 'tofu'], { index: 1, at: 2 })).toBe(8);
	});

	it('steps over the markup around formatted text', () => {
		expect(sourceCaret('a **bold** word', ['a ', 'bold', ' word'], { index: 2, at: 3 })).toBe(13);
	});

	it('finds a repeated text where it comes in order', () => {
		expect(sourceCaret('tofu\ntofu', ['tofu', 'tofu'], { index: 1, at: 1 })).toBe(6);
	});

	it('skips text hidden in the markup of an earlier part', () => {
		expect(sourceCaret('[[tofu|soup]] tofu', ['soup', ' tofu'], { index: 1, at: 1 })).toBe(14);
	});

	it('puts the caret at the end of the line of a part drawn in place of its markup', () => {
		expect(sourceCaret('see [[Miso]] here\nnext', ['see ', 'Miso', ' here', 'next'], { index: 1, at: null })).toBe(17);
	});

	it('puts the caret at the end of the line of a picture on a line of its own', () => {
		expect(sourceCaret('one\n![[box.png]]\ntwo', ['one', 'two'], { index: 1, at: null })).toBe(16);
	});

	it('puts the caret at the end of the line when the clicked text differs from the source', () => {
		expect(sourceCaret('a \\*b\\* c\nnext', ['a *b* c', 'next'], { index: 0, at: 3 })).toBe(9);
	});

	it('puts the caret at the end for a drawn part after the last text', () => {
		expect(sourceCaret('one\n\n![[box.png]]', ['one'], { index: 1, at: null })).toBe(17);
	});

	it('ignores whitespace-only texts between rendered blocks', () => {
		expect(sourceCaret('- tofu\n- tofu\n- miso', ['\n', 'tofu', '\n', 'tofu', '\n', 'miso', '\n'], { index: 3, at: 1 })).toBe(10);
	});

	it('opens an empty source at its start', () => {
		expect(sourceCaret('', [], { index: 0, at: null })).toBe(0);
	});
});
