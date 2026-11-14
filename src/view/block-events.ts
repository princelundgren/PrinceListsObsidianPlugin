import { getLanguage, Notice, Platform } from 'obsidian';
import { toggleItem } from '../core/edit-items';
import { joinLines, splitLines } from '../core/lines';
import { itemAt, parseList } from '../core/parse';
import { backDayMessage } from '../core/when';
import { contentStartLine } from '../obsidian/marker';
import { pressCanLift } from './block-drag';
import { addBlockItem, addBlockItemBelow, BLOCK_FIELD_CLASS, BLOCK_TRASH_CLASS, closeBlockField, deleteBlockItem, openBlockField, showBlockItemMenu } from './block-fields';
import { targetOf } from './dom';
import type { ListBlock } from './list-block';
import { handleLinkClick, handleLinkMenu } from './notes';
import { ITEM_CLASS, lineOf, TICK_SELECTOR } from './render-list';
import { CHANGED_ELSEWHERE_NOTICE, tryEdit } from './write';

export const NEW_ITEM_CLASS = 'princelists-block-new-item';

/**
 * Registers the block's delegated listeners on `rootEl`, the block's own element, and a mouseup on its
 * document; all go away with the block. `notePath` is the note the block is in.
 */
export function registerBlockEvents(block: ListBlock, rootEl: HTMLElement, notePath: string): void {
	block.registerDomEvent(rootEl, 'click', (evt) => onClick(block, notePath, evt));
	block.registerDomEvent(rootEl, 'keydown', (evt) => onKeyDown(block, evt));
	block.registerDomEvent(rootEl, 'focusout', (evt) => onFocusOut(block, evt));
	block.registerDomEvent(rootEl, 'mousedown', (evt) => onMouseDown(block, rootEl, evt));
	block.registerDomEvent(rootEl.doc, 'mouseup', (evt) => onMouseUp(block, rootEl, evt));
	block.registerDomEvent(rootEl, 'dragend', () => onDragEnd(block));
	// The trash button doesn't take focus, so the field stays open until the click deletes.
	block.registerDomEvent(rootEl, 'pointerdown', (evt) => {
		if (targetOf(evt)?.closest(`.${BLOCK_TRASH_CLASS}`)) evt.preventDefault();
	});
	if (Platform.isDesktop) block.registerDomEvent(rootEl, 'contextmenu', (evt) => onContextMenu(block, notePath, evt));
}

// The line of the row holding `target`, or null while the rows are out of date.
function rowLine(block: ListBlock, target: Element): number | null {
	const rowEl = target.closest(`.${ITEM_CLASS}`);
	return rowEl && block.rowsMatchText() ? lineOf(rowEl) : null;
}

function onClick(block: ListBlock, notePath: string, evt: MouseEvent): void {
	const target = targetOf(evt);
	if (!target) return;
	if (block.field && !target.closest(`.${BLOCK_FIELD_CLASS}`)) closeBlockField(block, true);
	if (handleLinkClick(block.app, block.file?.path ?? notePath, evt, target)) return;
	if (target.closest(`.${NEW_ITEM_CLASS}`)) {
		addBlockItem(block, 'first');
		return;
	}
	// The field's own line: rows aren't drawn again while it's open, so theirs may be out of date.
	const fieldLine = block.field?.line.line;
	if (target.closest(`.${BLOCK_TRASH_CLASS}`)) {
		if (fieldLine !== null && fieldLine !== undefined) deleteBlockItem(block, fieldLine);
		return;
	}
	if (target.closest(`.${BLOCK_FIELD_CLASS}`)) return;
	const line = rowLine(block, target);
	if (line === null) return;
	if (target.closest(TICK_SELECTOR)) {
		// The box shows the file: the redraw after the write ticks it.
		evt.preventDefault();
		queueTick(block, line);
	} else {
		openBlockField(block, line, null);
	}
}

function onKeyDown(block: ListBlock, evt: KeyboardEvent): void {
	if (!block.field || evt.target !== block.field.el || evt.isComposing) return;
	if (evt.key === 'Escape') {
		evt.preventDefault();
		closeBlockField(block, false);
	} else if (evt.key === 'Enter') {
		evt.preventDefault();
		if (evt.shiftKey) addBlockItemBelow(block);
		else closeBlockField(block, true);
	}
}

// A press elsewhere keeps the field's focus, so the click closes it before a blur's redraw; one that
// can lift an item isn't canceled, which would stop the drag, and the lift or the click closes it.
function onMouseDown(block: ListBlock, rootEl: HTMLElement, evt: MouseEvent): void {
	const field = block.field;
	if (!field) return;
	const inField = targetOf(evt) === field.el;
	field.pressed = !inField && pressCanLift(rootEl, evt);
	if (!inField && !field.pressed) evt.preventDefault();
}

// A press released outside the block sends it no click.
function onMouseUp(block: ListBlock, rootEl: HTMLElement, evt: MouseEvent): void {
	const field = block.field;
	if (!field?.pressed) return;
	field.pressed = false;
	const target = evt.targetNode;
	if (!(target && rootEl.contains(target))) closeBlockField(block, true);
}

// A drag sends no mouseup, so one that ends before its lift would leave the field open without its focus.
function onDragEnd(block: ListBlock): void {
	if (!block.field?.pressed) return;
	block.field.pressed = false;
	closeBlockField(block, true);
}

function onFocusOut(block: ListBlock, evt: FocusEvent): void {
	if (block.field && evt.target === block.field.el && !block.field.pressed) closeBlockField(block, true);
}

// On desktop only: mobile has the field's trash button.
function onContextMenu(block: ListBlock, notePath: string, evt: MouseEvent): void {
	const target = targetOf(evt);
	if (!target || handleLinkMenu(block.app, block.file?.path ?? notePath, evt, target)) return;
	const line = rowLine(block, target);
	if (line === null) return;
	evt.preventDefault();
	showBlockItemMenu(block, evt, line);
}

// As a tick in the list view: it waits on the block's queue, and its line follows the block's own
// writes meanwhile.
function queueTick(block: ListBlock, line: number): void {
	const file = block.file;
	const pending = block.editing.track(line);
	const seen = block.outsideChanges;
	void block.enqueue(async () => {
		try {
			if (block.file !== file) return;
			if (block.outsideChanges !== seen) {
				new Notice(CHANGED_ELSEWHERE_NOTICE);
				return;
			}
			const titleLine = pending.line;
			const text = block.editing.text;
			const lines = splitLines(text);
			const item = titleLine === null ? null : itemAt(parseList(lines, contentStartLine(text)), titleLine);
			if (titleLine === null || !item) return;
			const now = new Date();
			const toggled = tryEdit(() => toggleItem(lines, item, now));
			if (!toggled) return;
			const after = joinLines(toggled.lines);
			const result = await block.write(after, text, { start: titleLine, delta: 0, kind: 'change', retitle: toggled.retitle });
			if (!block.field) block.draw();
			if (result === 'written' && toggled.back !== null) new Notice(backDayMessage(toggled.back, getLanguage()));
		} finally {
			block.editing.untrack(pending);
		}
	});
}
