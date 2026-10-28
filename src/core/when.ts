import { BLOCK_ID_PATTERN, findRunStart, joinItemLine, parseItemLine, TASKS_SIGNIFIERS } from './item-line';

export type DayLabelKind = 'today' | 'tomorrow' | 'weekday' | 'date';

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
		const isFirst = (parts.title + parts.marks + changed).length === 0;
		changed += `${isFirst ? '' : ' '}${WHEN} ${day}`;
	}
	return joinItemLine({ ...parts, tail: changed + end });
}

export function dayOf(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function daysFrom(today: string, day: string): number {
	return Math.round((utcOf(day) - utcOf(today)) / DAY_MS);
}

export function dayLabelKind(day: string, today: string): DayLabelKind {
	const days = daysFrom(today, day);
	if (days === 0) return 'today';
	if (days === 1) return 'tomorrow';
	return days >= 2 && days <= 6 ? 'weekday' : 'date';
}

// The tail's fields and tags, and the block ID and trailing whitespace after them.
function splitTail(tail: string): { fields: string; end: string } {
	const trimmed = tail.trimEnd();
	const blockId = BLOCK_ID_PATTERN.exec(trimmed)?.[0] ?? '';
	const fields = trimmed.slice(0, trimmed.length - blockId.length);
	return { fields, end: tail.slice(fields.length) };
}

function utcOf(day: string): number {
	const [, year, month, date] = DAY_PATTERN.exec(day) ?? [];
	return Date.UTC(Number(year), Number(month) - 1, Number(date));
}

function isRealDay(day: string): boolean {
	return new Date(utcOf(day)).toISOString().startsWith(day);
}
