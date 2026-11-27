import { Notice } from 'obsidian';
import type { Typed } from '../core/editing';
import { followLine, type OwnEdit } from '../core/follow';
import { cardLost, dismissCard } from './card';
import type { PrinceListView } from './list-view';
import { ownElements } from './own-rows';
import { LINE_ATTR, lineOf, setLine } from './render-list';
import { UNSAFE_EDIT_NOTICE } from './write';

// One of the view's own writes landed (writeAction). The line-based state and every row's line
// follow it at once, so no row is read with a stale line.
export function applyOwnText(view: PrinceListView, next: string, edit: OwnEdit): void {
	view.editing.applyOwn(next, edit);
	shiftLines(view, edit);
	// Deleting the selected item closes its card.
	if (view.card && view.selected === null && view.card.lostAt === null) dismissCard(view);
}

// A keystroke's edit is already in the text: it saves after Obsidian's 2-second wait.
export function handleTyped(view: PrinceListView, typed: Typed): void {
	if ('edit' in typed) {
		shiftLines(view, typed.edit);
		view.requestSave();
	} else if ('refused' in typed && typed.firstRefusal) {
		new Notice(UNSAFE_EDIT_NOTICE);
	}
}

/** Takes an outside change to the text, and tells the open card when its item is gone (`cardLost`). */
export function outsideChange(view: PrinceListView, data: string): void {
	view.outsideChanges++;
	const before = view.selected;
	const { lostSelected } = view.editing.outsideChange(data);
	if (lostSelected && view.card && before !== null) cardLost(view, view.card, before);
}

function shiftLines(view: PrinceListView, edit: OwnEdit): void {
	if (edit.kind === 'change' && edit.delta === 0) return;
	for (const el of ownElements(view.contentEl, `[${LINE_ATTR}]`)) {
		setLine(el, followLine(lineOf(el) as number, edit));
	}
}
