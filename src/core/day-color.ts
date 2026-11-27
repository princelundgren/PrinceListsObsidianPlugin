import { isOverdue } from './overdue';
import type { ThemeColor } from './theme-color';
import { daysFrom } from './when';

export const DEFAULT_OVERDUE_COLOR: ThemeColor = 'none';
export const DEFAULT_TODAY_COLOR: ThemeColor = 'none';

/** The colors the settings give an overdue item's day and today's. */
export interface DayColors {
	readonly overdueColor: ThemeColor;
	readonly todayColor: ThemeColor;
}

/** The color of a row's day `day`: the overdue color for an overdue item, Today's for an open item due today, else none. */
export function dayColor(day: string, today: string, done: boolean, colors: DayColors): ThemeColor {
	if (isOverdue(day, today, done)) return colors.overdueColor;
	return !done && daysFrom(today, day) === 0 ? colors.todayColor : 'none';
}
