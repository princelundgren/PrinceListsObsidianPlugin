import { getLanguage, setIcon } from 'obsidian';
import { dayColor } from '../core/day-color';
import { rowDay, type OverdueStyle } from '../core/overdue';
import { THEME_COLORS, type ThemeColor } from '../core/theme-color';
import { dayLabel } from '../core/when';

const STAR_CLASS = 'princelists-star';

export function addStar(rowEl: HTMLElement): void {
	setIcon(rowEl.createSpan({ cls: STAR_CLASS }), 'star');
}

/** Gives the stars under `rootEl` the settings' star color: a row's, the card's and the starred-only toggle's. */
export function showStarColor(rootEl: HTMLElement, color: ThemeColor): void {
	for (const each of THEME_COLORS) rootEl.toggleClass(`princelists-star-color-${each}`, each === color);
}

/** The `Repeats` icon, just before the row's day, or at the row's end when it shows none. */
export function addRepeat(rowEl: HTMLElement): void {
	const icon = rowEl.createSpan({ cls: 'princelists-repeat', attr: { 'aria-label': 'Repeats' } });
	setIcon(icon, 'repeat');
	const when = rowEl.querySelector(':scope > .princelists-when');
	if (when) rowEl.insertBefore(icon, when);
}

/**
 * The row's day at its end, in the color `style` gives an overdue day or today's. An overdue item's
 * shows the label `style` names, with "Overdue" and the plain label for screen readers in place of
 * what's shown.
 */
export function addWhen(rowEl: HTMLElement, day: string, today: string, done: boolean, style: OverdueStyle): void {
	const el = rowEl.createSpan({ cls: 'princelists-when' });
	const color = dayColor(day, today, done, style);
	if (color !== 'none') el.addClass(`princelists-when-${color}`);
	const { shown, spoken } = rowDay(day, today, done, style.label, getLanguage());
	if (spoken === null) {
		el.setText(shown);
		return;
	}
	el.createSpan({ text: shown, attr: { 'aria-hidden': 'true' } });
	el.createSpan({ cls: 'princelists-spoken', text: spoken });
}

/** The card's day: the plain label, whether or not the item is overdue. */
export function fillWhen(el: HTMLElement, day: string, today: string): void {
	el.setText(dayLabel(day, today, getLanguage()));
}

/**
 * Adds a chip per tag in `tags`, as `#tag`, each after a space, so they follow the title's text and
 * wrap as words do; nothing for no tags. A chip takes no listener: a click reaches the row's.
 */
export function addTags(parent: HTMLElement, tags: readonly string[]): void {
	if (tags.length === 0) return;
	const strip = parent.createSpan({ cls: 'princelists-tags' });
	for (const tag of tags) {
		strip.appendText(' ');
		strip.createSpan({ cls: 'princelists-tag', text: `#${tag}` });
	}
}
