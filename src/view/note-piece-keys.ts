import type { LineRange } from '../core/follow';
import { neighborPiece, notePieces, pieceAround, pieceEnter } from '../core/note-pieces';
import { applyEdit } from './format';
import type { PrinceListView } from './list-view';
import { drawPieces, movePiece, typePiece } from './note-piece-field';
import { NOTE_PIECE_CLASS, type Notes, type PiecePlace } from './note-piece-state';
import { notesEnd, openablePieces } from './note-pieces';
import { notesHostOf, type NotesHost } from './notes-host';

// Enter and Shift+Enter send the same beforeinput, so Shift is noted on keydown.
const shiftEnters = new WeakSet<HTMLTextAreaElement>();

// Up at the field's very start, or Down at its very end, moves to the piece above or below.
export function pieceKeyDown(view: PrinceListView, field: HTMLTextAreaElement, evt: KeyboardEvent): void {
	if (evt.key === 'Enter') {
		if (evt.shiftKey) shiftEnters.add(field);
		else shiftEnters.delete(field);
		return;
	}
	const direction = evt.key === 'ArrowUp' ? 'up' : evt.key === 'ArrowDown' ? 'down' : null;
	const hasModifier = evt.shiftKey || evt.altKey || evt.ctrlKey || evt.metaKey;
	if (!direction || hasModifier || field.readOnly || field.selectionStart !== field.selectionEnd) return;
	const edge = direction === 'up' ? 0 : field.value.length;
	if (field.selectionStart === edge && moveToNeighbor(view, field, direction)) evt.preventDefault();
}

// Every platform's keyboard sends these, where some send no key for Enter or Backspace.
export function pieceBeforeInput(view: PrinceListView, field: HTMLTextAreaElement, evt: InputEvent): void {
	// Shift belongs to the keydown just before this input, whatever the input is.
	const isShiftEnter = shiftEnters.delete(field);
	if (evt.isComposing || field.readOnly) return;
	if (evt.inputType === 'deleteContentBackward') {
		// The keystroke that emptied the field already took its lines out.
		if (field.value === '' && moveToNeighbor(view, field, 'up')) evt.preventDefault();
		return;
	}
	const isEnter = evt.inputType === 'insertLineBreak' || evt.inputType === 'insertParagraph';
	if (!isEnter) return;
	const host = notesHostOf(view, field);
	const range = host?.range();
	if (isShiftEnter || !host || !range || field.selectionStart !== field.selectionEnd) return;
	const outdent = host.outdent(field.value);
	const enter = pieceEnter(field.value, field.selectionStart, outdent !== null);
	if (enter.kind === 'newline') return;
	evt.preventDefault();
	if (enter.kind === 'edit') applyEdit(field, enter.edit);
	else if (enter.kind === 'nextItem') movePiece(view, field, { place: nextItemPlace(field), range: { start: range.end, end: range.end }, text: enter.marker, caret: 'end' });
	else if (enter.kind === 'outdent' && outdent !== null) outdentItem(view, host, field, outdent);
	else endList(view, host, field);
}

function moveToNeighbor(view: PrinceListView, field: HTMLTextAreaElement, direction: 'up' | 'down'): boolean {
	const host = notesHostOf(view, field);
	if (!host) return false;
	// The drawn pieces take the lines typing moved them to.
	drawPieces(view, host);
	const current = host.range();
	const found = host.notes();
	if (!current || !found) return false;
	const openable = openablePieces(host.area, found.notes, current);
	const target = neighborPiece(openable.map((piece) => piece.range), current, direction);
	const to = openable.find((piece) => piece.range === target);
	if (!to) return false;
	const isParent = to.range.start < current.start && to.range.end >= current.end && to.range.end > current.start;
	movePiece(view, field, { place: to.place, range: to.range, caret: direction === 'down' ? 'start' : isParent ? 'firstLineEnd' : 'end' });
	return true;
}

// The empty item at the end of the field moves one level out, after the item it was nested in.
function outdentItem(view: PrinceListView, host: NotesHost, field: HTMLTextAreaElement, marker: string): void {
	const range = saveAllButLastLine(view, host, field);
	if (!range) return;
	const indent = /^[ \t]*/.exec(marker)?.[0] ?? '';
	const el = field.closest<HTMLElement>(`.${NOTE_PIECE_CLASS}`);
	const parent = field.closest('li')?.parentElement?.closest<HTMLElement>('li');
	const place: PiecePlace = el && parent && el.contains(parent) ? { kind: 'newItem', el, after: parent } : { kind: 'after', el: field };
	movePiece(view, field, { place, range: { start: range.end, end: range.end }, indent, text: marker.slice(indent.length), caret: 'end' });
}

// The empty item at the end of the field goes, and a new piece opens after its list.
function endList(view: PrinceListView, host: NotesHost, field: HTMLTextAreaElement): void {
	const range = saveAllButLastLine(view, host, field);
	const found = host.notes();
	if (!range || !found) return;
	const end = listEnd(found.notes, range);
	const el = field.closest<HTMLElement>(`.${NOTE_PIECE_CLASS}`);
	movePiece(view, field, { place: { kind: 'after', el: el ?? field }, range: { start: end, end }, isNew: notesEnd(found.notes) !== null, caret: 'end' });
}

// The open lines once the field's last line, an empty item, is taken out; null when that wasn't saved.
function saveAllButLastLine(view: PrinceListView, host: NotesHost, field: HTMLTextAreaElement): LineRange | null {
	const rest = field.value.slice(0, Math.max(field.value.lastIndexOf('\n'), 0));
	const range = host.range();
	if (!range) return null;
	const isUnsaved = range.start === range.end && rest === '';
	return isUnsaved || typePiece(view, field, rest) ? host.range() : null;
}

// A new item goes after the last item the field's own item holds; a field in place of a whole piece
// has its new item right after it.
function nextItemPlace(field: HTMLTextAreaElement): PiecePlace {
	const el = field.closest<HTMLElement>(`.${NOTE_PIECE_CLASS}`);
	const li = field.closest<HTMLElement>('li');
	if (!el || !li) return { kind: 'after', el: field };
	const items = li.querySelectorAll<HTMLElement>('li');
	return { kind: 'newItem', el, after: items[items.length - 1] ?? li };
}

// The line after the list holding the open lines, or the one they end.
function listEnd(notes: Notes, range: LineRange): number {
	const list = pieceAround(notePieces(notes.markdown), { start: range.start - notes.start, end: range.end - notes.start });
	return list ? notes.start + list.end : range.end;
}
