import { setIcon } from 'obsidian';
import { planGroupLineEdit } from '../core/group-edits';
import { tagChangeMessage, type TagChange } from '../core/group-menu';
import { rowTexts, sameRowTexts, type RowText } from '../core/row-texts';
import { selectionTags } from '../core/selection-tags';
import { addTag, removeTag } from '../core/tag-edit';
import { contentStartLine } from '../obsidian/marker';
import { TAG_INPUT_CLASS } from './card-tags';
import { addHiddenLabel, targetOf } from './dom';
import { queueGroupAction } from './group-write';
import type { PrinceListView } from './list-view';
import { focusList } from './select';
import { stripTagOrder, TagSuggest, type TagTarget } from './tag-suggest';

const POPOVER_CLASS = 'princelists-selection-tag-popover';
const CHIPS_CLASS = 'princelists-selection-tags';
const CHIP_CLASS = 'princelists-selection-tag';
const REMOVE_CLASS = 'princelists-selection-tag-remove';

interface OpenPopover {
	button: HTMLElement;
	input: HTMLInputElement;
	suggest: TagSuggest;
	/** The selected rows and their text when it opened. */
	rows: readonly RowText[];
}

interface SelectionTagPopover {
	el: HTMLElement;
	open: OpenPopover | null;
	/** Whether the press under way closed it, so its mousedown is held back too. */
	pressClosedIt: boolean;
}

const popovers = new WeakMap<PrinceListView, SelectionTagPopover>();
const tagOfRemove = new WeakMap<HTMLElement, string>();

/**
 * Builds the selection's tag popover on the view's container, beside the bar, hidden until
 * openSelectionTagPopover fills it, and registers its listeners.
 */
export function buildSelectionTagPopover(view: PrinceListView): void {
	const el = view.containerEl.createDiv({ cls: POPOVER_CLASS, attr: { role: 'dialog' } });
	el.hide();
	addHiddenLabel(el, 'Tag the selection');
	popovers.set(view, { el, open: null, pressClosedIt: false });
	view.registerDomEvent(el, 'click', (evt) => onClick(view, evt));
	view.registerDomEvent(el, 'keydown', (evt) => onKeyDown(view, evt));
	view.registerDomEvent(el, 'focusout', (evt) => onFocusOut(view, evt));
	// In the capture phase, so a press that closes it reaches nothing else in the view.
	view.registerDomEvent(view.containerEl, 'pointerdown', (evt) => onPointerDown(view, evt), { capture: true });
	view.registerDomEvent(view.containerEl, 'mousedown', (evt) => onMouseDown(view, evt), { capture: true });
}

/** Closes the popover and focuses `button` if it's open; opens it over `button` otherwise. */
export function toggleSelectionTagPopover(view: PrinceListView, button: HTMLElement): void {
	if (popovers.get(view)?.open) closeToButton(view);
	else openSelectionTagPopover(view, button);
}

/**
 * Opens the popover over `button` with the selected items' tags as chips, each with a × that takes it
 * off them all, then a field whose pick gives a tag to them all, and focuses the field.
 */
export function openSelectionTagPopover(view: PrinceListView, button: HTMLElement): void {
	const popover = popovers.get(view);
	if (!popover) return;
	closeSelectionTagPopover(view);
	const lines = view.selection.lines();
	const { items, chips } = selectionTags(view.text, contentStartLine(view.text), lines, stripTagOrder(view));
	if (chips.length > 0) {
		const chipsEl = popover.el.createDiv({ cls: CHIPS_CLASS });
		for (const { tag, count } of chips) {
			const chip = chipsEl.createSpan({ cls: ['princelists-tag', CHIP_CLASS], text: count === items ? `#${tag}` : `#${tag} ${count} of ${items}` });
			const remove = chip.createEl('button', { cls: REMOVE_CLASS, attr: { 'aria-label': `Remove #${tag}` } });
			setIcon(remove, 'x');
			tagOfRemove.set(remove, tag);
		}
	}
	const input = popover.el.createEl('input', { cls: TAG_INPUT_CLASS, type: 'text', attr: { placeholder: 'Tag' } });
	addHiddenLabel(input, 'Add tag');
	popover.open = { button, input, rows: rowTexts(view.text, lines), suggest: new TagSuggest(view, input, selectionTagTarget(view)) };
	button.setAttr('aria-expanded', 'true');
	popover.el.show();
	placeSelectionTagPopover(view);
	input.focus();
}

/** Closes the popover and its suggestions, whose own popover sits outside the view's element. */
export function closeSelectionTagPopover(view: PrinceListView): void {
	const popover = popovers.get(view);
	const open = popover?.open;
	if (!popover || !open) return;
	popover.open = null;
	open.suggest.close();
	popover.el.hide();
	popover.el.empty();
	open.button.setAttr('aria-expanded', 'false');
}

/** Places the open popover above its button, right-aligned with it; the CSS keeps it inside the view. */
export function placeSelectionTagPopover(view: PrinceListView): void {
	const popover = popovers.get(view);
	const open = popover?.open;
	if (!popover || !open) return;
	const container = view.containerEl.getBoundingClientRect();
	const button = open.button.getBoundingClientRect();
	popover.el.setCssProps({
		'--princelists-tag-popover-bottom': `${container.bottom - button.top}px`,
		'--princelists-tag-popover-end': `${container.right - button.right}px`,
	});
}

/**
 * Closes the open popover once the view stops selecting, or the selected rows or their text differ from
 * those it opened with. Focus it held goes to its button while selecting and the button takes it, or to the list.
 */
export function syncSelectionTagPopover(view: PrinceListView): void {
	const popover = popovers.get(view);
	const open = popover?.open;
	if (!popover || !open) return;
	if (view.selecting && sameRowTexts(rowTexts(view.text, view.selection.lines()), open.rows)) return;
	const heldFocus = popover.el.contains(popover.el.doc.activeElement);
	closeSelectionTagPopover(view);
	if (!heldFocus) return;
	if (view.selecting) open.button.focus();
	if (open.button.doc.activeElement !== open.button) focusList(view);
}

/** Whether `target` is in the popover while it's open. */
export function isInSelectionTagPopover(view: PrinceListView, target: Node | null): boolean {
	const popover = popovers.get(view);
	return popover !== undefined && popover.open !== null && popover.el.contains(target);
}

// The selection when asked, which is the one it opened with: any change closes the popover.
function selectionTagTarget(view: PrinceListView): TagTarget {
	return {
		tagsToLeaveOut: () => selectionTags(view.text, contentStartLine(view.text), view.selection.lines(), []).shared,
		choose: (tag) => changeTag(view, 'addTag', tag),
	};
}

function changeTag(view: PrinceListView, change: TagChange, tag: string): void {
	closeToButton(view);
	const edit = change === 'addTag' ? (line: string) => addTag(line, tag) : (line: string) => removeTag(line, tag);
	queueGroupAction(
		view,
		view.selection.lines(),
		(text, contentStart, rows) => planGroupLineEdit(text, contentStart, rows, edit),
		(written) => tagChangeMessage(change, tag, written.changed),
	);
}

function closeToButton(view: PrinceListView): void {
	const button = popovers.get(view)?.open?.button;
	closeSelectionTagPopover(view);
	button?.focus();
}

function onClick(view: PrinceListView, evt: MouseEvent): void {
	const remove = targetOf(evt)?.closest<HTMLElement>(`.${REMOVE_CLASS}`);
	const tag = remove ? tagOfRemove.get(remove) : undefined;
	if (tag !== undefined) changeTag(view, 'removeTag', tag);
}

function onKeyDown(view: PrinceListView, evt: KeyboardEvent): void {
	if (evt.key !== 'Escape' || evt.isComposing) return;
	evt.preventDefault();
	closeToButton(view);
}

// Switching to another app leaves it open, as it leaves the card's tag popover.
function onFocusOut(view: PrinceListView, evt: FocusEvent): void {
	const popover = popovers.get(view);
	if (!popover?.open) return;
	// FocusEvent types it as an EventTarget; between elements it is an Element or null.
	const focusing = evt.relatedTarget as Node | null;
	if (!popover.el.contains(focusing) && popover.el.doc.hasFocus()) closeSelectionTagPopover(view);
}

// A primary press in the view's content only closes the popover: it selects nothing, opens nothing and
// starts no hold or drag, and its click is held back.
function onPointerDown(view: PrinceListView, evt: PointerEvent): void {
	const popover = popovers.get(view);
	if (!popover) return;
	popover.pressClosedIt = false;
	if (!popover.open || !evt.isPrimary || evt.button !== 0 || !view.contentEl.contains(evt.targetNode)) return;
	closeSelectionTagPopover(view);
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
