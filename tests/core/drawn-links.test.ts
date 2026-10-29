import { describe, expect, test } from 'vitest';
import { isWebAddress, linkTarget, pictureLook } from '../../src/core/drawn-links';

describe('linkTarget', () => {
	test('reads an address with a scheme as a web link', () => {
		expect(linkTarget('https://example.com/a')).toEqual({ kind: 'web', href: 'https://example.com/a' });
		expect(linkTarget('mailto:a@b.c')).toEqual({ kind: 'web', href: 'mailto:a@b.c' });
	});

	test('reads a script or data address as unsafe, in any case', () => {
		expect(linkTarget('javascript:alert(1)')).toEqual({ kind: 'unsafe' });
		expect(linkTarget('JavaScript:x')).toEqual({ kind: 'unsafe' });
		expect(linkTarget('vbscript:x')).toEqual({ kind: 'unsafe' });
		expect(linkTarget('data:text/html,hi')).toEqual({ kind: 'unsafe' });
	});

	test('reads any other address as a vault path, decoded', () => {
		expect(linkTarget('Some%20note.md')).toEqual({ kind: 'vault', linktext: 'Some note.md' });
	});

	test('keeps a stray percent sign as written', () => {
		expect(linkTarget('100%.md')).toEqual({ kind: 'vault', linktext: '100%.md' });
	});

	test('unwraps an address in angle brackets', () => {
		expect(linkTarget('<a b.md>')).toEqual({ kind: 'vault', linktext: 'a b.md' });
		expect(linkTarget('<javascript:x>')).toEqual({ kind: 'unsafe' });
	});
});

describe('pictureLook', () => {
	test('gives a wiki embed its path as alt text', () => {
		expect(pictureLook('![[Attachments/p.png]]')).toEqual({ alt: 'Attachments/p.png', size: null });
	});

	test('reads a size after the bar, keeping the path as alt text', () => {
		expect(pictureLook('![[p.png|100]]')).toEqual({ alt: 'p.png', size: '100' });
		expect(pictureLook('![[p.png|50x40]]')).toEqual({ alt: 'p.png', size: '50x40' });
	});

	test('reads a caption after the bar as alt text, with a size after it', () => {
		expect(pictureLook('![[p.png|a caption]]')).toEqual({ alt: 'a caption', size: null });
		expect(pictureLook('![[p.png|cap|100]]')).toEqual({ alt: 'cap', size: '100' });
	});

	test('reads a Markdown picture\'s alt text and size', () => {
		expect(pictureLook('![my alt](p.png)')).toEqual({ alt: 'my alt', size: null });
		expect(pictureLook('![my alt|100](p.png)')).toEqual({ alt: 'my alt', size: '100' });
	});

	test('gives a Markdown picture without alt text none', () => {
		expect(pictureLook('![](p.png)')).toEqual({ alt: null, size: null });
		expect(pictureLook('![|60x30](p.png)')).toEqual({ alt: null, size: '60x30' });
	});
});

describe('isWebAddress', () => {
	test('accepts http and https addresses, in any case', () => {
		expect(isWebAddress('https://example.com')).toBe(true);
		expect(isWebAddress('HTTP://example.com')).toBe(true);
	});

	test('refuses every other scheme', () => {
		expect(isWebAddress('file:///tmp/x')).toBe(false);
		expect(isWebAddress('obsidian://open?vault=x')).toBe(false);
		expect(isWebAddress('mailto:a@b.c')).toBe(false);
		expect(isWebAddress('javascript:alert(1)')).toBe(false);
	});
});
