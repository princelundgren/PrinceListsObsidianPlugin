import { Menu, setIcon, setTooltip } from 'obsidian';
import { groupState } from '../core/group-edits';
import { barButtons, type BarButton, type EntryGroup } from '../core/group-menu';
import { contentStartLine } from '../obsidian/marker';
import { targetOf } from './dom';
import type { PrinceListView } from './list-view';
import { clearSelection, focusList } from './select';
import { addGroupEntries, deleteSelection, listHasHeadings, moveToHeading } from './selection-menu';

/** The class on the view's content while selecting, which draws checkboxes as selection circles. */
const SELECTING_CLASS = 'princelists-selecting';

interface SelectionBar {
	el: HTMLElement;
	countEl: HTMLElement;
	buttons: Map<BarButton, HTMLButtonElement>;
}

const bars = new WeakMap<PrinceListView, SelectionBar>();

const BUTTONS: readonly { button: BarButton; label: string; icon: string }[] = [
	{ button: 'move', label: 'Move to', icon: 'list-end' },
	{ button: 'tick', label: 'Tick', icon: 'check' },
	{ button: 'star', label: 'Star', icon: 'star' },
	{ button: 'date', label: 'Date', icon: 'calendar' },
	{ button: 'delete', label: 'Delete', icon: 'trash-2' },
];

/**
 * Builds the bar for acting on the selection (selecting several rows, "The bar"): Done and how many
 * rows are selected, then Move to, Tick, Star and Date, and Delete apart past a divider. It goes on
 * the view's container where the floating "+" goes, hidden until syncSelectionBar shows it.
 */
export function buildSelectionBar(view: PrinceListView): HTMLElement {
	const el = view.containerEl.createDiv({ cls: 'princelists-selection-bar', attr: { role: 'toolbar', 'aria-label': 'Selection' } });
	el.hide();
	const top = el.createDiv({ cls: 'princelists-selection-bar-top' });
	const done = top.createEl('button', { cls: 'princelists-selection-done', attr: { 'aria-label': 'Done' } });
	setTooltip(done, 'Done');
	setIcon(done, 'x');
	const countEl = top.createSpan({ cls: 'princelists-selection-count' });
	el.createDiv({ cls: 'princelists-selection-divider', attr: { 'aria-hidden': 'true' } });
	const actionsEl = el.createDiv({ cls: 'princelists-selection-actions' });
	const actions = new Map<HTMLElement, () => void>([[done, () => clearSelection(view)]]);
	const buttons = new Map<BarButton, HTMLButtonElement>();
	for (const { button, label, icon } of BUTTONS) {
		if (button === 'delete') actionsEl.createDiv({ cls: 'princelists-selection-divider', attr: { 'aria-hidden': 'true' } });
		const buttonEl = actionsEl.createEl('button', {
			cls: `princelists-selection-action princelists-selection-${button}`,
			attr: { 'aria-label': label, ...(opensMenu(button) ? { 'aria-haspopup': 'menu' } : {}) },
		});
		setTooltip(buttonEl, label);
		setIcon(buttonEl.createSpan({ cls: 'princelists-selection-icon' }), icon);
		buttonEl.createSpan({ cls: 'princelists-selection-label', text: label });
		buttons.set(button, buttonEl);
		actions.set(buttonEl, () => act(view, button, buttonEl));
	}
	view.registerDomEvent(el, 'click', (evt) => {
		const buttonEl = targetOf(evt)?.closest('button');
		if (buttonEl && !buttonEl.disabled) actions.get(buttonEl)?.();
	});
	bars.set(view, { el, countEl, buttons });
	return el;
}

/** The bar while the view is selecting, which covers the list's bottom; null otherwise. */
export function shownSelectionBar(view: PrinceListView): HTMLElement | null {
	return view.selecting ? (bars.get(view)?.el ?? null) : null;
}

/**
 * Shows the bar while the view is selecting, with how many rows are selected and each button enabled
 * only while it has something to act on, and marks the view's content so checkboxes show as selection
 * circles. Hides both otherwise, first moving focus to the list if the bar holds it.
 */
export function syncSelectionBar(view: PrinceListView): void {
	view.contentEl.toggleClass(SELECTING_CLASS, view.selecting);
	const bar = bars.get(view);
	if (!bar) return;
	if (!view.selecting && bar.el.contains(bar.el.doc.activeElement)) focusList(view);
	bar.el.toggle(view.selecting);
	if (!view.selecting) return;
	const rows = view.selection.lines();
	bar.countEl.setText(`${rows.length} selected`);
	const enabled = barButtons(groupState(view.text, contentStartLine(view.text), rows), listHasHeadings(view));
	for (const [button, buttonEl] of bar.buttons) buttonEl.disabled = !enabled[button];
}

// Move to and Delete act as the selection menu's entries do; Tick, Star and Date open a menu of their
// group's entries above the button.
function act(view: PrinceListView, button: BarButton, buttonEl: HTMLElement): void {
	if (opensMenu(button)) showGroupMenu(view, button, buttonEl);
	else if (button === 'move') moveToHeading(view);
	else deleteSelection(view);
}

function opensMenu(button: BarButton): button is EntryGroup {
	return button !== 'move' && button !== 'delete';
}

function showGroupMenu(view: PrinceListView, group: EntryGroup, buttonEl: HTMLElement): void {
	const menu = new Menu();
	addGroupEntries(view, menu, group);
	const { left, top, width } = buttonEl.getBoundingClientRect();
	menu.showAtPosition({ x: left, y: top, width, overlap: true }, buttonEl.doc);
}
