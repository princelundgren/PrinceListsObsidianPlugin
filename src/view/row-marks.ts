import { moment, setIcon } from 'obsidian';
import { dayLabelKind } from '../core/when';

export function addStar(rowEl: HTMLElement): void {
	setIcon(rowEl.createSpan({ cls: 'princelists-star' }), 'star');
}

// Obsidian sets moment's locale to its own language, so weekdays and dates follow it. Under
// TypeScript 6's esModuleInterop, Obsidian's `moment` export types as a namespace with no call
// signature, so the day is read through `moment.utc`, which formats in the same locale.
export function dayLabel(day: string, today: string): string {
	switch (dayLabelKind(day, today)) {
		case 'today':
			return 'Today';
		case 'tomorrow':
			return 'Tomorrow';
		case 'weekday':
			return moment.utc(day, 'YYYY-MM-DD').format('dddd');
		case 'date':
			return moment.utc(day, 'YYYY-MM-DD').format('ll');
	}
}

export function addWhen(rowEl: HTMLElement, day: string, today: string): void {
	fillWhen(rowEl.createSpan({ cls: 'princelists-when' }), day, today);
}

export function fillWhen(el: HTMLElement, day: string, today: string): void {
	el.empty();
	setIcon(el.createSpan({ cls: 'princelists-when-icon' }), 'calendar');
	el.createSpan({ text: dayLabel(day, today) });
}
