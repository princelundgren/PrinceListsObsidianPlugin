import { findRunStart, joinItemLine, parseItemLine, splitTail, TASKS_SIGNIFIERS } from './item-line';

export type DayLabelKind = 'today' | 'tomorrow' | 'weekday' | 'date-this-year' | 'date';

const WHEN = '⏳';
// Tasks reads both ⏳ and ⌛ as the scheduled date. A field ends at whitespace, the end of the
// fields, or the next field's emoji, which Tasks needs no space before.
const NEXT_FIELD = TASKS_SIGNIFIERS.join('|');
const SCHEDULED_FIELD = new RegExp(`(?:⏳|⌛)\uFE0F? *(\\d{4})-(\\d{2})-(\\d{2})(?=(\\s|$|${NEXT_FIELD}))`, 'g');
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function whenOf(line: string): string | null {
	const parts = parseItemLine(line);
	if (!parts) return null;
	let earliest: string | null = null;
	for (const [, year, month, day] of splitTail(parts.tail).fields.matchAll(SCHEDULED_FIELD)) {
		const found = `${year}-${month}-${day}`;
		if (isRealDay(found) && (earliest === null || found < earliest)) earliest = found;
	}
	return earliest;
}

export function setWhen(line: string, day: string | null): string {
	const parts = parseItemLine(line);
	if (!parts) return line;
	const { fields, end } = splitTail(parts.tail);
	let replaced = false;
	let changed = '';
	let copied = 0;
	for (const field of fields.matchAll(SCHEDULED_FIELD)) {
		const spaceStart = findRunStart(fields, field.index, (char) => /\s/.test(char));
		const space = fields.slice(spaceStart, field.index);
		changed += fields.slice(copied, spaceStart);
		copied = field.index + field[0].length;
		// A field glued to the next keeps its space, so the next isn't glued to what came before.
		if (replaced || day === null) {
			changed += (field[4] ?? '').trim() === '' ? '' : space;
		} else {
			replaced = true;
			changed += `${space}${WHEN} ${day}`;
		}
	}
	changed += fields.slice(copied);
	if (day !== null && !replaced) {
		const isFirst = (parts.title + parts.end + parts.marks + changed).length === 0;
		changed += `${isFirst ? '' : ' '}${WHEN} ${day}`;
	}
	return joinItemLine({ ...parts, tail: changed + end });
}

export function dayOf(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The local calendar day after `date`'s, as `YYYY-MM-DD`; a day isn't always 24 hours. */
export function dayAfter(date: Date): string {
	return dayOf(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1));
}

export function daysFrom(today: string, day: string): number {
	return Math.round((utcOf(day) - utcOf(today)) / DAY_MS);
}

export function dayLabelKind(day: string, today: string): DayLabelKind {
	const days = daysFrom(today, day);
	if (days === 0) return 'today';
	if (days === 1) return 'tomorrow';
	if (days >= 2 && days <= 6) return 'weekday';
	return day.slice(0, 4) === today.slice(0, 4) ? 'date-this-year' : 'date';
}

const LABEL_FORMATS: Record<Exclude<DayLabelKind, 'today' | 'tomorrow'>, Intl.DateTimeFormatOptions> = {
	weekday: { weekday: 'long' },
	'date-this-year': { month: 'short', day: 'numeric' },
	date: { year: 'numeric', month: 'short', day: 'numeric' },
};

/** A row's short day, "Today", "Tomorrow", a weekday or a date, with weekdays and dates in `language`. */
export function dayLabel(day: string, today: string, language: string): string {
	const kind = dayLabelKind(day, today);
	if (kind === 'today') return 'Today';
	if (kind === 'tomorrow') return 'Tomorrow';
	return new Intl.DateTimeFormat(language, { ...LABEL_FORMATS[kind], timeZone: 'UTC' }).format(utcOf(day));
}

/** The notice after a repeating item moved to `day`, such as "Next: Tue 17 Nov.", in `language`. */
export function nextDayMessage(day: string, language: string): string {
	const label = new Intl.DateTimeFormat(language, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(utcOf(day));
	return `Next: ${label}.`;
}

export function utcOf(day: string): number {
	const [, year, month, date] = DAY_PATTERN.exec(day) ?? [];
	return Date.UTC(Number(year), Number(month) - 1, Number(date));
}

export function isRealDay(day: string): boolean {
	return new Date(utcOf(day)).toISOString().startsWith(day);
}
