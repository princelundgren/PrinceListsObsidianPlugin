// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { FIND_HIGHLIGHT, FindPaint } from '../../src/view/find-highlight';
import { LIST_BLOCK_CLASS } from '../../src/view/own-rows';
import { findOf } from './find-helpers';

// Obsidian gives every node `doc` and `win`; jsdom has neither, nor the CSS Custom Highlight API.
Object.defineProperty(Node.prototype, 'doc', { configurable: true, get(this: Node) { return this.ownerDocument; } });
Object.defineProperty(Node.prototype, 'win', { configurable: true, get(this: Node) { return this.ownerDocument?.defaultView; } });
class FakeHighlight extends Set<AbstractRange> {}

const css = window.CSS as { highlights?: Map<string, FakeHighlight> };
const withHighlightApi = () => {
	css.highlights = new Map();
	(window as unknown as { Highlight: typeof FakeHighlight }).Highlight = FakeHighlight;
};
const colored = () => [...(css.highlights?.get(FIND_HIGHLIGHT) ?? [])].map((range) => (range as Range).toString());

const element = (tag: string, cls: string, ...parts: (string | Node)[]) => {
	const el = document.createElement(tag);
	if (cls) el.className = cls;
	el.append(...parts);
	return el;
};
const title = (...parts: (string | Node)[]) => document.body.appendChild(element('div', '', ...parts));

beforeEach(withHighlightApi);
afterEach(() => {
	document.body.replaceChildren();
	delete css.highlights;
});

describe('FindPaint', () => {
	test('colors each match in an element, across its formatting', () => {
		new FindPaint().paint(title('Oat ', element('b', '', 'mi'), 'lk and more milk'), findOf('milk'));
		expect(colored()).toEqual(['milk', 'milk']);
	});

	test('colors no match that runs from one block into the next', () => {
		new FindPaint().paint(title(element('p', '', 'mi'), element('p', '', 'lk')), findOf('milk'));
		expect(colored()).toEqual([]);
	});

	test('leaves out the text of a list block inside the element', () => {
		new FindPaint().paint(title('milk ', element('div', LIST_BLOCK_CLASS, 'milk')), findOf('milk'));
		expect(colored()).toEqual(['milk']);
	});

	test('takes away only its own colors, so two views filtering at once keep each other\'s', () => {
		const [list, schedule] = [new FindPaint(), new FindPaint()];
		list.paint(title('oat milk'), findOf('milk'));
		schedule.paint(title('soy milk'), findOf('soy'));
		list.clear();
		expect(colored()).toEqual(['soy']);
	});

	test('takes the color from an element painted before that a redraw no longer has', () => {
		const paint = new FindPaint();
		const [kept, gone] = [title('oat milk'), title('more milk')];
		paint.paintAll([kept, gone], findOf('milk'));
		paint.paintAll([kept], findOf('oat'));
		expect(colored()).toEqual(['oat']);
	});

	test('colors nothing, and doesn\'t throw, where the window has no highlight API', () => {
		delete css.highlights;
		expect(() => new FindPaint().paint(title('oat milk'), findOf('milk'))).not.toThrow();
		expect(colored()).toEqual([]);
	});

	test('takes the highlight away once nothing in the window is colored', () => {
		const paint = new FindPaint();
		paint.paint(title('oat milk'), findOf('milk'));
		paint.clear();
		expect(css.highlights?.has(FIND_HIGHLIGHT)).toBe(false);
	});

	test('leaves no highlight in the window when an element has no match', () => {
		new FindPaint().paint(title('oat milk'), findOf('soy'));
		expect(css.highlights?.has(FIND_HIGHLIGHT)).toBe(false);
	});
});
