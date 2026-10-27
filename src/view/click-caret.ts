import { sourceCaret, type RenderedClick } from '../core/source-caret';

// Parts the renderer draws with text that isn't at its own place in the source, such as an embedded
// note's text or a callout's title, count as drawn parts.
const DRAWN_SELECTOR = '.internal-embed, .callout-title, .footnote-ref, .footnote-backref';

interface DomCaret {
	node: Node;
	offset: number;
}

// Where the caret goes in `source` for a click in its rendering, `rendered` (spec, "Editing").
export function caretAtClick(rendered: HTMLElement, evt: MouseEvent, source: string): number {
	const texts = textsIn(rendered);
	return sourceCaret(
		source,
		texts.map((text) => text.data),
		clickIn(texts, evt),
	);
}

function textsIn(rendered: HTMLElement): Text[] {
	const walker = rendered.doc.createTreeWalker(rendered, NodeFilter.SHOW_TEXT);
	const texts: Text[] = [];
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (node.instanceOf(Text) && !node.parentElement?.closest(DRAWN_SELECTOR)) texts.push(node);
	}
	return texts;
}

// A click on something drawn, such as a picture, counts as a click on it, not on the text nearest
// to it, which is where the browser puts its caret.
function clickIn(texts: readonly Text[], evt: MouseEvent): RenderedClick {
	const target = evt.targetNode;
	if (!target) return { index: texts.length, at: null };
	const drawn = (target.instanceOf(Element) ? target : target.parentElement)?.closest(DRAWN_SELECTOR);
	const caret = drawn ? null : caretAt(target.doc, evt.clientX, evt.clientY);
	const index = caret && target.contains(caret.node) ? texts.findIndex((text) => text === caret.node) : -1;
	if (caret && index >= 0) return { index, at: caret.offset };
	const part = drawn ?? target;
	const after = texts.findIndex((text) => part.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING);
	return { index: after < 0 ? texts.length : after, at: null };
}

// Chromium before 128 and Safari and iOS before 26.2 don't have it (MDN), and the older
// caretRangeFromPoint is deprecated: the click then counts as one on the clicked block.
function caretAt(doc: Document, x: number, y: number): DomCaret | null {
	if (typeof doc.caretPositionFromPoint !== 'function') return null;
	const position = doc.caretPositionFromPoint(x, y);
	return position && { node: position.offsetNode, offset: position.offset };
}
