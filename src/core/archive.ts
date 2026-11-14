import { DONE_DATE_PATTERN, MARK_PATTERN, isDoneStatus, markTime, parseItemLine } from './item-line';

const HOUR_MS = 3_600_000;

/** The archive delays the settings offer, in hours, as the dropdown stores them. */
export const ARCHIVE_DELAY_HOURS = ['0', '1', '12', '24', '48', '168'] as const;
export type ArchiveDelayHours = (typeof ARCHIVE_DELAY_HOURS)[number];
export const DEFAULT_ARCHIVE_DELAY_HOURS: ArchiveDelayHours = '24';

// A mark further ahead of `now` than this can't be a real tick, so its line counts as done long ago.
const LATEST_MARK_AHEAD_MS = 24 * HOUR_MS;

/** A stored setting as one of the choices: the default when it is none of them. */
export function archiveDelayHoursOf(stored: unknown): ArchiveDelayHours {
	return ARCHIVE_DELAY_HOURS.find((hours) => hours === stored) ?? DEFAULT_ARCHIVE_DELAY_HOURS;
}

/** The delay a choice stands for, in milliseconds. */
export function archiveDelayMs(hours: ArchiveDelayHours): number {
	return Number(hours) * HOUR_MS;
}

export type DoneAt = { kind: 'at'; time: Date } | { kind: 'longAgo' };

const EVERY_MARK = new RegExp(MARK_PATTERN, 'g');
const EVERY_DONE_DATE = new RegExp(DONE_DATE_PATTERN, 'g');

// null for an open line or a line that isn't a task. A mark counts only when it is readable and no
// more than a day ahead of `now`; the earliest such mark wins (design: "Several marks on one line").
export function doneAt(text: string, now: Date): DoneAt | null {
	const parts = parseItemLine(text);
	if (!parts || !isDoneStatus(parts.status)) return null;

	return earliestCounting([...parts.marks.matchAll(EVERY_MARK), ...parts.tail.matchAll(EVERY_DONE_DATE)], now);
}

/** As `doneAt`, but from the line's `✔` marks only, so a `✅` left from an earlier completion isn't the tick. */
export function tickedAt(text: string, now: Date): DoneAt | null {
	const parts = parseItemLine(text);
	if (!parts || !isDoneStatus(parts.status)) return null;
	return earliestCounting(parts.marks.matchAll(EVERY_MARK), now);
}

function earliestCounting(found: Iterable<RegExpMatchArray>, now: Date): DoneAt {
	const latestReadable = now.getTime() + LATEST_MARK_AHEAD_MS;
	let earliest: Date | null = null;
	for (const [mark] of found) {
		const time = markTime(mark);
		if (!time || time.getTime() > latestReadable) continue;
		if (!earliest || time < earliest) earliest = time;
	}
	return earliest ? { kind: 'at', time: earliest } : { kind: 'longAgo' };
}

/** Whether a done line is hidden at `now`: `delayMs` or more after its tick, or done long ago. */
export function isArchived(text: string, now: Date, delayMs: number): boolean {
	const done = doneAt(text, now);
	if (!done) return false;
	return done.kind === 'longAgo' || now.getTime() - done.time.getTime() >= delayMs;
}
