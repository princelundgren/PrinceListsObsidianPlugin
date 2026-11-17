import { setIcon } from 'obsidian';
import { TAG_INPUT_CLASS } from './card-tags';
import { addHiddenLabel, targetOf } from './dom';
import type { PrinceListView } from './list-view';
import { focusList } from './select';
import { TagSuggest } from './tag-suggest';

const POPOVER_CLASS = 'princelists-selection-tag-popover';
const BELOW_CLASS = 'princelists-tags-popover-below';
const CHIPS_CLASS = 'princelists-selection-tags';
const CHIP_CLASS = 'princelists-selection-tag';
const REMOVE_CLASS = 'princelists-selection-tag-remove';

/** One tag the target carries, as its chip's text shows it. */
export interface TagChip {
	tag: string;
	text: string;
}

/** What the tag popover tags: where it opens, the tags it shows and what a pick or a × does. */
export interface TagsPopoverTarget {
	/** The dialog's accessible name, such as "Tag the selection". */
	label: string;
	/** The element it sits against, found again each time it is placed; null keeps it closed. */
	anchor(): HTMLElement | null;
	/** 'above' always opens above the anchor; 'below' opens below it, or above when there is more room above. */
	side: 'above' | 'below';
	/** The button it opens from, whose aria-expanded follows it and which takes focus back; null for a menu's targets. */
	button: HTMLElement | null;
	chips: readonly TagChip[];
	tagsToLeaveOut(): readonly string[];
	add(tag: string): void;
	remove(tag: string): void;
	/** Whether what it opened on changed, read at each render: true closes it. */
	isStale(): boolean;
}

interface OpenPopover {
	target: TagsPopoverTarget;
	input: HTMLInputElement;
	suggest: TagSuggest;
}

interface TagsPopover {
	el: HTMLElement;
	/** The dialog's hidden label, whose text each open sets. */
	labelEl: HTMLElement;
	open: OpenPopover | null;
	/** Whether the press under way closed it, so its mousedown is held back too. */
	pressClosedIt: boolean;
}

const popovers = new WeakMap<PrinceListView, TagsPopover>();
const tagOfRemove = new WeakMap<HTMLElement, string>();

/**
 * Builds the tag popover on the view's container, hidden until openTagsPopover fills it, and
 * registers its listeners.
 */
export function buildTagsPopover(view: PrinceListView): void {
	const el = view.containerEl.createDiv({ cls: POPOVER_CLASS, attr: { role: 'dialog' } });
	el.hide();
	popovers.set(view, { el, labelEl: addHiddenLabel(el, ''), open: null, pressClosedIt: false });
	view.registerDomEvent(el, 'click', (evt) => onClick(view, evt));
	view.registerDomEvent(el, 'keydown', (evt) => onKeyDown(view, evt));
	view.registerDomEvent(el, 'focusout', (evt) => onFocusOut(view, evt));
	// In the capture phase, so a press that closes it reaches nothing else in the view.
	view.registerDomEvent(view.containerEl, 'pointerdown', (evt) => onPointerDown(view, evt), { capture: true });
	view.registerDomEvent(view.containerEl, 'mousedown', (evt) => onMouseDown(view, evt), { capture: true });
	view.registerDomEvent(view.listScrollEl, 'scroll', () => placeTagsPopover(view));
}

/**
 * Opens the popover on `target` with its tags as chips, each with a × that takes it off, then a field
 * whose pick gives a tag to it, and focuses the field. A target with no button has its anchor scrolled into view.
 * Nothing opens while the target's anchor is null.
 */
export function openTagsPopover(view: PrinceListView, target: TagsPopoverTarget): void {
	const popover = popovers.get(view);
	const anchor = target.anchor();
	if (!popover || !anchor) return;
	closeTagsPopover(view);
	popover.labelEl.setText(target.label);
	if (target.chips.length > 0) {
		const chipsEl = popover.el.createDiv({ cls: CHIPS_CLASS });
		for (const { tag, text } of target.chips) {
			const chip = chipsEl.createSpan({ cls: ['princelists-tag', CHIP_CLASS], text });
			const remove = chip.createEl('button', { cls: REMOVE_CLASS, attr: { 'aria-label': `Remove #${tag}` } });
			setIcon(remove, 'x');
			tagOfRemove.set(remove, tag);
		}
	}
	const input = popover.el.createEl('input', { cls: TAG_INPUT_CLASS, type: 'text', attr: { placeholder: 'Tag' } });
	addHiddenLabel(input, 'Add tag');
	const suggest = new TagSuggest(view, input, { tagsToLeaveOut: () => target.tagsToLeaveOut(), choose: (tag) => pick(view, 'add', tag) });
	popover.open = { target, input, suggest };
	target.button?.setAttr('aria-expanded', 'true');
	popover.el.show();
	if (!target.button) anchor.scrollIntoView({ block: 'nearest' });
	placeTagsPopover(view);
	input.focus();
}

/** Closes the popover and its suggestions, whose own popover sits outside the view's element. */
export function closeTagsPopover(view: PrinceListView): void {
	const popover = popovers.get(view);
	const open = popover?.open;
	if (!popover || !open) return;
	popover.open = null;
	open.suggest.close();
	popover.el.hide();
	popover.el.empty();
	open.target.button?.setAttr('aria-expanded', 'false');
}

/**
 * Places the open popover against its anchor, right-aligned with it: above it, or below it when the
 * target asks and there is at least as much room below as above in the view. The CSS keeps it inside the view.
 */
export function placeTagsPopover(view: PrinceListView): void {
	const popover = popovers.get(view);
	const open = popover?.open;
	const anchorEl = open?.target.anchor();
	if (!popover || !open || !anchorEl) return;
	const container = view.containerEl.getBoundingClientRect();
	const anchor = anchorEl.getBoundingClientRect();
	const below = open.target.side === 'below' && container.bottom - anchor.bottom >= anchor.top - container.top;
	popover.el.toggleClass(BELOW_CLASS, below);
	popover.el.setCssProps({
		[below ? '--princelists-tag-popover-top' : '--princelists-tag-popover-bottom']: `${below ? anchor.bottom - container.top : container.bottom - anchor.top}px`,
		'--princelists-tag-popover-end': `${container.right - anchor.right}px`,
	});
}

/**
 * Places the open popover against its anchor again after a render, which can rebuild or move it, or
 * closes it once its target is stale or its anchor is null. Focus it held goes to the target's button
 * when the button takes it, or to the list.
 */
export function syncTagsPopover(view: PrinceListView): void {
	const popover = popovers.get(view);
	const open = popover?.open;
	if (!popover || !open) return;
	if (!open.target.isStale() && open.target.anchor()) {
		placeTagsPopover(view);
		return;
	}
	const heldFocus = popover.el.contains(popover.el.doc.activeElement);
	closeTagsPopover(view);
	if (heldFocus) returnFocus(view, open.target);
}

/** Whether `target` is in the popover while it's open. */
export function isInTagsPopover(view: PrinceListView, target: Node | null): boolean {
	const popover = popovers.get(view);
	return popover !== undefined && popover.open !== null && popover.el.contains(target);
}

/** Whether it is open from `button`, so that button's press closes it rather than opening it again. */
export function isTagsPopoverOpenFrom(view: PrinceListView, button: HTMLElement): boolean {
	return popovers.get(view)?.open?.target.button === button;
}

function returnFocus(view: PrinceListView, target: TagsPopoverTarget): void {
	target.button?.focus();
	if (!target.button || target.button.doc.activeElement !== target.button) focusList(view);
}

// Closes first, so the target's write finds the view as it will render it.
function pick(view: PrinceListView, change: 'add' | 'remove', tag: string): void {
	const target = popovers.get(view)?.open?.target;
	if (!target) return;
	closeTagsPopover(view);
	returnFocus(view, target);
	if (change === 'add') target.add(tag);
	else target.remove(tag);
}

function onClick(view: PrinceListView, evt: MouseEvent): void {
	const remove = targetOf(evt)?.closest<HTMLElement>(`.${REMOVE_CLASS}`);
	const tag = remove ? tagOfRemove.get(remove) : undefined;
	if (tag !== undefined) pick(view, 'remove', tag);
}

function onKeyDown(view: PrinceListView, evt: KeyboardEvent): void {
	if (evt.key !== 'Escape' || evt.isComposing) return;
	evt.preventDefault();
	const target = popovers.get(view)?.open?.target;
	closeTagsPopover(view);
	if (target) returnFocus(view, target);
}

// Switching to another app leaves it open, as it leaves the card's tag popover.
function onFocusOut(view: PrinceListView, evt: FocusEvent): void {
	const popover = popovers.get(view);
	if (!popover?.open) return;
	// FocusEvent types it as an EventTarget; between elements it is an Element or null.
	const focusing = evt.relatedTarget as Node | null;
	if (!popover.el.contains(focusing) && popover.el.doc.hasFocus()) closeTagsPopover(view);
}

// A primary press in the view's content only closes the popover: it selects nothing, opens nothing and
// starts no hold or drag, and its click is held back.
function onPointerDown(view: PrinceListView, evt: PointerEvent): void {
	const popover = popovers.get(view);
	if (!popover) return;
	popover.pressClosedIt = false;
	if (!popover.open || !evt.isPrimary || evt.button !== 0 || !view.contentEl.contains(evt.targetNode)) return;
	closeTagsPopover(view);
	focusList(view);
	view.swallowNextClick = true;
	popover.pressClosedIt = true;
	evt.stopPropagation();
}

// The closing press starts no row's native drag and focuses no field. A press in the popover off its
// field keeps the field focused, so the popover stays open for the click, as Safari focuses no button.
function onMouseDown(view: PrinceListView, evt: MouseEvent): void {
	const popover = popovers.get(view);
	if (!popover) return;
	const target = evt.targetNode;
	if (popover.pressClosedIt || (popover.open && popover.el.contains(target) && target !== popover.open.input)) evt.preventDefault();
	popover.pressClosedIt = false;
}
