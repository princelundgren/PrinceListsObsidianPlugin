import { setIcon } from 'obsidian';
import { sectionHeadingOf } from '../core/collapsed';
import type { ItemPlace } from '../core/list-actions';
import { addHiddenLabel } from './dom';
import type { PrinceListView } from './list-view';

export const COLLAPSE_CLASS = 'princelists-collapse';
const COLLAPSED_HEADING_CLASS = 'princelists-is-collapsed';

export function addCollapseArrow(headingEl: HTMLElement, collapsed: boolean): void {
	// Named by a hidden label, not aria-label, which Obsidian would show as a tooltip.
	const arrow = headingEl.createEl('button', { cls: COLLAPSE_CLASS, attr: { 'aria-expanded': String(!collapsed) } });
	setIcon(arrow, 'right-triangle');
	addHiddenLabel(arrow, 'Collapse section');
	headingEl.toggleClass(COLLAPSED_HEADING_CLASS, collapsed);
}

// A new or moved item lands in the place's section, so that section opens to show it.
export function expandFor(view: PrinceListView, place: ItemPlace): void {
	if (place === 'first') return;
	const { model } = view.parse();
	const heading = sectionHeadingOf(model, 'after' in place ? place.after : place.firstUnder);
	if (heading !== null) view.collapsed.expand(heading);
}
