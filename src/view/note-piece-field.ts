import type { LineRange } from '../core/follow';
import { holdsOnly } from '../core/note-pieces';
import { NOTES_EDITOR_CLASS, sayFieldLost } from './card';
import { caretAtClick } from './click-caret';
import { fitHeight, targetOf } from './dom';
import { FIELD_CLASS } from './fields';
import { buildFormatBar } from './format';
import type { PrinceListView } from './list-view';
import { coverField, hideField, putField, removeField, showField } from './note-piece-slot';
import type { PiecePlace } from './note-piece-state';
import { drawNotes, notesEnd, placeAt } from './note-pieces';
import { notesHostOf, type NotesHost } from './notes-host';

/**
 * Where typing moves to: the lines to open, and the text the field starts with if not theirs, with
 * the caret at its start, its end, or the end of its first line, which is an item's own.
 */
export interface PieceMove {
	place: PiecePlace;
	range: LineRange;
	isNew?: boolean;
	indent?: string;
	text?: string;
	caret: 'start' | 'end' | 'firstLineEnd';
}

const QUIET_PLACEHOLDER_CLASS = 'princelists-quiet-placeholder';

// Fields that handed typing on to another, which removes them itself.
const handedOn = new WeakSet<HTMLTextAreaElement>();

// Draws the notes, and says so once when an outside change took the open piece's lines.
export function drawPieces(view: PrinceListView, host: NotesHost): void {
	const found = host.notes();
	if (!found) return;
	const open = host.range();
	host.keep(drawNotes(view, view.sourcePath, host.area, found.notes, found.checklist, open));
	const field = host.area.querySelector<HTMLTextAreaElement>(`.${NOTES_EDITOR_CLASS}`);
	if (field && !field.readOnly && open === null) pieceLost(view, field);
	else if (field) showPlaceholder(field, host);
}

// The piece or item clicked opens in a field, the caret where the click was; the strip after the
// last piece opens a new one. A click on a piece the notes no longer hold draws them again.
export function openPieceAt(view: PrinceListView, host: NotesHost, click: MouseEvent): void {
	const target = targetOf(click);
	const found = host.notes();
	if (!found || !target || target.closest('textarea')) return;
	// One piece is open at a time, whatever the press did with focus. Closing it can draw again what
	// was clicked.
	host.area.querySelector('textarea')?.blur();
	if (!target.isConnected) return;
	const at = placeAt(target, found.notes);
	if (at === 'stale') drawPieces(view, host);
	else if (at) openPiece(view, host, at.place, at.range, click);
}

/** A new piece after the last, as a dropped picture opens. */
export function openNewPiece(view: PrinceListView, host: NotesHost): HTMLTextAreaElement | null {
	return openPiece(view, host, { kind: 'end' }, null);
}

export function pieceInput(view: PrinceListView, field: HTMLTextAreaElement): void {
	fitHeight(field);
	typePiece(view, field, field.value);
}

/** Saves `markdown` as the open piece, as typing it would; false when it wasn't saved. */
export function typePiece(view: PrinceListView, field: HTMLTextAreaElement, markdown: string): boolean {
	const typed = notesHostOf(view, field)?.type(markdown) ?? { lost: true };
	if ('lost' in typed) pieceLost(view, field);
	else view.handleTyped(typed);
	return 'edit' in typed;
}

// The field goes once it has lost focus, to `focusing`, and the piece it stood in for is drawn as it
// now reads. Closing the list note can draw the whole list again, which leaves this area behind.
export function pieceBlur(view: PrinceListView, field: HTMLTextAreaElement, focusing: Element | null): void {
	if (handedOn.has(field)) return;
	const host = notesHostOf(view, field);
	host?.close(focusing);
	hideField(field);
	removeField(field);
	if (host?.area.isConnected) drawPieces(view, host);
}

// Typing moves from `from` to a new field, which takes focus in the event's own handler, so a phone's
// keyboard stays up. The piece left is drawn as it now reads.
export function movePiece(view: PrinceListView, from: HTMLTextAreaElement, to: PieceMove): void {
	const host = notesHostOf(view, from);
	const opened = host?.open(to.range, to.isNew ?? false, to.indent) ?? null;
	if (!host || opened === null) return;
	handedOn.add(from);
	hideField(from);
	const text = to.text ?? opened;
	const field = pieceField(text);
	putField(host.area, to.place, field);
	field.focus();
	const caret = to.caret === 'start' ? 0 : to.caret === 'end' || !text.includes('\n') ? text.length : text.indexOf('\n');
	field.setSelectionRange(caret, caret);
	removeField(from);
	coverField(to.place, field);
	buildFormatBar(field);
	fitHeight(field);
	drawPieces(view, host);
}

// `range` null opens a new piece after the last, after an empty line unless it is the first.
function openPiece(view: PrinceListView, host: NotesHost, place: PiecePlace, range: LineRange | null, click?: MouseEvent): HTMLTextAreaElement | null {
	const found = host.notes();
	if (!found) return null;
	const end = notesEnd(found.notes);
	const start = end ?? found.notes.start;
	const text = host.open(range ?? { start, end: start }, range === null && end !== null);
	if (text === null) return null;
	// Before the drawing makes way for the field.
	const clicked = place.kind === 'item' ? place.li : place.kind === 'piece' ? place.el : null;
	const caret = click && clicked ? caretAtClick(clicked, click, text) : text.length;
	const field = pieceField(text);
	showPlaceholder(field, host);
	showField(host.area, place, field);
	buildFormatBar(field);
	field.focus();
	field.setSelectionRange(caret, caret);
	fitHeight(field);
	return field;
}

function pieceField(text: string): HTMLTextAreaElement {
	const field = createEl('textarea', { cls: [FIELD_CLASS, NOTES_EDITOR_CLASS], attr: { rows: 1, placeholder: 'Notes' } });
	field.value = text;
	return field;
}

// The gray "Notes" shows only while the open piece is all the notes hold. It stays the field's name
// for screen readers either way.
function showPlaceholder(field: HTMLTextAreaElement, host: NotesHost): void {
	const found = host.notes();
	const open = host.range();
	if (!found || !open) return;
	const { markdown, start } = found.notes;
	const alone = holdsOnly(markdown, { start: open.start - start, end: open.end - start });
	field.toggleClass(QUIET_PLACEHOLDER_CLASS, !alone);
}

// The field can't save any more: it takes no more typing, and what it held can be copied.
function pieceLost(view: PrinceListView, field: HTMLTextAreaElement): void {
	field.readOnly = true;
	sayFieldLost(view, field.value, 'notes');
}
