import { checklistOf, type ChecklistLine } from '../core/checklist';
import { getItemNotes, notesStartLine } from '../core/edit-items';
import type { LineRange } from '../core/follow';
import { itemAt } from '../core/parse';
import { CARD_NOTES_CLASS, NOTES_EDITOR_CLASS, sayFieldLost, type Card } from './card';
import { caretAtClick } from './click-caret';
import { fitHeight, targetOf } from './dom';
import { FIELD_CLASS } from './fields';
import { buildFormatBar } from './format';
import type { PrinceListView } from './list-view';
import { coverField, hideField, putField, removeField, showField } from './note-piece-slot';
import type { Notes, PiecePlace } from './note-piece-state';
import { drawNotes, notesEnd, placeAt } from './note-pieces';

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

// Fields that handed typing on to another, which removes them itself.
const handedOn = new WeakSet<HTMLTextAreaElement>();

// Draws the open card's notes, and says so once when an outside change took the open piece's lines.
export function drawCardNotes(view: PrinceListView, card: Card, area: HTMLElement): void {
	const found = selectedNotes(view);
	if (!found) return;
	const open = view.editing.notesPieceRange();
	const component = drawNotes(view, view.sourcePath, area, found.notes, found.checklist, open);
	if (card.notes && card.notes !== component) view.removeChild(card.notes);
	card.notes = component;
	const field = area.querySelector<HTMLTextAreaElement>(`.${NOTES_EDITOR_CLASS}`);
	if (field && !field.readOnly && open === null) pieceLost(view, field);
}

// The piece or item clicked opens in a field, the caret where the click was; the strip after the
// last piece opens a new one. A click on a piece the notes no longer hold draws them again.
export function openPieceAt(view: PrinceListView, area: HTMLElement, click: MouseEvent): void {
	const card = view.card;
	const target = targetOf(click);
	if (!card || card.lostAt !== null || !target || target.closest('textarea')) return;
	// One piece is open at a time, whatever the press did with focus. Closing it can draw again what
	// was clicked.
	area.querySelector('textarea')?.blur();
	if (!target.isConnected) return;
	const found = selectedNotes(view);
	const at = found && placeAt(target, found.notes);
	if (at === 'stale') drawCardNotes(view, card, area);
	else if (at) openPiece(view, area, at.place, at.range, click);
}

/** A new piece after the last, as a dropped picture opens. */
export function openNewPiece(view: PrinceListView, area: HTMLElement): HTMLTextAreaElement | null {
	return openPiece(view, area, { kind: 'end' }, null);
}

export function pieceInput(view: PrinceListView, field: HTMLTextAreaElement): void {
	fitHeight(field);
	typePiece(view, field, field.value);
}

/** Saves `markdown` as the open piece, as typing it would; false when it wasn't saved. */
export function typePiece(view: PrinceListView, field: HTMLTextAreaElement, markdown: string): boolean {
	const typed = view.editing.typeNotesPiece(markdown);
	if ('lost' in typed) pieceLost(view, field);
	else view.handleTyped(typed);
	return 'edit' in typed;
}

// The field goes once it has lost focus, and the piece it stood in for is drawn as it now reads.
export function pieceBlur(view: PrinceListView, field: HTMLTextAreaElement): void {
	if (handedOn.has(field)) return;
	view.editing.closeNotes();
	const area = field.closest<HTMLElement>(`.${CARD_NOTES_CLASS}`);
	hideField(field);
	removeField(field);
	if (view.card && view.card.lostAt === null && area) drawCardNotes(view, view.card, area);
}

// Typing moves from `from` to a new field, which takes focus in the event's own handler, so a phone's
// keyboard stays up. The piece left is drawn as it now reads.
export function movePiece(view: PrinceListView, from: HTMLTextAreaElement, to: PieceMove): void {
	const card = view.card;
	const area = from.closest<HTMLElement>(`.${CARD_NOTES_CLASS}`);
	if (!card || !area) return;
	const opened = view.editing.openNotesPiece(to.range, to.isNew ?? false, to.indent);
	if (opened === null) return;
	handedOn.add(from);
	hideField(from);
	const text = to.text ?? opened;
	const field = pieceField(text);
	putField(area, to.place, field);
	field.focus();
	const caret = to.caret === 'start' ? 0 : to.caret === 'end' || !text.includes('\n') ? text.length : text.indexOf('\n');
	field.setSelectionRange(caret, caret);
	removeField(from);
	coverField(to.place, field);
	buildFormatBar(field);
	fitHeight(field);
	drawCardNotes(view, card, area);
}

// `range` null opens a new piece after the last.
function openPiece(view: PrinceListView, area: HTMLElement, place: PiecePlace, range: LineRange | null, click?: MouseEvent): HTMLTextAreaElement | null {
	const found = selectedNotes(view);
	if (!found) return null;
	const end = notesEnd(found.notes) ?? found.notes.start;
	const text = view.editing.openNotesPiece(range ?? { start: end, end }, range === null);
	if (text === null) return null;
	// Before the drawing makes way for the field.
	const clicked = place.kind === 'item' ? place.li : place.kind === 'piece' ? place.el : null;
	const caret = click && clicked ? caretAtClick(clicked, click, text) : text.length;
	const field = pieceField(text);
	showField(area, place, field);
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

// The field can't save any more: it takes no more typing, and what it held can be copied.
function pieceLost(view: PrinceListView, field: HTMLTextAreaElement): void {
	field.readOnly = true;
	sayFieldLost(view, field.value, 'notes');
}

export function selectedNotes(view: PrinceListView): { notes: Notes; checklist: ChecklistLine[] | null } | null {
	const { lines, model } = view.parse();
	const item = view.selected === null ? undefined : itemAt(model, view.selected);
	if (!item) return null;
	return { notes: { markdown: getItemNotes(lines, item), start: notesStartLine(lines, item) }, checklist: checklistOf(lines, item) };
}
