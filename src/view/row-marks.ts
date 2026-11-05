import { getLanguage, setIcon } from 'obsidian';
import { dayLabel } from '../core/when';

export function addStar(rowEl: HTMLElement): void {
	setIcon(rowEl.createSpan({ cls: 'princelists-star' }), 'star');
}

export function addWhen(rowEl: HTMLElement, day: string, today: string): void {
	fillWhen(rowEl.createSpan({ cls: 'princelists-when' }), day, today);
}

export function fillWhen(el: HTMLElement, day: string, today: string): void {
	el.empty();
	setIcon(el.createSpan({ cls: 'princelists-when-icon' }), 'calendar');
	el.createSpan({ text: dayLabel(day, today, getLanguage()) });
}
