import { endOf, findRunStart, joinItemLine, parseItemLine, splitTail, tailFields, tickLine, TASKS_SIGNIFIERS } from './item-line';
import { addDays, nextDay, readEnd, readRule, stepDay, writeEnd, writeRule, type RepeatEnd, type RepeatRule } from './repeat';
import { dayOf, daysFrom, isRealDay, setWhen } from './when';

export type RepeatProblem = 'rule' | 'end' | 'date';

/** A repeating line, read as it is written: what its rule and end say and the first thing that stops it repeating. */
export interface LineRepeat {
	/** The text after `🔁`. */
	ruleText: string;
	rule: RepeatRule | null;
	end: RepeatEnd | null;
	problem: RepeatProblem | null;
}

/** What the repeat popover starts from: the rule and end a line reads as. */
export interface RepeatDraft {
	rule: RepeatRule;
	end: RepeatEnd | null;
}

export type RepeatTick = { kind: 'moved'; line: string; next: string } | { kind: 'ended'; line: string };

const MESSAGES: Record<RepeatProblem, string> = {
	rule: "This item repeats in a way PrinceLists can't follow, so it isn't ticked.",
	end: "This item's 🔚 end can't be read, so it isn't ticked.",
	date: "This item has a date that doesn't exist, so it isn't ticked.",
};

export class RepeatingItemError extends Error {
	constructor(readonly problem: RepeatProblem) {
		super(MESSAGES[problem]);
		this.name = 'RepeatingItemError';
	}
}

const REPEAT_MARK = '🔁';
const END_MARK = '🔚';
const EVERY_DAY: RepeatRule = { every: 1, unit: 'day', onLast: false, whenDone: false };
const REPEAT_PREFIX = /^🔁️?/;
const END_PREFIX = /^ +🔚️? */;
const DAY_LENGTH = '2026-11-13'.length;
// Due, scheduled, then start: Tasks' order. Each kind reads as one, as `whenOf` reads ⏳ and ⌛.
const ANCHOR_KINDS = [['📅', '📆', '🗓'], ['⏳', '⌛'], ['🛫']];
// A date field ends where `when.ts`'s ends one: at whitespace, the end of the fields or the next field's emoji.
const DATE_FIELD = new RegExp(
	`(📅|📆|🗓|⏳|⌛|🛫)️? *(\\d{4}-\\d{2}-\\d{2})(?=(?:\\s|$|${TASKS_SIGNIFIERS.join('|')}))`,
	'g',
);

type ItemParts = NonNullable<ReturnType<typeof parseItemLine>>;

interface DateField {
	mark: string;
	day: string;
	/** Where the field's digits start in the text it was read from. */
	digitsAt: number;
}

/** What the line's `🔁` and `🔚` say, or null when the line doesn't repeat. */
export function repeatOf(line: string): LineRepeat | null {
	const parts = parseItemLine(line);
	if (!parts) return null;
	const { fields } = splitTail(parts.tail);
	const span = repeatSpan(fields);
	if (!span) return null;
	const ruleText = fields.slice(span.from, span.to).replace(REPEAT_PREFIX, '').trim();
	const rule = readRule(ruleText);
	const end = parts.end === '' ? null : readEnd(parts.end.replace(END_PREFIX, ''));
	return { ruleText, rule, end, problem: problemOf(parts.title, parts.end, rule, end, fields) };
}

/** The day a tick moves from: the earliest due date, else the earliest scheduled, else the earliest start; null when none is a real day. */
export function anchorOf(line: string): string | null {
	const parts = parseItemLine(line);
	if (!parts) return null;
	const real = dateFieldsIn(splitTail(parts.tail).fields).filter((field) => isRealDay(field.day));
	for (const marks of ANCHOR_KINDS) {
		const days = real.filter((field) => marks.includes(field.mark)).map((field) => field.day).sort();
		if (days[0] !== undefined) return days[0];
	}
	return null;
}

/** Whether the line has a start, scheduled or due field with a date, real or not. */
export function hasDate(line: string): boolean {
	const parts = parseItemLine(line);
	return parts !== null && dateFieldsIn(splitTail(parts.tail).fields).length > 0;
}

/**
 * The line a tick of a repeating, open item gives: its dates moved to the next one and a count
 * down by one, or, when that was the last, an ordinary tick. Throws RepeatingItemError when the
 * line can't repeat or its next date is past 9999-12-31.
 */
export function tickRepeating(line: string, now: Date): RepeatTick {
	const parts = parseItemLine(line);
	const repeat = repeatOf(line);
	if (!parts || !repeat) throw new Error(`Not a repeating item: ${line}`);
	const { rule, end } = repeat;
	if (repeat.problem !== null || rule === null) throw new RepeatingItemError(repeat.problem ?? 'rule');

	const today = dayOf(now);
	const anchor = anchorOf(line);
	const next = anchor === null ? stepDay(today, rule) : nextDay(anchor, rule, today);
	if (next === null) throw new RepeatingItemError('date');
	if (isLastTime(end, next)) return { kind: 'ended', line: tickLine(line, now) };

	const counted = { ...parts, end: countDown(parts.end, end) };
	if (anchor === null) return { kind: 'moved', line: setWhen(joinItemLine(counted), next), next };
	const { fields, end: afterFields } = splitTail(parts.tail);
	const moved = moveDates(fields, daysFrom(anchor, next));
	if (moved === null) throw new RepeatingItemError('date');
	return { kind: 'moved', line: joinItemLine({ ...counted, tail: moved + afterFields }), next };
}

/**
 * What the repeat popover shows for `line`: its rule and end, or every day for a line that doesn't
 * repeat, with its end taken from a `🔚` the title ends in that reads as one. 'read-only' for a rule
 * or end the plugin can't read, which the popover only shows and can remove.
 */
export function draftOf(line: string): RepeatDraft | 'read-only' {
	const repeat = repeatOf(line);
	if (repeat) {
		if (repeat.problem === 'rule' || repeat.problem === 'end' || repeat.rule === null) return 'read-only';
		return { rule: repeat.rule, end: repeat.end };
	}
	const parts = parseItemLine(line);
	const endText = parts ? endOf(parts.title) : '';
	return { rule: EVERY_DAY, end: endText === '' ? null : readEnd(endText.replace(END_PREFIX, '')) };
}

/**
 * The line repeating by `rule` and ending as `end` says, or never for null. A line with no date gets
 * a `⏳` on `today`; an existing `🔁` and `🔚` are replaced in place.
 */
export function setRepeat(line: string, rule: RepeatRule, end: RepeatEnd | null, today: string): string {
	if (!parseItemLine(line)) return line;
	const dated = hasDate(line) ? line : setWhen(line, today);
	const parts = parseItemLine(dated) as ItemParts;
	const { fields, end: afterFields } = splitTail(parts.tail);
	const field = `${REPEAT_MARK} ${writeRule(rule)}`;
	const span = repeatSpan(fields);
	const repeatedBefore = span !== undefined;
	const changed = span
		? fields.slice(0, span.from) + field + fields.slice(span.to)
		: `${fields} ${field}`;
	// Reading again lets a `🔚` that sat in the title count as the end now that the line repeats.
	const repeating = parseItemLine(joinItemLine({ ...parts, tail: changed + afterFields })) as ItemParts;
	// A title `🔚` that is no end was title text before the line repeated, and stays so.
	const kept = !repeatedBefore && repeating.end !== '' && readEnd(repeating.end.replace(END_PREFIX, '')) === null ? repeating.end : '';
	const newEnd = kept + (end === null ? '' : ` ${writeEnd(end)}`);
	// An end after an empty title leaves the tail's first field touching it.
	const needsSpace = repeating.title + newEnd + repeating.marks !== '' && !/^\s/.test(repeating.tail);
	return joinItemLine({ ...repeating, end: newEnd, tail: needsSpace ? ` ${repeating.tail}` : repeating.tail });
}

/** The line without its `🔁` and `🔚`, each with the spaces before it. */
export function removeRepeat(line: string): string {
	const parts = parseItemLine(line);
	if (!parts) return line;
	const { fields, end: afterFields } = splitTail(parts.tail);
	const span = repeatSpan(fields);
	if (!span) return line;
	const runStart = findRunStart(fields, span.from, (char) => /\s/.test(char));
	const spaceEnd = span.to + fields.slice(span.to).search(/\S|$/);
	const isGlued = spaceEnd === span.to && span.to < fields.length;
	const startsLine = runStart === 0 && parts.title + parts.marks === '';
	const kept = isGlued
		? fields.slice(0, span.from) + fields.slice(span.to)
		: fields.slice(0, runStart) + fields.slice(startsLine ? spaceEnd : span.to);
	return joinItemLine({ ...parts, end: '', tail: kept + afterFields });
}

/** The line without its `⏳` and `⌛` dates, and without its repeat when that leaves it no date to repeat from. */
export function removeWhen(line: string): { line: string; repeatRemoved: boolean } {
	const withoutWhen = setWhen(line, null);
	if (repeatOf(withoutWhen) === null || hasDate(withoutWhen)) return { line: withoutWhen, repeatRemoved: false };
	return { line: removeRepeat(withoutWhen), repeatRemoved: true };
}

function repeatSpan(fields: string): { from: number; to: number } | undefined {
	return tailFields(fields).find(({ from }) => fields.startsWith(REPEAT_MARK, from));
}

function dateFieldsIn(fields: string): DateField[] {
	return [...fields.matchAll(DATE_FIELD)].map((found) => ({
		mark: found[1] as string,
		day: found[2] as string,
		digitsAt: found.index + found[0].length - DAY_LENGTH,
	}));
}

function problemOf(title: string, endText: string, rule: RepeatRule | null, end: RepeatEnd | null, fields: string): RepeatProblem | null {
	if (rule === null) return 'rule';
	if ((endText !== '' && end === null) || title.includes(END_MARK)) return 'end';
	if (dateFieldsIn(fields).some((field) => !isRealDay(field.day))) return 'date';
	return null;
}

function isLastTime(end: RepeatEnd | null, next: string): boolean {
	if (end === null) return false;
	return end.kind === 'times' ? end.left === 1 : next > end.day;
}

// Only the digits change, so the count's spelling and spacing stay as written.
function countDown(endText: string, end: RepeatEnd | null): string {
	if (end?.kind !== 'times') return endText;
	return endText.replace(/\d+(?=x\s*$)/i, String(end.left - 1));
}

/** The fields with each date field's day moved by `days`, or null when one passes 9999-12-31. */
function moveDates(fields: string, days: number): string | null {
	let moved = '';
	let copied = 0;
	for (const { day, digitsAt } of dateFieldsIn(fields)) {
		const shifted = addDays(day, days);
		if (shifted === null) return null;
		moved += fields.slice(copied, digitsAt) + shifted;
		copied = digitsAt + DAY_LENGTH;
	}
	return moved + fields.slice(copied);
}
