import { describe, expect, test } from 'vitest';
import { splitAtx } from '../../src/core/edit-headings';

describe('splitAtx', () => {
	test.each([
		['## a', { open: '##', gap: ' ', content: 'a', close: '' }],
		['## a ##  ', { open: '##', gap: ' ', content: 'a', close: ' ##  ' }],
		['## a#', { open: '##', gap: ' ', content: 'a#', close: '' }],
		['## a ## ##', { open: '##', gap: ' ', content: 'a ##', close: ' ##' }],
		['## #', { open: '##', gap: '', content: '', close: ' #' }],
		['##   \t', { open: '##', gap: '   \t', content: '', close: '' }],
		['  #\ta \t', { open: '  #', gap: '\t', content: 'a', close: ' \t' }],
	])('%j', (text, parts) => {
		expect(splitAtx(text)).toEqual(parts);
	});
	test('a long run of spaces inside a heading splits in under 100 ms', () => {
		const text = `## a${' '.repeat(50_000)}x`;
		const start = performance.now();
		expect(splitAtx(text)?.content).toBe(text.slice(3));
		expect(performance.now() - start).toBeLessThan(100);
	});
});
