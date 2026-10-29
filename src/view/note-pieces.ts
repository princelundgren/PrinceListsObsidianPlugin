import { Component, MarkdownRenderer } from 'obsidian';
import { boxesMatchChecklist, type ChecklistLine } from '../core/checklist';
import type { LineRange } from '../core/follow';
import { itemPieces, notePieces } from '../core/note-pieces';
import { NOTES_CHECKBOX_SELECTOR, type MarkdownHost } from './notes';
import { redrawAround } from './note-piece-slot';
import {
	drawnPieces,
	fieldPieces,
	NOTE_PIECE_CLASS,
	NOTES_END_CLASS,
	PLACEHOLDER_CLASS,
	shift,
	type Drawing,
	type DrawnPiece,
	type Notes,
	type Piece,
	type PiecePlace,
} from './note-piece-state';

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
	const drawing: Drawing = { notes, parent, app: host.app, sourcePath, checklist, open };
	for (const el of Array.from(area.querySelectorAll(`:scope > .${NOTES_END_CLASS}, :scope > .${PLACEHOLDER_CLASS}`))) el.remove();
	const wanted = piecesOf(notes);
	const pieceEls = Array.from(area.querySelectorAll<HTMLElement>(`:scope > .${NOTE_PIECE_CLASS}`));
	const slot = field ? fieldPieces.get(field) : undefined;
	const anchor = slot ?? field;
	if (!anchor || !open) {
		reconcile(drawing, area, pieceEls, wanted, null);
	} else {
		const held = slot ? heldPieces(wanted, open, drawnPieces.get(slot)?.hidden === slot) : [];
		const shown = slot ? wanted.filter((piece) => !held.includes(piece)) : partsAround(wanted, open, notes);
		const others = pieceEls.filter((el) => el !== slot);
		const precedes = (el: HTMLElement) => (el.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
		reconcile(drawing, area, others.filter(precedes), shown.filter((piece) => piece.range.end <= open.start), anchor);
		reconcile(drawing, area, others.filter((el) => !precedes(el)), shown.filter((piece) => piece.range.start >= open.end), null);
		if (slot) keepSlot(drawing, slot, held);
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
	const pieces = notePieces(notes.markdown);
	const last = pieces[pieces.length - 1];
	return last ? notes.start + last.end : null;
}

/**
 * Each drawn piece, or its list's items where the drawn and parsed counts match, as a field opens
 * them. The new or emptied item the field stands in has no lines, so its li is left out.
 */
export function openablePieces(area: HTMLElement, notes: Notes, open: LineRange): { range: LineRange; place: PiecePlace }[] {
	const openable: { range: LineRange; place: PiecePlace }[] = [];
	for (const el of Array.from(area.querySelectorAll<HTMLElement>(`:scope > .${NOTE_PIECE_CLASS}`))) {
		const drawn = drawnPieces.get(el);
		if (!drawn) continue;
		const items = drawn.hidden === el ? [] : itemPieces(notes.markdown, shift(drawn.range, -notes.start));
		const lineless = open.start === open.end ? el.querySelector('textarea')?.closest('li') : null;
		const lis = Array.from(el.querySelectorAll<HTMLElement>('li')).filter((li) => li !== lineless);
		if (items.length === 0 || lis.length !== items.length) openable.push({ range: drawn.range, place: { kind: 'piece', el } });
		else items.forEach((item, i) => openable.push({ range: shift(item, notes.start), place: { kind: 'item', el, li: lis[i] as HTMLElement } }));
	}
	return openable;
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

// The pieces the field's slot holds: those its lines overlap. A list holds lines emptied, or a new item
// not saved yet, around them, else where they end it, else where they start it.
function heldPieces(wanted: Piece[], open: LineRange, isWhole: boolean): Piece[] {
	const overlapping = wanted.filter((piece) => piece.range.start < open.end && piece.range.end > open.start);
	if (open.start < open.end || isWhole || overlapping.length > 0) return overlapping;
	const held = wanted.find((piece) => piece.range.end === open.start) ?? wanted.find((piece) => piece.range.start === open.start);
	return held ? [held] : [];
}

// A field with no slot, such as a new item after a whole piece, sits between the lines of its piece
// above it and those below, each drawn on its own.
function partsAround(wanted: Piece[], open: LineRange, notes: Notes): Piece[] {
	const lines = notes.markdown.split('\n');
	const part = (start: number, end: number): Piece[] =>
		start < end ? [{ range: { start, end }, text: lines.slice(start - notes.start, end - notes.start).join('\n') }] : [];
	return wanted.flatMap((piece) => {
		const { start, end } = piece.range;
		if (end <= open.start || start >= open.end) return [piece];
		return [...part(start, Math.min(open.start, end)), ...part(Math.max(open.end, start), end)];
	});
}

// Matches the drawn elements to the pieces by text and note, in order: a match is kept, and anything
// else is drawn again, before `end` when no kept element follows.
function reconcile(drawing: Drawing, area: HTMLElement, existing: HTMLElement[], wanted: Piece[], end: Node | null): void {
	let next = 0;
	for (const piece of wanted) {
		const found = existing.findIndex((el, i) => {
			const drawn = drawnPieces.get(el);
			return i >= next && drawn?.text === piece.text && drawn.sourcePath === drawing.sourcePath;
		});
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
	drawnPieces.set(el, { ...piece, component, hidden: null, redrawing: null, sourcePath: drawing.sourcePath });
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
// field. A list whose text changed is drawn again around the field; a piece the field stands in for
// whole, once the field closes.
function keepSlot(drawing: Drawing, el: HTMLElement, pieces: Piece[]): void {
	const drawn = drawnPieces.get(el) as DrawnPiece;
	const first = pieces[0];
	const last = pieces[pieces.length - 1];
	if (first && last) drawn.range = { start: first.range.start, end: last.range.end };
	if (first && pieces.length === 1 && drawn.hidden !== el && first.text !== drawn.text) {
		redrawAround(drawing, el, first, () => showBoxes(drawing, el));
	}
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
