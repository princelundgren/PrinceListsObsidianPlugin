export interface ItemLineParts {
	/** Up to and including the `[`, e.g. `- [` or `12. [`. */
	before: string;
	/** One character. */
	status: string;
	/** `] `. */
	afterStatus: string;
	title: string;
	/** The run of ✔ fields right before the tail, with its leading space, or ''. */
	marks: string;
	/** Trailing Tasks fields, #tags, block ID and trailing whitespace, verbatim, or ''. */
	tail: string;
}

export const TASKS_SIGNIFIERS = [
	...['🔺', '⏫', '🔼', '🔽', '⏬'],
	...['🛫', '➕', '⏳', '⌛', '📅', '📆', '🗓', '✅', '❌'],
	...['🔁', '🏁', '🆔', '⛔'],
] as const;

// Ported from obsidian-tasks (MIT license), src/TaskSerializer/DefaultTaskSerializer.ts at tag
// 8.6.0 (d37646b, identical to main at fa04fc1): the value format of each signifier, and the
// optional U+FE0F that Tasks accepts after every one of them. Like Tasks, each pattern is
// anchored to the end of the line so fields can be peeled off from the right, and none has the
// `u` flag: Tasks removed it in fieldRegex "to fix parsing on iPadOS/iOS 18.6 and 26 Public
// Beta 2".
const VS16 = '\\uFE0F?';
const ID = '[a-zA-Z0-9\\-_]+';
const TRAILING_FIELDS = [
	`(?:🔺|⏫|🔼|🔽|⏬)${VS16}$`,
	`(?:🛫|➕|⏳|⌛|📅|📆|🗓|✅|❌)${VS16} *\\d{4}-\\d{2}-\\d{2}$`,
	`🔁${VS16} *[a-zA-Z0-9, !]+$`,
	`🏁${VS16} *[a-zA-Z]+$`,
	// Tasks' taskIdSequenceRegex also allows spaces after each id, which backtracks exponentially
	// on a long line. The body is trimmed first, so this accepts the same lines.
	`⛔${VS16} *${ID}(?: *, *${ID})*$`,
	`🆔${VS16} *${ID}$`,
	// Tasks' hashTagsFromEnd: a tag may follow any field, so tags and fields can interleave.
	'(?:^|\\s)#[^ !@#$%^&*(),.?":{}|<>]+$',
].map((source) => new RegExp(source));

const ITEM_PATTERN = /^(\s*(?:[-*+]|\d+[.)])[ \t]+\[)([^\]])(\] )(.*)$/;
const BLOCK_ID_PATTERN = / \^[A-Za-z0-9-]+$/;
const MARK_SOURCE = `✔${VS16} +\\d{4}-\\d{2}-\\d{2}(?: \\d{2}:\\d{2})?`;
export const MARK_PATTERN = new RegExp(MARK_SOURCE);
const MARKS_PATTERN = new RegExp(`(?: +${MARK_SOURCE})+$`);
const ONE_MARK_PATTERN = new RegExp(MARK_SOURCE, 'g');
const MARK_TIME_PATTERN = new RegExp(
	`^(?:✔${VS16} +(\\d{4})-(\\d{2})-(\\d{2})(?: (\\d{2}):(\\d{2}))?|✅${VS16} *(\\d{4})-(\\d{2})-(\\d{2}))$`,
);
export const DONE_DATE_PATTERN = new RegExp(` *✅${VS16} *\\d{4}-\\d{2}-\\d{2}`);
const DONE_DATE_FIELD = new RegExp(DONE_DATE_PATTERN, 'g');
const REPEAT_FIELD = new RegExp(`🔁${VS16} *[a-zA-Z0-9, !]+`);

export function parseItemLine(text: string): ItemLineParts | null {
	const match = ITEM_PATTERN.exec(text);
	if (!match) return null;
	const [, before = '', status = '', afterStatus = '', rest = ''] = match;

	// Tasks trims the whole line before it strips the block link, so trailing whitespace must not
	// hide a field, a block ID or a mark.
	const trimmed = rest.trimEnd();
	const trailing = rest.slice(trimmed.length);
	const blockId = BLOCK_ID_PATTERN.exec(trimmed)?.[0] ?? '';
	const body = trimmed.slice(0, trimmed.length - blockId.length);

	// Whitespace between fields is skipped while matching, as Tasks does after each field.
	let fieldsStart = body.length;
	for (let matched = true; matched; ) {
		const visible = body.slice(0, fieldsStart).trimEnd();
		matched = false;
		for (const pattern of TRAILING_FIELDS) {
			const found = pattern.exec(visible);
			if (found) {
				fieldsStart = found.index;
				matched = true;
				break;
			}
		}
	}

	let tailStart = fieldsStart;
	while (tailStart > 0 && /\s/.test(body.charAt(tailStart - 1))) tailStart--;
	const head = body.slice(0, tailStart);
	const marks = MARKS_PATTERN.exec(head)?.[0] ?? '';
	return {
		before,
		status,
		afterStatus,
		title: head.slice(0, head.length - marks.length),
		marks,
		tail: body.slice(tailStart) + blockId + trailing,
	};
}

export function joinItemLine(p: ItemLineParts): string {
	return p.before + p.status + p.afterStatus + p.title + p.marks + p.tail;
}

export function isDoneStatus(status: string): boolean {
	return status !== ' ';
}

export function formatStamp(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `✔ ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function tickLine(text: string, now: Date): string {
	const parts = parseItemLine(text);
	if (!parts) return text;
	// A hand-typed ✔ after the Tasks fields reads as a mark and leaves the fields in the title;
	// that heals on untick.
	const marks = ` ${formatStamp(now)}`;
	return joinItemLine({ ...parts, status: 'x', marks, tail: spaced(parts.title + marks, parts.tail) });
}

export function untickLine(text: string): string {
	const parts = parseItemLine(text);
	if (!parts) return text;
	// Tasks' own untick removes its ✅ as well, so ours does too.
	return joinItemLine({ ...parts, status: ' ', marks: '', tail: parts.tail.replace(DONE_DATE_FIELD, '') });
}

export function setTitle(text: string, title: string): string {
	const parts = parseItemLine(text);
	if (!parts) return text;
	const marks = isDoneStatus(parts.status) ? collapseMarks(parts.marks) : '';
	return joinItemLine({ ...parts, title, marks, tail: spaced(title + marks, parts.tail) });
}

export function isRepeating(text: string): boolean {
	const parts = parseItemLine(text);
	return parts !== null && REPEAT_FIELD.test(parts.tail);
}

// Tasks needs no space before an emoji, so a tail can start without one. Once something stands
// before it, a gap keeps the first field from running into the title or the mark.
function spaced(head: string, tail: string): string {
	return head !== '' && tail !== '' && !/^\s/.test(tail) ? ` ${tail}` : tail;
}

// The time a ✔ or ✅ mark counts as done: its own time, or the end of its day when it has none.
// null when the date or time doesn't exist (month 13, 25:99).
export function markTime(mark: string): Date | null {
	const m = MARK_TIME_PATTERN.exec(mark);
	if (!m) return null;
	const [y, mo, d, h, mi] = (m[1] ? [m[1], m[2], m[3], m[4], m[5]] : [m[6], m[7], m[8]]).map(
		(n) => (n === undefined ? undefined : Number(n)),
	) as [number, number, number, number | undefined, number | undefined];
	const date =
		h === undefined || mi === undefined
			? new Date(y, mo - 1, d, 23, 59, 59, 999)
			: new Date(y, mo - 1, d, h, mi);
	const exists =
		date.getFullYear() === y &&
		date.getMonth() === mo - 1 &&
		date.getDate() === d &&
		(h === undefined || (date.getHours() === h && date.getMinutes() === mi));
	return exists ? date : null;
}

function collapseMarks(marks: string): string {
	const found = [...marks.matchAll(ONE_MARK_PATTERN)].map((m) => m[0]);
	if (found.length < 2) return marks;
	let earliest = found[0] as string;
	let earliestTime = markTime(earliest);
	for (const mark of found.slice(1)) {
		const time = markTime(mark);
		if (time && (!earliestTime || time < earliestTime)) {
			earliest = mark;
			earliestTime = time;
		}
	}
	return ` ${earliest}`;
}
