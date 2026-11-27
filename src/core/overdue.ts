import type { DayColors } from './day-color';
import type { ThemeColor } from './theme-color';
import { dayLabel, daysFrom } from './when';

/** What an overdue item's day says, as the settings' dropdown stores it. */
export const OVERDUE_LABELS = ['yesterday-or-date', 'overdue', 'today'] as const;
export type OverdueLabel = (typeof OVERDUE_LABELS)[number];

export const DEFAULT_OVERDUE_LABEL: OverdueLabel = 'yesterday-or-date';

/** How the settings show a row's day and star: the overdue label, the overdue and Today colors, and the star's color. */
export interface OverdueStyle extends DayColors {
	readonly label: OverdueLabel;
	readonly starColor: ThemeColor;
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
	// The plain day, as any past day shows it.
	'yesterday-or-date': null,
	overdue: 'Overdue',
	today: 'Today',
};
