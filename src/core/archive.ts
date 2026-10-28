import { DONE_DATE_PATTERN, MARK_PATTERN, isDoneStatus, markTime, parseItemLine } from './item-line';

export const ARCHIVE_DELAY_MS = 86_400_000;

export type DoneAt = { kind: 'at'; time: Date } | { kind: 'longAgo' };

const EVERY_MARK = new RegExp(MARK_PATTERN, 'g');
const EVERY_DONE_DATE = new RegExp(DONE_DATE_PATTERN, 'g');

// null for an open line or a line that isn't a task. A mark counts only when it is readable and no
// more than a day ahead of `now`; the earliest such mark wins (design: "Several marks on one line").
export function doneAt(text: string, now: Date): DoneAt | null {
	const parts = parseItemLine(text);
	if (!parts || !isDoneStatus(parts.status)) return null;

	const marks = [...parts.marks.matchAll(EVERY_MARK), ...parts.tail.matchAll(EVERY_DONE_DATE)].map((m) => m[0]);
	const latestReadable = now.getTime() + ARCHIVE_DELAY_MS;
	let earliest: Date | null = null;
	for (const mark of marks) {
		const time = markTime(mark);
		if (!time || time.getTime() > latestReadable) continue;
		if (!earliest || time < earliest) earliest = time;
	}
	return earliest ? { kind: 'at', time: earliest } : { kind: 'longAgo' };
}

export function isArchived(text: string, now: Date): boolean {
	const done = doneAt(text, now);
	if (!done) return false;
	return done.kind === 'longAgo' || now.getTime() - done.time.getTime() >= ARCHIVE_DELAY_MS;
}
