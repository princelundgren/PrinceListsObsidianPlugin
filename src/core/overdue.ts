import { dayLabel, daysFrom } from './when';

/** What an overdue item's day says, as the settings' dropdown stores it. */
export const OVERDUE_LABELS = ['yesterday-or-date', 'overdue', 'today'] as const;
export type OverdueLabel = (typeof OVERDUE_LABELS)[number];

export const DEFAULT_OVERDUE_LABEL: OverdueLabel = 'yesterday-or-date';
export const DEFAULT_COLOR_OVERDUE = true;

/** How the settings show an overdue item's day. */
export interface OverdueStyle {
	readonly label: OverdueLabel;
	readonly colored: boolean;
}

/** A row's day: what it shows, and what a screen reader hears in its place, or null when that's the same. */
export interface RowDay {
	readonly shown: string;
	readonly spoken: string | null;
}

/** A stored setting as one of the choices: the default when it is none of them. */
export function overdueLabelOf(stored: unknown): OverdueLabel {
	return OVERDUE_LABELS.find((label) => label === stored) ?? DEFAULT_OVERDUE_LABEL;
}

/** A stored setting as a boolean: the default when it isn't one. */
export function colorOverdueOf(stored: unknown): boolean {
	return typeof stored === 'boolean' ? stored : DEFAULT_COLOR_OVERDUE;
}

/** Whether an item is overdue: not done, and its When, `day`, before `today`. */
export function isOverdue(day: string, today: string, done: boolean): boolean {
	return !done && daysFrom(today, day) < 0;
}

/** The day a row shows for `day`, with `label` for an overdue item, and weekdays and dates in `language`. */
export function rowDay(day: string, today: string, done: boolean, label: OverdueLabel, language: string): RowDay {
	const plain = dayLabel(day, today, language);
	if (!isOverdue(day, today, done)) return { shown: plain, spoken: null };
	return { shown: OVERDUE_SHOWN[label] ?? plain, spoken: `Overdue, ${plain}` };
}

const OVERDUE_SHOWN: Record<OverdueLabel, string | null> = {
	'yesterday-or-date': null,
	overdue: 'Overdue',
	today: 'Today',
};
