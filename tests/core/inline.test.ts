import { HtmlRenderer, Parser } from 'commonmark';
import { describe, expect, test } from 'vitest';
import { asInline, needsMarkdown } from '../../src/core/inline';

const render = (markdown: string) => new HtmlRenderer().render(new Parser().parse(markdown));

describe('asInline', () => {
	// What the title shows in a note, where it follows `[ ] ` in the item's paragraph, rendered alone:
	// one paragraph of exactly that text.
	test.each([
		'# of eggs',
		'## two',
		'#',
		'> quoted',
		'> [!note] callout',
		'- dash',
		'+ plus',
		'* star',
		'---',
		'***',
		'_ _ _',
		'1. call mom',
		'2024) a year',
		'```js',
		'~~~',
		'[a]: b',
		'[^1]: footnote',
	])('%j renders as one paragraph of itself', (text) => {
		expect(render(asInline(text))).toBe(`<p>${text.replace(/>/g, '&gt;')}</p>\n`);
	});

	test('leading whitespace goes, since a paragraph drops it and four spaces would make code', () => {
		expect(render(asInline('    code?'))).toBe('<p>code?</p>\n');
	});

	test('inline Markdown is left as it is', () => {
		for (const text of ['**bold** and [[link]]', '*em*', '_em_', '#tag first', '-1 degrees', '1.5 liters', '`code`']) {
			expect(asInline(text)).toBe(text);
		}
	});
});

describe('needsMarkdown', () => {
	test('plain words, numbers and punctuation render as themselves', () => {
		for (const text of ['Buy milk', '1. call mom', '- dash', '> quoted', 'Tomorrow, 9:30 (maybe)?', 'Café’s list', '']) {
			expect(needsMarkdown(text)).toBe(false);
		}
	});

	test('anything Markdown or Obsidian gives a meaning to is rendered', () => {
		for (const text of [
			'**bold**',
			'_em_',
			'`code`',
			'~~gone~~',
			'==mark==',
			'[[link]]',
			'![[pic.png]]',
			'[a](b)',
			'<b>x</b>',
			'&amp;',
			'$x$',
			'%%hidden%%',
			'a #tag',
			'see https://example.com',
			'www.example.com',
			'me@example.com',
			'a\\b',
		]) {
			expect(needsMarkdown(text), text).toBe(true);
		}
	});
});
