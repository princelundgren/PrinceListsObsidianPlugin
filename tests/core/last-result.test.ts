import { expect, test, vi } from 'vitest';
import { rememberLast } from '../../src/core/last-result';

test('the same text computes once and returns the same result', () => {
	const compute = vi.fn((text: string) => ({ length: text.length }));
	const parse = rememberLast(compute);
	const first = parse('- [ ] a\n');
	expect(parse('- [ ] a\n')).toBe(first);
	expect(compute).toHaveBeenCalledTimes(1);
});

test('another text computes again, and so does a return to the first', () => {
	const compute = vi.fn((text: string) => text.toUpperCase());
	const parse = rememberLast(compute);
	expect(parse('a')).toBe('A');
	expect(parse('b')).toBe('B');
	expect(parse('a')).toBe('A');
	expect(compute).toHaveBeenCalledTimes(3);
});

test('an empty text is remembered like any other', () => {
	const compute = vi.fn((text: string) => [text]);
	const parse = rememberLast(compute);
	parse('');
	parse('');
	expect(compute).toHaveBeenCalledTimes(1);
});
