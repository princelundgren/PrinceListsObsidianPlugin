import { getLanguage, setIcon } from 'obsidian';
import { dayLabel } from '../core/when';

export function addStar(rowEl: HTMLElement): void {
	setIcon(rowEl.createSpan({ cls: 'princelists-star' }), 'star');
}

/** The `Repeats` icon, just before the row's day, or at the row's end when it shows none. */
export function addRepeat(rowEl: HTMLElement): void {
	const icon = rowEl.createSpan({ cls: 'princelists-repeat', attr: { 'aria-label': 'Repeats' } });
	setIcon(icon, 'repeat');
	const when = rowEl.querySelector(':scope > .princelists-when');
	if (when) rowEl.insertBefore(icon, when);
}

export function addWhen(rowEl: HTMLElement, day: string, today: string): void {
	fillWhen(rowEl.createSpan({ cls: 'princelists-when' }), day, today);
}

export function fillWhen(el: HTMLElement, day: string, today: string): void {
	el.setText(dayLabel(day, today, getLanguage()));
}

/** Adds a chip per tag in `tags`, as `#tag`, or nothing for no tags. A chip takes no listener: a click reaches the row's. */
export function addTags(parent: HTMLElement, tags: readonly string[]): void {
	if (tags.length === 0) return;
	const strip = parent.createSpan({ cls: 'princelists-tags' });
	for (const tag of tags) strip.createSpan({ cls: 'princelists-tag', text: `#${tag}` });
}
