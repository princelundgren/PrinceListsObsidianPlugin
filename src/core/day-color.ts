import { isOverdue } from './overdue';
import { daysFrom } from './when';

/** A day's color, as the settings' dropdowns store it: none, or one of Obsidian's theme colors. */
export const DATE_COLORS = ['none', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'] as const;
export type DateColor = (typeof DATE_COLORS)[number];

export const DEFAULT_OVERDUE_COLOR: DateColor = 'red';
export const DEFAULT_TODAY_COLOR: DateColor = 'blue';

/** The colors the settings give an overdue item's day and today's. */
export interface DayColors {
	readonly overdueColor: DateColor;
	readonly todayColor: DateColor;
}

function dateColorOf(stored: unknown): DateColor | null {
	return DATE_COLORS.find((color) => color === stored) ?? null;
}

/** A stored overdue color as one of the choices: the default when it is none of them. */
export function overdueColorOf(stored: unknown): DateColor {
	return dateColorOf(stored) ?? DEFAULT_OVERDUE_COLOR;
}

/** A stored Today color as one of the choices: the default when it is none of them. */
export function todayColorOf(stored: unknown): DateColor {
	return dateColorOf(stored) ?? DEFAULT_TODAY_COLOR;
}

/** The color of a row's day `day`: the overdue color for an overdue item, Today's for an open item due today, else none. */
export function dayColor(day: string, today: string, done: boolean, colors: DayColors): DateColor {
	if (isOverdue(day, today, done)) return colors.overdueColor;
	return !done && daysFrom(today, day) === 0 ? colors.todayColor : 'none';
}
