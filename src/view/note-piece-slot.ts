import { Component, MarkdownRenderer } from 'obsidian';
import type { LineRange } from '../core/follow';
import { itemPieces } from '../core/note-pieces';
import { replaceKeeping } from './dom';
import { FORMAT_BAR_CLASS } from './format';
import {
	drawnPieces,
	fieldPieces,
	NOTES_END_CLASS,
	OPEN_ITEM_CLASS,
	PLACEHOLDER_CLASS,
	shift,
	standIns,
	type Drawing,
	type Notes,
	type Piece,
	type PiecePlace,
} from './note-piece-state';

// Puts the field in place of what `place` draws, which waits, hidden, until the field closes.
export function showField(area: HTMLElement, place: PiecePlace, field: HTMLTextAreaElement): void {
	putField(area, place, field);
	coverField(place, field);
}

// Puts the field where `place` says, in sight. coverField then hides what it stands for, apart, so the
// field can take focus first from the one in what it hides.
export function putField(area: HTMLElement, place: PiecePlace, field: HTMLTextAreaElement): void {
	if (place.kind === 'after') {
		const bar = place.el.nextElementSibling;
		(bar?.hasClass(FORMAT_BAR_CLASS) ? bar : place.el).after(field);
	} else if (place.kind === 'end' || !drawnPieces.has(place.el)) {
		area.querySelector(`:scope > .${PLACEHOLDER_CLASS}`)?.replaceWith(createDiv({ cls: NOTES_END_CLASS }));
		area.insertBefore(field, area.querySelector(`:scope > .${NOTES_END_CLASS}`));
	} else if (place.kind === 'piece') {
		place.el.after(field);
	} else if (place.kind === 'item') {
		place.li.append(field);
	} else {
		const li = createEl('li', { cls: OPEN_ITEM_CLASS });
		standIns.add(li);
		place.after.after(li);
		li.append(field);
	}
}

export function coverField(place: PiecePlace, field: HTMLTextAreaElement): void {
	const drawn = place.kind === 'end' || place.kind === 'after' ? undefined : drawnPieces.get(place.el);
	if (!drawn || place.kind === 'end' || place.kind === 'after') return;
	fieldPieces.set(field, place.el);
	if (place.kind === 'piece') {
		place.el.hide();
		drawn.hidden = place.el;
	} else if (place.kind === 'item') {
		drawn.hidden = hideAround(place.li, field);
	} else {
		// A new item has nothing drawn until its list is drawn again around the field.
		drawn.hidden = field.parentElement;
	}
}

// Shows again what the field stood in for. The caller removes the field once it has lost focus.
export function hideField(field: HTMLTextAreaElement): void {
	const el = fieldPieces.get(field);
	const drawn = el ? drawnPieces.get(el) : undefined;
	fieldPieces.delete(field);
	if (!el || !drawn?.hidden) return;
	if (drawn.hidden === el) {
		el.show();
	} else if (drawn.hidden !== field.parentElement) {
		drawn.hidden.parentElement?.removeClass(OPEN_ITEM_CLASS);
		drawn.hidden.replaceWith(...Array.from(drawn.hidden.childNodes));
	}
	drawn.hidden = null;
}

// Removes a field, with its format bar, and the new item it stood in.
export function removeField(field: HTMLTextAreaElement): void {
	const bar = field.nextElementSibling;
	if (bar?.hasClass(FORMAT_BAR_CLASS)) bar.remove();
	const parent = field.parentElement;
	field.remove();
	if (parent && standIns.has(parent) && !parent.hasChildNodes()) parent.remove();
}

// The list the field holds an item of, drawn again around the field once the renderer is done. The
// field and the elements it sits in stay, since moving a focused field blurs it; when the new drawing
// nests its item at another depth, the old one stays until the field closes.
export function redrawAround(drawing: Drawing, el: HTMLElement, piece: Piece, drawn: () => void): void {
	const shown = drawnPieces.get(el);
	const field = el.querySelector('textarea');
	const open = drawing.open;
	if (!shown || !field || !open) return;
	if (shown.redrawing?.text === piece.text && shown.redrawing.field === field) return;
	const attempt = { text: piece.text, field };
	shown.redrawing = attempt;
	const fresh = createDiv();
	const component = drawing.parent.addChild(new Component());
	const putAround = () => {
		const slot = openSlot(fresh, drawing.notes, piece.range, open);
		const isCurrent = shown.redrawing === attempt && fieldPieces.get(field) === el && field.isConnected;
		if (!slot || !isCurrent || depthIn(fresh, slot) !== depthIn(el, field)) {
			drawing.parent.removeChild(component);
			return;
		}
		const trailing: ChildNode[] = [];
		for (let node = field.nextSibling; node; node = node.nextSibling) trailing.push(node);
		replaceKeeping(el, fresh, field, slot);
		let kept = field.parentElement;
		for (let from = slot.parentElement; kept && from && kept !== el; from = from.parentElement) {
			copyAttributes(from, kept);
			if (standIns.has(from)) standIns.add(kept);
			else standIns.delete(kept);
			kept = kept.parentElement;
		}
		const hidden = hideAround(field.parentElement as HTMLElement, field);
		field.after(...trailing);
		drawing.parent.removeChild(shown.component);
		Object.assign(shown, { component, text: piece.text, hidden });
		drawn();
	};
	MarkdownRenderer.render(drawing.app, piece.text, fresh, drawing.sourcePath, component).then(putAround, (error: unknown) => {
		drawing.parent.removeChild(component);
		if (shown.redrawing === attempt) shown.redrawing = null;
		console.error(error);
	});
}

// What an item draws, but the field, waits hidden before the field.
function hideAround(li: HTMLElement, field: HTMLTextAreaElement): HTMLElement {
	const hidden = createDiv();
	hidden.append(...Array.from(li.childNodes).filter((node) => node !== field));
	hidden.hide();
	field.before(hidden);
	li.addClass(OPEN_ITEM_CLASS);
	return hidden;
}

// Where the open lines' item goes in a new drawing of their list: in its li, or in a new li after the
// item the lines follow, when they're a new item not saved yet or one emptied.
function openSlot(fresh: HTMLElement, notes: Notes, range: LineRange, open: LineRange): HTMLElement | null {
	const items = itemPieces(notes.markdown, shift(range, -notes.start)).map((item) => shift(item, notes.start));
	const lis = Array.from(fresh.querySelectorAll<HTMLElement>('li'));
	if (lis.length !== items.length) return null;
	if (open.start < open.end) return lis[items.findIndex((item) => item.start === open.start)]?.createDiv() ?? null;
	let before: HTMLElement | undefined;
	items.forEach((item, index) => {
		if (item.end === open.start) before = lis[index];
	});
	if (!before) return null;
	const added = createEl('li');
	standIns.add(added);
	before.after(added);
	return added.createDiv();
}

function depthIn(root: Element, node: Element): number {
	let depth = 0;
	for (let at: Element | null = node; at && at !== root; at = at.parentElement) depth++;
	return depth;
}

function copyAttributes(from: Element, to: Element): void {
	for (const { name } of Array.from(to.attributes)) to.removeAttribute(name);
	for (const { name, value } of Array.from(from.attributes)) to.setAttribute(name, value);
}
