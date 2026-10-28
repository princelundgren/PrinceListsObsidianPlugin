import { Component, MarkdownRenderer } from 'obsidian';
import { boxesMatchChecklist, type ChecklistLine } from '../core/checklist';
import type { LineRange } from '../core/follow';
import { itemPieces, notePieces } from '../core/note-pieces';
import { NOTES_CHECKBOX_SELECTOR, type MarkdownHost } from './notes';

export const NOTE_PIECE_CLASS = 'princelists-note-piece';
export const NOTES_END_CLASS = 'princelists-notes-end';
export const PLACEHOLDER_CLASS = 'princelists-placeholder';
const OPEN_ITEM_CLASS = 'princelists-open-item';

/** A card's notes as getItemNotes reads them, and the file line they start on. */
export interface Notes {
	markdown: string;
	start: number;
}

/** Where a field goes: in place of a piece, of one item of a list piece, or after the last piece. */
export type PiecePlace = { kind: 'piece'; el: HTMLElement } | { kind: 'item'; el: HTMLElement; li: HTMLElement } | { kind: 'end' };

interface Piece {
	range: LineRange;
	text: string;
}

// A piece's element, and while a field stands in for it, or for one of its list's items, what it hid.
interface DrawnPiece extends Piece {
	component: Component;
	hidden: HTMLElement | null;
}

interface Drawing {
	parent: Component;
	app: MarkdownHost['app'];
	sourcePath: string;
	checklist: readonly ChecklistLine[] | null;
	open: LineRange | null;
}

const drawnPieces = new WeakMap<Element, DrawnPiece>();
const fieldPieces = new WeakMap<HTMLTextAreaElement, HTMLElement>();
const areaComponents = new WeakMap<HTMLElement, Component>();

// Draws each piece of the notes on its own, tagged with its file lines. A piece whose text is
// unchanged keeps its element and takes its new lines, so a picture or an embed in it isn't loaded
// again. The open field and the piece it stands in for stay; a field whose piece was lost (`open`
// null) leaves everything as it is until it closes.
export function drawNotes(
	host: MarkdownHost,
	sourcePath: string,
	area: HTMLElement,
	notes: Notes,
	checklist: readonly ChecklistLine[] | null,
	open: LineRange | null,
): Component {
	let parent = areaComponents.get(area);
	if (!parent) {
		parent = host.addChild(new Component());
		areaComponents.set(area, parent);
	}
	const field = area.querySelector('textarea');
	if (field && !open) return parent;
	const drawing: Drawing = { parent, app: host.app, sourcePath, checklist, open };
	for (const el of Array.from(area.querySelectorAll(`:scope > .${NOTES_END_CLASS}, :scope > .${PLACEHOLDER_CLASS}`))) el.remove();
	const wanted = piecesOf(notes);
	const pieceEls = Array.from(area.querySelectorAll<HTMLElement>(`:scope > .${NOTE_PIECE_CLASS}`));
	const slot = field ? fieldPieces.get(field) : undefined;
	const anchor = slot ?? field;
	if (!anchor || !open) {
		reconcile(drawing, area, pieceEls, wanted, null);
	} else {
		const isBefore = (piece: Piece) => piece.range.end <= open.start;
		const isAfter = (piece: Piece) => piece.range.start >= open.end;
		const others = pieceEls.filter((el) => el !== slot);
		const precedes = (el: HTMLElement) => (el.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
		reconcile(drawing, area, others.filter(precedes), wanted.filter(isBefore), anchor);
		reconcile(drawing, area, others.filter((el) => !precedes(el)), wanted.filter(isAfter), null);
		if (slot) keepSlot(drawing, slot, wanted.filter((piece) => !isBefore(piece) && !isAfter(piece)));
	}
	if (field || wanted.length > 0) area.createDiv({ cls: NOTES_END_CLASS });
	else area.createDiv({ cls: PLACEHOLDER_CLASS, text: 'Notes' });
	return parent;
}

/**
 * The piece or list item a click in the notes is on, and its file lines; null lines for the strip
 * after the last piece. 'stale' when the clicked piece isn't among the notes' pieces now, as drawn.
 */
export function placeAt(target: HTMLElement, notes: Notes): { place: PiecePlace; range: LineRange | null } | 'stale' | null {
	if (target.closest(`.${NOTES_END_CLASS}, .${PLACEHOLDER_CLASS}`)) return { place: { kind: 'end' }, range: null };
	const el = target.closest<HTMLElement>(`.${NOTE_PIECE_CLASS}`);
	const drawn = el ? drawnPieces.get(el) : undefined;
	if (!el || !drawn) return null;
	const local = shift(drawn.range, -notes.start);
	if (!piecesOf(notes).some((piece) => piece.range.start === drawn.range.start && piece.range.end === drawn.range.end && piece.text === drawn.text)) return 'stale';
	const li = target.closest<HTMLElement>('li');
	if (li && el.contains(li)) {
		const items = itemPieces(notes.markdown, local);
		const lis = Array.from(el.querySelectorAll<HTMLElement>('li'));
		const item = items[lis.indexOf(li)];
		if (item && lis.length === items.length) return { place: { kind: 'item', el, li }, range: shift(item, notes.start) };
	}
	return { place: { kind: 'piece', el }, range: drawn.range };
}

/** The line after the last piece, or null when there are no notes. */
export function notesEnd(notes: Notes): number | null {
	const last = notePieces(notes.markdown).at(-1);
	return last ? notes.start + last.end : null;
}

// Puts the field in place of what `place` draws, which waits, hidden, until the field closes.
export function showField(area: HTMLElement, place: PiecePlace, field: HTMLTextAreaElement): void {
	const drawn = place.kind === 'end' ? undefined : drawnPieces.get(place.el);
	if (place.kind === 'end' || !drawn) {
		area.querySelector(`:scope > .${PLACEHOLDER_CLASS}`)?.replaceWith(createDiv({ cls: NOTES_END_CLASS }));
		area.insertBefore(field, area.querySelector(`:scope > .${NOTES_END_CLASS}`));
		return;
	}
	fieldPieces.set(field, place.el);
	if (place.kind === 'piece') {
		place.el.hide();
		place.el.after(field);
		drawn.hidden = place.el;
		return;
	}
	const hidden = place.li.createDiv();
	hidden.append(...Array.from(place.li.childNodes).filter((node) => node !== hidden));
	hidden.hide();
	place.li.append(field);
	place.li.addClass(OPEN_ITEM_CLASS);
	drawn.hidden = hidden;
}

// Shows again what the field stood in for. The caller removes the field once it has lost focus.
export function hideField(field: HTMLTextAreaElement): void {
	const el = fieldPieces.get(field);
	const drawn = el ? drawnPieces.get(el) : undefined;
	fieldPieces.delete(field);
	if (!el || !drawn?.hidden) return;
	if (drawn.hidden === el) {
		el.show();
	} else {
		drawn.hidden.parentElement?.removeClass(OPEN_ITEM_CLASS);
		drawn.hidden.replaceWith(...Array.from(drawn.hidden.childNodes));
	}
	drawn.hidden = null;
}

// The checklist line a drawn box stands for, or null when its piece's boxes don't line up with its
// lines. The lines of an open item are left out, as are its boxes, which wait hidden.
export function boxLine(box: HTMLInputElement, checklist: readonly ChecklistLine[] | null, open: LineRange | null): number | null {
	const el = box.closest(`.${NOTE_PIECE_CLASS}`);
	const drawn = el ? drawnPieces.get(el) : undefined;
	if (!el || !drawn) return null;
	const boxes = boxesOf(el, drawn);
	const lines = linesOf(drawn, checklist, open);
	return lines && boxes.length === lines.length ? (lines[boxes.indexOf(box)]?.line ?? null) : null;
}

function piecesOf(notes: Notes): Piece[] {
	const lines = notes.markdown.split('\n');
	return notePieces(notes.markdown).map((range) => ({ range: shift(range, notes.start), text: lines.slice(range.start, range.end).join('\n') }));
}

// Matches the drawn elements to the pieces by text, in order: a match is kept, and anything else is
// drawn again, before `end` when no kept element follows.
function reconcile(drawing: Drawing, area: HTMLElement, existing: HTMLElement[], wanted: Piece[], end: Node | null): void {
	let next = 0;
	for (const piece of wanted) {
		const found = existing.findIndex((el, i) => i >= next && drawnPieces.get(el)?.text === piece.text);
		if (found < 0) {
			area.insertBefore(drawPiece(drawing, piece), existing[next] ?? end);
			continue;
		}
		for (const el of existing.slice(next, found)) dropPiece(drawing, el);
		const kept = existing[found] as HTMLElement;
		(drawnPieces.get(kept) as DrawnPiece).range = piece.range;
		showBoxes(drawing, kept);
		next = found + 1;
	}
	for (const el of existing.slice(next)) dropPiece(drawing, el);
}

function drawPiece(drawing: Drawing, piece: Piece): HTMLElement {
	const el = createDiv({ cls: NOTE_PIECE_CLASS });
	const component = drawing.parent.addChild(new Component());
	drawnPieces.set(el, { ...piece, component, hidden: null });
	MarkdownRenderer.render(drawing.app, piece.text, el, drawing.sourcePath, component).then(
		() => showBoxes(drawing, el),
		(error: unknown) => console.error(error),
	);
	return el;
}

function dropPiece(drawing: Drawing, el: HTMLElement): void {
	const drawn = drawnPieces.get(el);
	if (drawn) drawing.parent.removeChild(drawn.component);
	el.remove();
}

// The piece the field stands in for, or the list it holds an item of, takes the lines around the
// field. Until the field closes, it isn't drawn again: a tick in the rest of that list shows on its
// box only.
function keepSlot(drawing: Drawing, el: HTMLElement, pieces: Piece[]): void {
	const drawn = drawnPieces.get(el) as DrawnPiece;
	const first = pieces[0];
	const last = pieces.at(-1);
	if (first && last) drawn.range = { start: first.range.start, end: last.range.end };
	const boxes = boxesOf(el, drawn);
	const lines = linesOf(drawn, drawing.checklist, drawing.open);
	if (lines && boxes.length === lines.length) boxes.forEach((box, index) => (box.checked = lines[index]?.ticked ?? box.checked));
	showBoxes(drawing, el);
}

// A piece's boxes tick only while they line up with its checklist lines: an embed or a callout can
// draw more.
function showBoxes(drawing: Drawing, el: HTMLElement): void {
	const drawn = drawnPieces.get(el);
	if (!drawn) return;
	const boxes = boxesOf(el, drawn);
	const enabled = boxesMatchChecklist(boxes.map((box) => box.checked), linesOf(drawn, drawing.checklist, drawing.open));
	for (const box of boxes) box.disabled = !enabled;
}

function boxesOf(el: Element, drawn: DrawnPiece): HTMLInputElement[] {
	if (drawn.hidden === el) return [];
	const hidden = drawn.hidden;
	return Array.from(el.querySelectorAll<HTMLInputElement>(NOTES_CHECKBOX_SELECTOR)).filter((box) => !hidden?.contains(box));
}

function linesOf(drawn: DrawnPiece, checklist: readonly ChecklistLine[] | null, open: LineRange | null): ChecklistLine[] | null {
	const skipped = drawn.hidden !== null ? open : null;
	const isIn = (range: LineRange, line: number) => range.start <= line && line < range.end;
	return checklist?.filter(({ line }) => isIn(drawn.range, line) && !(skipped && isIn(skipped, line))) ?? null;
}

function shift(range: LineRange, by: number): LineRange {
	return { start: range.start + by, end: range.end + by };
}
