import { expect, test } from 'vitest';
import { pastedData, pasteSource } from '../../src/core/clipboard';

const HTML = '<b>Milk</b>';

test.each([
	[['text/plain', 'text/html'], 'Milk', HTML, 'markdown', 'html'],
	[['text/plain', 'text/html'], 'Milk', HTML, 'plain', 'text'],
	// Obsidian's editor copies a note's Markdown with HTML drawn from it: the Markdown is what was copied.
	[['text/plain', 'text/markdown', 'text/html'], 'Milk', HTML, 'markdown', 'text'],
	[['text/plain'], 'Milk', '', 'markdown', 'text'],
	// A spreadsheet copies a picture of its text along with it: the text wins.
	[['text/plain', 'text/html', 'image/png'], 'Milk', HTML, 'markdown', 'html'],
	[['text/plain', 'image/png'], 'Milk', '', 'plain', 'text'],
	// A browser's Copy image puts the picture with HTML that links to it: the picture wins.
	[['text/html', 'image/png'], '', HTML, 'markdown', 'pictures'],
	[['image/png'], '', '', 'plain', 'pictures'],
	[[], '', '', 'markdown', 'pictures'],
	// A type listed with nothing in it counts as missing.
	[['text/plain', 'text/html', 'image/png'], '', HTML, 'markdown', 'pictures'],
	[['text/plain', 'text/html'], 'Milk', '', 'markdown', 'text'],
] as const)('%j holding %j and %j, pasted as %s, takes the %s', (types, text, html, as, expected) => {
	expect(pasteSource({ types, text, html }, as)).toBe(expected);
});

test('pastes the text of HTML that Obsidian marks as drawn from Markdown', () => {
	const html = '<meta charset="utf-8"><!-- obsidian --><p>Milk</p>';
	expect(pasteSource({ types: ['text/plain', 'text/html'], text: 'Milk', html }, 'markdown')).toBe('text');
});

test('reads a paste event’s text and HTML', () => {
	const values: Record<string, string> = { 'text/plain': 'Milk', 'text/html': HTML };
	const data = { types: ['text/plain', 'text/html'], getData: (type: string) => values[type] ?? '' };
	expect(pastedData(data)).toEqual({ types: ['text/plain', 'text/html'], text: 'Milk', html: HTML });
});
