import type { Find } from '../core/display';
import { pieceSpans, type TextPiece } from '../core/find-spans';
import { isInNestedBlock } from './own-rows';

/** The CSS highlight that colors what Find matches, one per window; `styles.css` gives its color. */
export const FIND_HIGHLIGHT = 'princelists-find';

/** The elements whose text nodes are read as one block, so a match can't run from one into the next. */
const BLOCK_SELECTOR = 'p, li, td, th, pre, blockquote, h1, h2, h3, h4, h5, h6, div';

interface Painted {
	registry: HighlightRegistry;
	highlight: Highlight;
	ranges: Range[];
}

/**
 * A view's ranges in the Find highlight, by the element they color, so it removes only its own and a
 * list and the Schedule filtering at once don't clear each other. Where the window has no
 * `CSS.highlights` (iOS before 17.2), it colors nothing.
 */
export class FindPaint {
	private readonly painted = new Map<HTMLElement, Painted>();

	/** Colors what `find`'s words match in `el`'s text, in place of what it colored there before. */
	paint(el: HTMLElement, find: Find | null): void {
		this.forget(el);
		if (!find) return;
		const { nodes, pieces } = textPieces(el);
		const spans = pieceSpans(pieces, find.words);
		if (spans.length === 0) return;
		const found = windowHighlight(el);
		if (!found) return;
		const { registry, highlight } = found;
		const ranges = spans.map(({ start, end }) => {
			const range = el.doc.createRange();
			range.setStart(nodes[start.piece] as Text, start.offset);
			range.setEnd(nodes[end.piece] as Text, end.offset);
			highlight.add(range);
			return range;
		});
		this.painted.set(el, { registry, highlight, ranges });
	}

	/** Paints each of `els`, and takes the color from any element painted before that isn't one of them. */
	paintAll(els: readonly HTMLElement[], find: Find | null): void {
		const kept = new Set(els);
		for (const el of Array.from(this.painted.keys())) if (!kept.has(el)) this.forget(el);
		for (const el of els) this.paint(el, find);
	}

	/** Takes the color from `el`. */
	forget(el: HTMLElement): void {
		const painted = this.painted.get(el);
		if (!painted) return;
		for (const range of painted.ranges) painted.highlight.delete(range);
		this.painted.delete(el);
		// An empty highlight left registered would outlive the plugin once it unloads.
		if (painted.highlight.size === 0) painted.registry.delete(FIND_HIGHLIGHT);
	}

	/** Takes the color from every element this view painted. */
	clear(): void {
		for (const el of Array.from(this.painted.keys())) this.forget(el);
	}
}

/** The Find highlight of `el`'s window and its registry, registered the first time, or null where the API is missing. */
function windowHighlight(el: HTMLElement): { registry: HighlightRegistry; highlight: Highlight } | null {
	// lib.dom declares CSS and Highlight on the global, not on Window; el.win is the window el is in.
	const win = el.win as Window & typeof globalThis;
	if (!('highlights' in win.CSS)) return null;
	let highlight = win.CSS.highlights.get(FIND_HIGHLIGHT);
	if (!highlight) {
		highlight = new win.Highlight();
		win.CSS.highlights.set(FIND_HIGHLIGHT, highlight);
	}
	return { registry: win.CSS.highlights, highlight };
}

/** `el`'s text nodes and their text, less any in a list block, each with the number of its block. */
function textPieces(el: HTMLElement): { nodes: Text[]; pieces: TextPiece[] } {
	const nodes: Text[] = [];
	const pieces: TextPiece[] = [];
	const blocks = new Map<Element, number>();
	const walker = el.doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const parent = node.parentElement;
		if (!parent || isInNestedBlock(el, parent)) continue;
		const blockEl = parent.closest(BLOCK_SELECTOR) ?? el;
		if (!blocks.has(blockEl)) blocks.set(blockEl, blocks.size);
		nodes.push(node as Text);
		pieces.push({ text: node.textContent ?? '', block: blocks.get(blockEl) ?? 0 });
	}
	return { nodes, pieces };
}
