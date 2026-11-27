import { isOverdue } from './overdue';
import type { ThemeColor } from './theme-color';
import { daysFrom } from './when';

export const DEFAULT_OVERDUE_COLOR: ThemeColor = 'none';
export const DEFAULT_TODAY_COLOR: ThemeColor = 'none';
export const DEFAULT_UPCOMING_COLOR: ThemeColor = 'none';

/** The colors the settings give an overdue item's day, today's and a later one's. */
export interface DayColors {
	readonly overdueColor: ThemeColor;
	readonly todayColor: ThemeColor;
	readonly upcomingColor: ThemeColor;
}

/**
 * The color of a row's day `day`: the overdue color for an overdue item, Today's for an open item
 * due today, the upcoming color for an open item due later, and none for a ticked item.
 */
export function dayColor(day: string, today: string, done: boolean, colors: DayColors): ThemeColor {
	if (done) return 'none';
	if (isOverdue(day, today, done)) return colors.overdueColor;
	return daysFrom(today, day) === 0 ? colors.todayColor : colors.upcomingColor;
}
