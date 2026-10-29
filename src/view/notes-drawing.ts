import { syntaxTree } from '@codemirror/language';
import type { EditorState, Extension, Range, SelectionRange } from '@codemirror/state';
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate, type WidgetType } from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';
import { isWebAddress, linkTarget, pictureLook } from '../core/drawn-links';
import { parseItemLine } from '../core/item-line';
import { pictureLinks } from '../core/picture-links';
import { wikiLinks } from '../core/wiki-links';
import type { PrinceListView } from './list-view';
import { notesLinks, type NotesLinks } from './notes-links';
import { BulletWidget, CheckboxWidget, RuleWidget } from './notes-widgets';

const HIDDEN = Decoration.replace({});
const FAINT = Decoration.mark({ class: 'princelists-notes-markup' });
const LIST_NUMBER = Decoration.mark({ class: 'princelists-notes-list-number' });
const INLINE = {
	Emphasis: { mark: 'EmphasisMark', look: Decoration.mark({ tagName: 'em' }) },
	StrongEmphasis: { mark: 'EmphasisMark', look: Decoration.mark({ tagName: 'strong' }) },
	Strikethrough: { mark: 'StrikethroughMark', look: Decoration.mark({ tagName: 'del' }) },
	InlineCode: { mark: 'CodeMark', look: Decoration.mark({ tagName: 'code' }) },
} as const;
const HEADING = /^ATXHeading([1-6])$/;
const CODE_NODES = new Set(['InlineCode', 'FencedCode', 'CodeBlock']);

/**
 * Draws the notes as Obsidian's Live Preview draws a note: inline marks, links and pictures show their
 * Markdown only while the selection touches them, and headings, quotes and rules only while it is on
 * their line. Without focus, nothing shows its Markdown. Links in `sourcePath` resolve as in that note.
 */
export function notesDrawing(view: PrinceListView, sourcePath: string): Extension {
	return ViewPlugin.define((editor) => new NotesDrawing(editor, notesLinks(view, sourcePath)), { decorations: (drawing) => drawing.decorations });
}

class NotesDrawing {
	decorations: DecorationSet;
	constructor(
		editor: EditorView,
		private readonly links: NotesLinks,
	) {
		this.decorations = this.draw(editor);
	}

	update(update: ViewUpdate): void {
		const isTreeNew = syntaxTree(update.startState) !== syntaxTree(update.state);
		if (update.docChanged || update.selectionSet || update.focusChanged || update.viewportChanged || isTreeNew) this.decorations = this.draw(update.view);
	}

	private draw(editor: EditorView): DecorationSet {
		const drawing = new Drawing(editor.state, editor.hasFocus ? editor.state.selection.ranges : []);
		const { from, to } = editor.viewport;
		const wikiSpans = drawLineLinks(drawing, from, to, this.links);
		syntaxTree(editor.state).iterate({
			from,
			to,
			enter: (node) => {
				// The parser reads `[[a]]` as a link in brackets: the wikilink drawing has it.
				const isLinkNode = node.name === 'Link' || node.name === 'Image';
				if (isLinkNode && wikiSpans.some((span) => node.from < span.to && node.to > span.from)) return false;
				return drawNode(drawing, node.node, this.links);
			},
		});
		return Decoration.set(drawing.ranges, true);
	}
}

// The decorations so far, and what the selection shows as typed.
class Drawing {
	readonly ranges: Range<Decoration>[] = [];

	constructor(
		readonly state: EditorState,
		private readonly selection: readonly SelectionRange[],
	) {}

	touches(from: number, to: number): boolean {
		return this.selection.some((range) => range.from <= to && range.to >= from);
	}

	touchesLine(pos: number): boolean {
		const line = this.state.doc.lineAt(pos);
		return this.touches(line.from, line.to);
	}

	// Nothing for an empty range: CodeMirror refuses an empty mark.
	add(decoration: Decoration, from: number, to: number): void {
		if (from < to) this.ranges.push(decoration.range(from, to));
	}

	widget(decoration: Decoration, at: number): void {
		this.ranges.push(decoration.range(at));
	}

	// A node's own Markdown: faint while shown, hidden otherwise.
	markup(from: number, to: number, isShown: boolean): void {
		this.add(isShown ? FAINT : HIDDEN, from, to);
	}

	lineClass(from: number, to: number, className: string): void {
		const { doc } = this.state;
		for (let number = doc.lineAt(from).number; number <= doc.lineAt(to).number; number++) {
			this.ranges.push(Decoration.line({ class: className }).range(doc.line(number).from));
		}
	}
}

// Wikilinks and pictures, which the parser doesn't know, line by line; returns the wikilinks' spans.
function drawLineLinks(drawing: Drawing, from: number, to: number, links: NotesLinks): { from: number; to: number }[] {
	const { doc } = drawing.state;
	const tree = syntaxTree(drawing.state);
	const spans: { from: number; to: number }[] = [];
	for (let number = doc.lineAt(from).number; number <= doc.lineAt(to).number; number++) {
		const line = doc.line(number);
		const isCode = (column: number) => isInCode(tree.resolveInner(line.from + column, 1));
		const wikis = wikiLinks(line.text).filter((wiki) => !isCode(wiki.from));
		for (const picture of pictureLinks([line.text])) {
			if (isCode(picture.from)) continue;
			const look = pictureLook(line.text.slice(picture.from, picture.to));
			drawPicture(drawing, line.from + picture.from, line.from + picture.to, links.picture(picture.linkpath, look));
		}
		for (const wiki of wikis) {
			spans.push({ from: line.from + wiki.from, to: line.from + wiki.to });
			if (wiki.embed) continue;
			// `[[a|b]]` shows b, `[[#h]]` h and `[[a]]` a.
			const pathEnd = wiki.from + 2 + wiki.linkpath.length;
			const textFrom = wiki.display === null ? wiki.from + (wiki.linkpath.startsWith('#') ? 3 : 2) : pathEnd + 1;
			const link = Decoration.mark({
				tagName: 'a',
				class: links.isResolved(wiki.linkpath) ? 'internal-link' : 'internal-link is-unresolved',
				attributes: { 'data-href': wiki.linkpath },
			});
			drawLink(drawing, line.from + wiki.from, line.from + textFrom, line.from + wiki.to - 2, line.from + wiki.to, link);
		}
	}
	return spans;
}

function isInCode(node: SyntaxNode | null): boolean {
	for (let at = node; at; at = at.parent) if (CODE_NODES.has(at.name)) return true;
	return false;
}

// Returns whether the parse inside the node is drawn too.
function drawNode(drawing: Drawing, node: SyntaxNode, links: NotesLinks): boolean {
	const { name } = node;
	if (name in INLINE) {
		const { mark, look } = INLINE[name as keyof typeof INLINE];
		drawing.add(look, node.from, node.to);
		const isShown = drawing.touches(node.from, node.to);
		for (const child of node.getChildren(mark)) drawing.markup(child.from, child.to, isShown);
		return name !== 'InlineCode';
	}
	const heading = HEADING.exec(name);
	if (heading) {
		drawing.lineClass(node.from, node.from, `princelists-notes-h${heading[1]}`);
		drawHeadingMarks(drawing, node);
		return true;
	}
	switch (name) {
		case 'Link':
			drawMarkdownLink(drawing, node);
			return true;
		case 'Autolink':
		case 'URL':
			drawAddress(drawing, node);
			return false;
		case 'Image':
			drawWebPicture(drawing, node, links);
			return false;
		case 'HTMLTag':
			drawUnderline(drawing, node);
			return false;
		case 'ListMark':
			drawListMark(drawing, node);
			return false;
		case 'Blockquote':
			drawing.lineClass(node.from, node.to, 'princelists-notes-quote');
			return true;
		case 'QuoteMark':
			// With the one space after it: more is the indent of what the quote holds.
			drawing.markup(node.from, drawing.state.sliceDoc(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to, drawing.touchesLine(node.from));
			return false;
		case 'HorizontalRule':
			if (drawing.touchesLine(node.from)) return false;
			drawing.add(Decoration.replace({ widget: new RuleWidget() }), node.from, node.to);
			return false;
		case 'FencedCode':
		case 'CodeBlock':
			drawing.lineClass(node.from, node.to, 'princelists-notes-code');
			return false;
		default:
			return true;
	}
}

// `# A #`: the opening marks with the space after them, and closing ones with the space before.
function drawHeadingMarks(drawing: Drawing, heading: SyntaxNode): void {
	const isShown = drawing.touchesLine(heading.from);
	for (const mark of heading.getChildren('HeaderMark')) {
		if (mark.from === heading.from) drawing.markup(mark.from, spaceAfter(drawing.state, mark.to), isShown);
		else drawing.markup(spaceBefore(drawing.state, mark.from), mark.to, isShown);
	}
}

// A bullet, or a number, which stays. A checklist line's box takes the place of its `[ ]` and its
// bullet, as in Live Preview.
function drawListMark(drawing: Drawing, mark: SyntaxNode): void {
	const isBullet = mark.parent?.parent?.name === 'BulletList';
	if (!isBullet) drawing.add(LIST_NUMBER, mark.from, mark.to);
	const marker = mark.nextSibling?.name === 'Task' ? mark.nextSibling.getChild('TaskMarker') : null;
	if (marker) drawCheckbox(drawing, isBullet ? mark.from : marker.from, marker);
	else if (isBullet && !drawing.touches(mark.from, mark.to)) drawing.add(Decoration.replace({ widget: new BulletWidget() }), mark.from, mark.to);
}

// The box from `from` to the end of `marker`, shown as typed while the selection touches it, and a
// ticked line's text struck through. A box the plugin can't tick shows as typed, as Live Preview
// shows one in a quote.
function drawCheckbox(drawing: Drawing, from: number, marker: SyntaxNode): void {
	const { state } = drawing;
	if (!parseItemLine(state.doc.lineAt(marker.from).text)) return;
	const isTicked = state.sliceDoc(marker.from + 1, marker.from + 2) !== ' ';
	if (isTicked) drawing.lineClass(marker.from, marker.from, 'princelists-notes-done');
	if (!drawing.touches(from, marker.to)) drawing.add(Decoration.replace({ widget: new CheckboxWidget(isTicked) }), from, marker.to);
}

// `[text](address)`, which shows its text; a reference link, with no address, shows as typed.
function drawMarkdownLink(drawing: Drawing, node: SyntaxNode): void {
	const marks = node.getChildren('LinkMark');
	const url = node.getChild('URL');
	const [open, close] = marks;
	if (!url || !open || !close) return;
	drawLink(drawing, node.from, open.to, close.from, node.to, linkLook(drawing.state.sliceDoc(url.from, url.to)));
}

// A bare address, or one in `<…>`.
function drawAddress(drawing: Drawing, node: SyntaxNode): void {
	const url = node.name === 'URL' ? node : node.getChild('URL');
	if (!url || node.parent?.name === 'Link') return;
	const address = drawing.state.sliceDoc(url.from, url.to);
	if (linkTarget(address).kind === 'vault') return;
	drawLink(drawing, node.from, url.from, url.to, node.to, linkLook(address));
}

// A link from `from` to `to` whose text runs from `textFrom` to `textTo`: drawn as `link` while the
// selection doesn't touch it, and shown as typed while it does. One that spans lines shows as typed:
// a view plugin can't hide a line break.
function drawLink(drawing: Drawing, from: number, textFrom: number, textTo: number, to: number, link: Decoration): void {
	const { doc } = drawing.state;
	if (textFrom >= textTo || drawing.touches(from, to) || doc.lineAt(from).number !== doc.lineAt(to).number) return;
	drawing.add(HIDDEN, from, textFrom);
	drawing.add(link, textFrom, textTo);
	drawing.add(HIDDEN, textTo, to);
}

function linkLook(address: string): Decoration {
	const target = linkTarget(address);
	switch (target.kind) {
		case 'web':
			return Decoration.mark({ tagName: 'a', class: 'external-link', attributes: { href: target.href, target: '_blank', rel: 'noopener nofollow' } });
		case 'unsafe':
			return Decoration.mark({ tagName: 'a', class: 'external-link' });
		case 'vault':
			return Decoration.mark({ tagName: 'a', class: 'internal-link', attributes: { 'data-href': target.linktext } });
	}
}

// A picture, which shows its Markdown before it while the selection touches it. One with no file
// shows as typed.
function drawPicture(drawing: Drawing, from: number, to: number, widget: WidgetType | null): void {
	if (widget === null) return;
	if (drawing.touches(from, to)) drawing.widget(Decoration.widget({ widget, side: 1 }), to);
	else drawing.add(Decoration.replace({ widget }), from, to);
}

// `![…](https://…)`. One from the vault was drawn with its line, and one that spans lines shows as
// typed, as a link does.
function drawWebPicture(drawing: Drawing, node: SyntaxNode, links: NotesLinks): void {
	const url = node.getChild('URL');
	const { doc } = drawing.state;
	if (!url || doc.lineAt(node.from).number !== doc.lineAt(node.to).number) return;
	const target = linkTarget(drawing.state.sliceDoc(url.from, url.to));
	if (target.kind !== 'web' || !isWebAddress(target.href)) return;
	drawPicture(drawing, node.from, node.to, links.webPicture(drawing.state.sliceDoc(node.from, node.to)));
}

// `<u>…</u>` in one paragraph underlines what it holds.
function drawUnderline(drawing: Drawing, open: SyntaxNode): void {
	if (drawing.state.sliceDoc(open.from, open.to).toLowerCase() !== '<u>') return;
	let close = open.nextSibling;
	while (close && !(close.name === 'HTMLTag' && drawing.state.sliceDoc(close.from, close.to).toLowerCase() === '</u>')) close = close.nextSibling;
	if (!close) return;
	drawing.add(Decoration.mark({ tagName: 'u' }), open.to, close.from);
	const isShown = drawing.touches(open.from, close.to);
	drawing.markup(open.from, open.to, isShown);
	drawing.markup(close.from, close.to, isShown);
}

function spaceAfter(state: EditorState, pos: number): number {
	const line = state.doc.lineAt(pos);
	return pos + (/^[ \t]*/.exec(line.text.slice(pos - line.from))?.[0].length ?? 0);
}

function spaceBefore(state: EditorState, pos: number): number {
	const line = state.doc.lineAt(pos);
	return pos - (/[ \t]*$/.exec(line.text.slice(0, pos - line.from))?.[0].length ?? 0);
}
