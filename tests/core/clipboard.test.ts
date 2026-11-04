import { expect, test } from 'vitest';
import { pasteSource } from '../../src/core/clipboard';

test.each([
	[['text/plain', 'text/html'], 'markdown', 'html'],
	[['text/plain', 'text/html'], 'plain', 'text'],
	// Obsidian's editor copies a note's Markdown with HTML drawn from it: the Markdown is what was copied.
	[['text/plain', 'text/markdown', 'text/html'], 'markdown', 'text'],
	[['text/plain'], 'markdown', 'text'],
	// A spreadsheet copies a picture of its text along with it: the text wins.
	[['text/plain', 'text/html', 'image/png'], 'markdown', 'html'],
	[['text/plain', 'image/png'], 'plain', 'text'],
	// A browser's Copy image puts the picture with HTML that links to it: the picture wins.
	[['text/html', 'image/png'], 'markdown', 'pictures'],
	[['image/png'], 'plain', 'pictures'],
	[[], 'markdown', 'pictures'],
] as const)('%j pasted as %s takes the %s', (types, as, expected) => {
	expect(pasteSource(types, as, '<b>Milk</b>')).toBe(expected);
});

test('pastes the text of HTML that Obsidian marks as drawn from Markdown', () => {
	expect(pasteSource(['text/plain', 'text/html'], 'markdown', '<meta charset="utf-8"><!-- obsidian --><p>Milk</p>')).toBe('text');
});
