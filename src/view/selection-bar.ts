import { Menu, setIcon, setTooltip } from 'obsidian';
import { groupState } from '../core/group-edits';
import { barButtons, type BarButton } from '../core/group-menu';
import { contentStartLine } from '../obsidian/marker';
import { targetOf } from './dom';
import type { PrinceListView } from './list-view';
import { onMenuHide } from './menu-anchor';
import { showViewMenu } from './menu-press';
import { clearSelection, focusList } from './select';
import { addHeadingEntries } from './heading-menu';
import { addGroupEntries, deleteSelection, listHasHeadings, moveSelectionTo } from './selection-menu';
import { openSelectionTagPopover } from './selection-tag-popover';
import { closeTagsPopover, isInTagsPopover, syncTagsPopover } from './tags-popover';

/** The class on the view's content while selecting. */
const SELECTING_CLASS = 'princelists-selecting';

// `menuFrom`: the button whose menu shows, or null. `closing`: the button a press found its own
// menu open on, so that press only closes the menu, which Obsidian does on mousedown.
interface SelectionBar {
	el: HTMLElement;
	buttons: Map<BarButton, HTMLButtonElement>;
	menuFrom: HTMLElement | null;
	closing: HTMLElement | null;
}

const bars = new WeakMap<PrinceListView, SelectionBar>();

const BUTTONS: readonly { button: BarButton; label: string; icon: string }[] = [
	{ button: 'move', label: 'Move to', icon: 'list-end' },
	{ button: 'date', label: 'Date', icon: 'calendar' },
	{ button: 'delete', label: 'Delete', icon: 'trash-2' },
	{ button: 'more', label: 'More', icon: 'more-horizontal' },
];

/**
 * Builds the bar for acting on the selection (selecting several rows, "The bar"): Done, then Move
 * to, Date and Delete, and More apart past a divider. It goes on the view's container where the
 * floating "+" goes, hidden until syncSelectionBar shows it.
 */
export function buildSelectionBar(view: PrinceListView): HTMLElement {
	const el = view.containerEl.createDiv({ cls: 'princelists-selection-bar', attr: { role: 'toolbar', 'aria-label': 'Selection' } });
	el.hide();
	const done = el.createEl('button', { cls: 'princelists-selection-done', attr: { 'aria-label': 'Done' } });
	setTooltip(done, 'Done');
	setIcon(done, 'x');
	el.createDiv({ cls: 'princelists-selection-divider', attr: { 'aria-hidden': 'true' } });
	const actionsEl = el.createDiv({ cls: 'princelists-selection-actions' });
	const actions = new Map<HTMLElement, () => void>([[done, () => clearSelection(view)]]);
	const buttons = new Map<BarButton, HTMLButtonElement>();
	for (const { button, label, icon } of BUTTONS) {
		if (button === 'more') actionsEl.createDiv({ cls: 'princelists-selection-divider', attr: { 'aria-hidden': 'true' } });
		const buttonEl = actionsEl.createEl('button', {
			cls: `princelists-selection-action princelists-selection-${button}`,
			attr: { 'aria-label': label, ...popupAttrs(button) },
		});
		setTooltip(buttonEl, label);
		setIcon(buttonEl.createSpan({ cls: 'princelists-selection-icon' }), icon);
		buttonEl.createSpan({ cls: 'princelists-selection-label', text: label });
		buttons.set(button, buttonEl);
		actions.set(buttonEl, () => act(view, button, buttonEl));
	}
	const bar: SelectionBar = { el, buttons, menuFrom: null, closing: null };
	view.registerDomEvent(el, 'pointerdown', (evt) => {
		const buttonEl = targetOf(evt)?.closest('button') ?? null;
		bar.closing = buttonEl !== null && buttonEl === bar.menuFrom ? buttonEl : null;
	});
	view.registerDomEvent(el, 'click', (evt) => {
		const buttonEl = targetOf(evt)?.closest('button');
		const closing = bar.closing;
		bar.closing = null;
		if (!buttonEl || buttonEl.disabled || buttonEl === closing) return;
		leaveTagPopover(view, buttonEl);
		actions.get(buttonEl)?.();
	});
	bars.set(view, bar);
	return el;
}

/** The bar while the view is selecting, which covers the list's bottom; null otherwise. */
export function shownSelectionBar(view: PrinceListView): HTMLElement | null {
	return view.selecting ? (bars.get(view)?.el ?? null) : null;
}

/**
 * Shows the bar while the view is selecting, named for how many rows are selected, with each button enabled
 * only while it has something to act on, and marks the view's content as selecting. Hides both
 * otherwise, first moving focus to the list if the bar holds it. Closes the tag popover once the
 * selection it opened for changes.
 */
export function syncSelectionBar(view: PrinceListView): void {
	view.contentEl.toggleClass(SELECTING_CLASS, view.selecting);
	const bar = bars.get(view);
	if (!bar) return;
	if (view.selecting) {
		const rows = view.selection.lines();
		bar.el.setAttr('aria-label', `${rows.length} selected`);
		const enabled = barButtons(groupState(view.text, contentStartLine(view.text), rows), listHasHeadings(view));
		for (const [button, buttonEl] of bar.buttons) buttonEl.disabled = !enabled[button];
	}
	syncTagsPopover(view);
	if (!view.selecting && bar.el.contains(bar.el.doc.activeElement)) focusList(view);
	bar.el.toggle(view.selecting);
}

/** Opens the selection's tag popover over the bar's More button, for a menu's Tag…; nothing while the button is missing or disabled. */
export function openSelectionTags(view: PrinceListView): void {
	const button = bars.get(view)?.buttons.get('more');
	if (button && !button.disabled) openSelectionTagPopover(view, button);
}

/** Opens the heading menu over the bar's Move to button, for a menu's Move to heading…; nothing while the button is missing or disabled. */
export function openMoveMenu(view: PrinceListView): void {
	const button = bars.get(view)?.buttons.get('move');
	if (button && !button.disabled) showMoveMenu(view, button);
}

// Move to opens a menu of the list's headings over the button, and Date and More one of their
// group's entries; Delete acts as the selection menu's entry does.
function act(view: PrinceListView, button: BarButton, buttonEl: HTMLElement): void {
	if (button === 'move') showMoveMenu(view, buttonEl);
	else if (button === 'delete') deleteSelection(view);
	else showMenu(view, buttonEl, (menu) => addGroupEntries(view, menu, button));
}

function popupAttrs(button: BarButton): Record<string, string> {
	return button === 'delete' ? {} : { 'aria-haspopup': 'menu' };
}

// Safari doesn't focus a clicked button, so the popover's field can keep focus while another button acts.
function leaveTagPopover(view: PrinceListView, buttonEl: HTMLElement): void {
	if (isInTagsPopover(view, buttonEl.doc.activeElement)) buttonEl.focus();
	closeTagsPopover(view);
}

function showMoveMenu(view: PrinceListView, buttonEl: HTMLElement): void {
	showMenu(view, buttonEl, (menu) => addHeadingEntries(view, menu, (headingLine) => moveSelectionTo(view, headingLine)));
}

// A press on the button while its menu shows closes the menu instead of opening it again.
function showMenu(view: PrinceListView, buttonEl: HTMLElement, fill: (menu: Menu) => void): void {
	const menu = new Menu();
	fill(menu);
	const bar = bars.get(view);
	if (bar) {
		bar.menuFrom = buttonEl;
		onMenuHide(menu, () => {
			if (bar.menuFrom === buttonEl) bar.menuFrom = null;
		});
	}
	const { left, top, width } = buttonEl.getBoundingClientRect();
	showViewMenu(view, menu, () => menu.showAtPosition({ x: left, y: top, width, overlap: true }, buttonEl.doc));
}
