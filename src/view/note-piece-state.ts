import type { Component } from 'obsidian';
import type { ChecklistLine } from '../core/checklist';
import type { LineRange } from '../core/follow';
import type { MarkdownHost } from './notes';

export const NOTE_PIECE_CLASS = 'princelists-note-piece';
export const NOTES_END_CLASS = 'princelists-notes-end';
export const PLACEHOLDER_CLASS = 'princelists-placeholder';
export const OPEN_ITEM_CLASS = 'princelists-open-item';

/** A card's notes as getItemNotes reads them, and the file line they start on. */
export interface Notes {
	markdown: string;
	start: number;
}

/**
 * Where a field goes: in place of a piece, or of one item of a list piece; in a new item after the
 * item `after` of the list `el`; right after `el` and its format bar; or after the last piece.
 */
export type PiecePlace =
	| { kind: 'piece'; el: HTMLElement }
	| { kind: 'item'; el: HTMLElement; li: HTMLElement }
	| { kind: 'newItem'; el: HTMLElement; after: HTMLElement }
	| { kind: 'after'; el: HTMLElement }
	| { kind: 'end' };

export interface Piece {
	range: LineRange;
	text: string;
}

// A piece's element, and while a field stands in for it, or for one of its list's items, what it hid.
// `redrawing` is the last drawing of the list made around a field.
export interface DrawnPiece extends Piece {
	component: Component;
	hidden: HTMLElement | null;
	redrawing: { text: string; field: HTMLTextAreaElement } | null;
	/** The note its links and embeds were rendered for. */
	sourcePath: string;
}

export interface Drawing {
	notes: Notes;
	parent: Component;
	app: MarkdownHost['app'];
	sourcePath: string;
	checklist: readonly ChecklistLine[] | null;
	open: LineRange | null;
}

export const drawnPieces = new WeakMap<Element, DrawnPiece>();
// The piece each open field stands in for, or holds an item of.
export const fieldPieces = new WeakMap<HTMLTextAreaElement, HTMLElement>();

/** The lis put in for a new or emptied item, which nothing drew; each goes with its field. */
export const standIns = new WeakSet<Element>();

export function shift(range: LineRange, by: number): LineRange {
	return { start: range.start + by, end: range.end + by };
}
