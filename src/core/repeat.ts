import { daysFrom, isRealDay, utcOf } from './when';

export type RepeatUnit = 'day' | 'week' | 'month' | 'year';

export interface RepeatRule {
	every: number;
	unit: RepeatUnit;
	/** Months only: land on a month's last day instead of the same day of the month. */
	onLast: boolean;
	/** Count the next date from the day the item is ticked, not from its own date. */
	whenDone: boolean;
}

export type RepeatEnd = { kind: 'date'; day: string } | { kind: 'times'; left: number };

const DAY_MS = 86_400_000;
const RULE_PATTERN = /^every(?: (\d+))? (day|week|month|year)s?( on the last)?( when done)?$/;
const END_COUNT_PATTERN = /^(\d+)x$/;
const END_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const END_MARK = '🔚';

/** The rule in the text after `🔁`, or null when the plugin can't repeat it. */
export function readRule(text: string): RepeatRule | null {
	const found = RULE_PATTERN.exec(text.trim().toLowerCase());
	if (!found) return null;
	const [, count, unit, onLast, whenDone] = found;
	const every = count === undefined ? 1 : Number(count);
	if (every < 1 || (onLast && unit !== 'month')) return null;
	return { every, unit: unit as RepeatUnit, onLast: Boolean(onLast), whenDone: Boolean(whenDone) };
}

/** The rule as it follows `🔁`. */
export function writeRule(rule: RepeatRule): string {
	const count = rule.every === 1 ? '' : ` ${rule.every}`;
	const plural = rule.every === 1 ? '' : 's';
	return `every${count} ${rule.unit}${plural}${rule.onLast ? ' on the last' : ''}${rule.whenDone ? ' when done' : ''}`;
}

/** The end in the text after `🔚`: a real date or a count of at least 1, else null. */
export function readEnd(text: string): RepeatEnd | null {
	const trimmed = text.trim().toLowerCase();
	if (END_DATE_PATTERN.test(trimmed)) return isRealDay(trimmed) ? { kind: 'date', day: trimmed } : null;
	const count = END_COUNT_PATTERN.exec(trimmed);
	if (!count || Number(count[1]) < 1) return null;
	return { kind: 'times', left: Number(count[1]) };
}

/** The end with its `🔚`. */
export function writeEnd(end: RepeatEnd): string {
	return `${END_MARK} ${end.kind === 'date' ? end.day : `${end.left}x`}`;
}

/** `day` moved by `days` calendar days, counted in UTC so a clock change can't shift it. */
export function addDays(day: string, days: number): string {
	return new Date(utcOf(day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** One step of `rule` from `day`; a month shorter than the day takes its own last day. */
export function stepDay(day: string, rule: RepeatRule): string {
	if (rule.unit === 'day') return addDays(day, rule.every);
	if (rule.unit === 'week') return addDays(day, 7 * rule.every);
	const months = rule.unit === 'year' ? 12 * rule.every : rule.every;
	const parsed = new Date(utcOf(day));
	const year = parsed.getUTCFullYear();
	const monthIndex = parsed.getUTCMonth();
	const date = parsed.getUTCDate();
	const lastOfOwnMonth = lastDayOfMonth(year, monthIndex);
	if (rule.onLast && date < lastOfOwnMonth) return formatDay(year, monthIndex, lastOfOwnMonth);
	const target = year * 12 + monthIndex + months;
	const targetYear = Math.floor(target / 12);
	const targetMonth = target % 12;
	const lastOfTarget = lastDayOfMonth(targetYear, targetMonth);
	return formatDay(targetYear, targetMonth, rule.onLast ? lastOfTarget : Math.min(date, lastOfTarget));
}

/**
 * The date a tick gives. `when done` steps once from `today`. Otherwise it steps from `anchor`, and
 * again while the result is today or earlier, so a missed item lands on its first date after today.
 */
export function nextDay(anchor: string, rule: RepeatRule, today: string): string {
	if (rule.whenDone) return stepDay(today, rule);
	let next = stepDay(anchor, rule);
	while (daysFrom(today, next) <= 0) next = stepDay(next, rule);
	return next;
}

/**
 * The dates the next `count` ticks give, from `today` when there is no anchor, and stopping at the
 * end. A `times` end counts the current time, so `Nx` leaves N - 1 dates.
 */
export function upcomingDays(
	anchor: string | null,
	rule: RepeatRule,
	end: RepeatEnd | null,
	today: string,
	count: number,
): string[] {
	const limit = end?.kind === 'times' ? Math.min(count, end.left - 1) : count;
	const days: string[] = [];
	let next = anchor === null ? stepDay(today, rule) : nextDay(anchor, rule, today);
	while (days.length < limit && !(end?.kind === 'date' && next > end.day)) {
		days.push(next);
		next = stepDay(next, rule);
	}
	return days;
}

function lastDayOfMonth(year: number, monthIndex: number): number {
	return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function formatDay(year: number, monthIndex: number, date: number): string {
	return new Date(Date.UTC(year, monthIndex, date)).toISOString().slice(0, 10);
}
