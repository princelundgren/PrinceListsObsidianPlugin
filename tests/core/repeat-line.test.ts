import { describe, expect, test } from 'vitest';
import { tickLine, untickLine } from '../../src/core/item-line';
import {
	anchorOf,
	canWrite,
	draftOf,
	hasDate,
	removeRepeat,
	removeWhen,
	repeatOf,
	RepeatingItemError,
	setRepeat,
	tickRepeating,
	type RepeatProblem,
} from '../../src/core/repeat-line';
import type { RepeatDraft } from '../../src/core/repeat-line';
import type { RepeatRule } from '../../src/core/repeat';

const now = new Date(2026, 10, 13, 9, 0);
const VS16 = '️';
const every = (n: number, unit: RepeatRule['unit']): RepeatRule => ({ every: n, unit, onLast: false, whenDone: false });

describe('repeatOf', () => {
	test.each([
		"- [ ] fix the 🔁 icon's color",
		'- [ ] fix the 🔁 bug.',
		'- [ ] plain',
		'- bullet',
	])('is null for %s', (line) => {
		expect(repeatOf(line)).toBeNull();
	});

	test.each<[string, RepeatProblem]>([
		['- [ ] a 🔁 every weekday', 'rule'],
		['- [ ] fix the 🔁 every day bug', 'rule'],
		['- [ ] a 🔚 soon ⏳ 2026-11-13 🔁 every day', 'end'],
		['- [ ] a 🔚 0x ⏳ 2026-11-13 🔁 every day', 'end'],
		['- [ ] Trip 🔚 next spring ⏳ 2026-11-13 🔁 every day', 'end'],
		['- [ ] a ⏳ 2026-02-30 🔁 every day', 'date'],
		['- [ ] a 📅 2026-11-20 ⏳ 2026-02-30 🔁 every day', 'date'],
	])('names the problem of %s', (line, problem) => {
		expect(repeatOf(line)?.problem).toBe(problem);
	});

	test('reads the rule, its text and the end of a good line', () => {
		expect(repeatOf('- [ ] a 🔚 2026-12-31 ⏳ 2026-11-13 🔁 every 2 weeks')).toEqual({
			ruleText: 'every 2 weeks',
			rule: every(2, 'week'),
			end: { kind: 'date', day: '2026-12-31' },
			problem: null,
		});
	});

	test('reads a rule after 🔁 with U+FE0F', () => {
		expect(repeatOf(`- [ ] a ⏳ 2026-11-13 🔁${VS16} Every Day`)?.rule).toEqual(every(1, 'day'));
	});
});

describe('anchorOf', () => {
	test.each([
		['- [ ] a 🛫 2026-11-01 ⏳ 2026-11-05 📅 2026-11-09', '2026-11-09'],
		['- [ ] a 🛫 2026-11-01 ⏳ 2026-11-05', '2026-11-05'],
		['- [ ] a 🛫 2026-11-01', '2026-11-01'],
		['- [ ] a ⌛ 2026-11-05 🗓 2026-11-09', '2026-11-09'],
		['- [ ] a 📆 2026-11-09', '2026-11-09'],
		['- [ ] a ⏳ 2026-11-08 ⏳ 2026-11-05', '2026-11-05'],
		['- [ ] a 📅 2026-11-20 📅 2026-11-09', '2026-11-09'],
		['- [ ] a ➕ 2026-11-01', null],
	])('%s', (line, anchor) => {
		expect(anchorOf(line)).toBe(anchor);
	});
});

describe('hasDate', () => {
	test.each([
		['- [ ] a 📅 2026-11-20', true],
		['- [ ] a ➕ 2026-11-01', false],
	])('%s', (line, expected) => {
		expect(hasDate(line)).toBe(expected);
	});
});

describe('tickRepeating', () => {
	test.each([
		['- [ ] Water ⏳ 2026-11-10 🔁 every 3 days', '- [ ] Water ⏳ 2026-11-16 🔁 every 3 days', '2026-11-16'],
		[
			'- [ ] Rent ➕ 2026-11-01 🛫 2026-11-25 ⏳ 2026-11-28 📅 2026-12-01 🔁 every month',
			'- [ ] Rent ➕ 2026-11-01 🛫 2026-12-26 ⏳ 2026-12-29 📅 2027-01-01 🔁 every month',
			'2027-01-01',
		],
		[
			`- [ ] a ✅ 2026-11-05 ⏳${VS16} 2026-11-13 🔁${VS16} every week`,
			`- [ ] a ✅ 2026-11-05 ⏳${VS16} 2026-11-20 🔁${VS16} every week`,
			'2026-11-20',
		],
		['- [ ] Stretch 🔁 every day', '- [ ] Stretch 🔁 every day ⏳ 2026-11-14', '2026-11-14'],
		['- [ ] a ⏳ 2026-11-13 🔁 every day #x ^id', '- [ ] a ⏳ 2026-11-14 🔁 every day #x ^id', '2026-11-14'],
	])('moves %s', (line, expected, next) => {
		expect(tickRepeating(line, now)).toEqual({ kind: 'moved', line: expected, next });
	});

	test.each([
		['- [ ] a 🔚 3x ⏳ 2026-11-13 🔁 every day', '- [ ] a 🔚 2x ⏳ 2026-11-14 🔁 every day'],
		['- [ ] a ⭐ 🔚 3x ⏳ 2026-11-01 🔁 every day', '- [ ] a ⭐ 🔚 2x ⏳ 2026-11-14 🔁 every day'],
		['- [ ] a 🔚 2026-12-31 ⏳ 2026-11-13 🔁 every day', '- [ ] a 🔚 2026-12-31 ⏳ 2026-11-14 🔁 every day'],
		['- [ ] a 🔚 2026-11-14 ⏳ 2026-11-13 🔁 every day', '- [ ] a 🔚 2026-11-14 ⏳ 2026-11-14 🔁 every day'],
	])('keeps the end of %s counting or fixed', (line, expected) => {
		expect(tickRepeating(line, now)).toMatchObject({ kind: 'moved', line: expected });
	});

	test.each([
		[
			'- [ ] Physio 🔚 1x ⏳ 2026-11-13 🔁 every day',
			'- [x] Physio 🔚 1x ✔ 2026-11-13 09:00 ⏳ 2026-11-13 🔁 every day',
		],
		[
			'- [ ] a 🔚 2026-11-15 ⏳ 2026-11-13 🔁 every 3 days',
			'- [x] a 🔚 2026-11-15 ✔ 2026-11-13 09:00 ⏳ 2026-11-13 🔁 every 3 days',
		],
	])('ticks the last time of %s as an ordinary tick', (line, expected) => {
		expect(tickRepeating(line, now)).toEqual({ kind: 'ended', line: expected });
	});

	test('counts a missed item by the local day of the tick', () => {
		const line = '- [ ] Walk ⏳ 2026-11-12 🔁 every day';

		expect(tickRepeating(line, new Date(2026, 10, 13, 23, 59))).toMatchObject({ next: '2026-11-14' });
		expect(tickRepeating(line, new Date(2026, 10, 14, 0, 1))).toMatchObject({ next: '2026-11-15' });
	});

	test.each<[string, RepeatProblem]>([
		['- [ ] a ⏳ 2026-11-13 🔁 every weekday', 'rule'],
		['- [ ] a 🔚 soon ⏳ 2026-11-13 🔁 every day', 'end'],
		['- [ ] a ⏳ 2026-02-30 🔁 every day', 'date'],
		['- [ ] a ⏳ 9999-12-31 🔁 every day', 'date'],
		['- [ ] a 🔚 0x ⏳ 2026-11-13 🔁 every day', 'end'],
		['- [ ] Trip 🔚 next spring ⏳ 2026-11-13 🔁 every day', 'end'],
		['- [ ] a 📅 2026-11-20 ⏳ 2026-02-30 🔁 every day', 'date'],
	])('refuses %s with the problem %s', (line, problem) => {
		expect(() => tickRepeating(line, now)).toThrow(RepeatingItemError);
		expect(() => tickRepeating(line, now)).toThrow(expect.objectContaining({ problem }));
	});

	test('refuses a move that would take another date past 9999-12-31', () => {
		const line = '- [ ] a 🛫 9999-12-31 ⏳ 2026-11-13 🔁 every day';

		expect(() => tickRepeating(line, now)).toThrow(expect.objectContaining({ problem: 'date' }));
	});
});

describe('setRepeat', () => {
	const today = '2026-11-13';

	test.each([
		['- [ ] Water plants', every(3, 'day'), null, '- [ ] Water plants ⏳ 2026-11-13 🔁 every 3 days'],
		[
			'- [ ] Physio ⭐ ⏳ 2026-11-13',
			every(1, 'day'),
			{ kind: 'times', left: 5 },
			'- [ ] Physio ⭐ 🔚 5x ⏳ 2026-11-13 🔁 every day',
		],
		['- [ ] a 📅 2026-11-20', every(1, 'week'), null, '- [ ] a 📅 2026-11-20 🔁 every week'],
		[
			'- [ ] a 🔚 3x ⏳ 2026-11-20 🔁 every day #x ^id',
			every(2, 'week'),
			{ kind: 'date', day: '2027-01-01' },
			'- [ ] a 🔚 2027-01-01 ⏳ 2026-11-20 🔁 every 2 weeks #x ^id',
		],
		['- [ ] a 🔚 3x ⏳ 2026-11-20 🔁 every day', every(1, 'day'), null, '- [ ] a ⏳ 2026-11-20 🔁 every day'],
		['- [ ] Countdown 🔚 5x', every(1, 'day'), { kind: 'times', left: 2 }, '- [ ] Countdown 🔚 2x ⏳ 2026-11-13 🔁 every day'],
	] as const)('%s', (line, rule, end, expected) => {
		expect(setRepeat(line, rule, end, today)).toBe(expected);
	});
});

describe('setRepeat on a line that does not repeat yet', () => {
	const today = '2026-11-13';

	test('keeps a title 🔚 that is no end, as written', () => {
		expect(setRepeat('- [ ] Trip 🔚 soon', every(1, 'day'), null, today)).toBe('- [ ] Trip 🔚 soon ⏳ 2026-11-13 🔁 every day');
	});

	test('keeps it, with the chosen end after it', () => {
		expect(setRepeat('- [ ] Trip 🔚 soon', every(1, 'day'), { kind: 'times', left: 3 }, today)).toBe(
			'- [ ] Trip 🔚 soon 🔚 3x ⏳ 2026-11-13 🔁 every day',
		);
	});
});

describe('draftOf', () => {
	test('reads the rule and the end of a repeating line', () => {
		expect(draftOf('- [ ] Review 🔚 3x ⏳ 2026-11-13 🔁 every 2 weeks when done')).toEqual({
			rule: { every: 2, unit: 'week', onLast: false, whenDone: true },
			end: { kind: 'times', left: 3 },
		});
	});

	test.each(['- [ ] a ⏳ 2026-11-13 🔁 Every Day', '- [ ] a ⏳ 2026-11-13 🔁 every 1 day'])('reads %s as every day', (line) => {
		expect(draftOf(line)).toEqual({ rule: every(1, 'day'), end: null });
	});

	test.each(['- [ ] a ⏳ 2026-11-13 🔁 every weekday', '- [ ] a 🔚 soon ⏳ 2026-11-13 🔁 every day'])('is read-only for %s', (line) => {
		expect(draftOf(line)).toBe('read-only');
	});

	test('is every day with no end on a line that does not repeat', () => {
		expect(draftOf('- [ ] Water plants ⏳ 2026-11-13')).toEqual({ rule: every(1, 'day'), end: null });
	});

	test('takes a readable 🔚 at the end of the title of a line that does not repeat as its end', () => {
		expect(draftOf('- [ ] Countdown 🔚 5x')).toEqual({ rule: every(1, 'day'), end: { kind: 'times', left: 5 } });
	});

	test('leaves a title 🔚 that is no end out of the draft', () => {
		expect(draftOf('- [ ] Trip 🔚 soon')).toEqual({ rule: every(1, 'day'), end: null });
	});
});

describe('canWrite', () => {
	const draft = (rule: Partial<RepeatRule>, end: RepeatDraft['end'] = null): RepeatDraft => ({ rule: { ...every(1, 'day'), ...rule }, end });

	test.each([
		draft({}),
		draft({ every: 9999, unit: 'month', onLast: true }, { kind: 'times', left: 1 }),
		draft({}, { kind: 'date', day: '2026-12-31' }),
	])('accepts %j', (candidate) => {
		expect(canWrite(candidate)).toBe(true);
	});

	test.each([
		draft({ every: 0 }),
		draft({ every: 1.5 }),
		draft({ every: Number.NaN }),
		draft({ every: 10_000 }),
		draft({ unit: 'week', onLast: true }),
		draft({}, { kind: 'times', left: 0 }),
		draft({}, { kind: 'times', left: 2.5 }),
		draft({}, { kind: 'date', day: '' }),
		draft({}, { kind: 'date', day: '2026-02-30' }),
	])('refuses %j', (candidate) => {
		expect(canWrite(candidate)).toBe(false);
	});
});

describe('a line with no title', () => {
	const today = '2026-11-13';

	test.each([
		[null, '- [ ] ⏳ 2026-11-13 🔁 every day'],
		[{ kind: 'times', left: 5 } as const, '- [ ]  🔚 5x ⏳ 2026-11-13 🔁 every day'],
	])('setRepeat with the end %j spaces the fields', (end, expected) => {
		expect(setRepeat('- [ ] ', every(1, 'day'), end, today)).toBe(expected);
	});

	test.each(['- [ ]  🔚 5x 🔁 every day', '- [ ]  🔚 5x ⏳ 2026-11-13 🔁 every day', '- [ ] ⏳ 2026-11-13 🔁 every day'])(
		'%s comes back from a tick and an untick byte for byte',
		(line) => {
			expect(untickLine(tickLine(line, now))).toBe(line);
		},
	);
});

describe('removeRepeat', () => {
	test.each([
		['- [ ] a ⏳ 2026-11-13 🔁 every day', '- [ ] a ⏳ 2026-11-13'],
		['- [ ] a 🔚 5x ⏳ 2026-11-13 🔁 every day #x ^id', '- [ ] a ⏳ 2026-11-13 #x ^id'],
		['- [ ] a 🔁 every day ⏳ 2026-11-13', '- [ ] a ⏳ 2026-11-13'],
		['- [ ] 🔁 every day ⏳ 2026-11-13', '- [ ] ⏳ 2026-11-13'],
		['- [ ] a ⏳ 2026-11-13', '- [ ] a ⏳ 2026-11-13'],
	])('%s', (line, expected) => {
		expect(removeRepeat(line)).toBe(expected);
	});
});

describe('removeWhen', () => {
	test('takes the repeat with the last date', () => {
		expect(removeWhen('- [ ] a ⏳ 2026-11-13 🔁 every day')).toEqual({ line: '- [ ] a', repeatRemoved: true });
	});

	test('keeps the repeat while another date remains', () => {
		expect(removeWhen('- [ ] a ⏳ 2026-11-13 📅 2026-11-20 🔁 every day')).toEqual({
			line: '- [ ] a 📅 2026-11-20 🔁 every day',
			repeatRemoved: false,
		});
	});

	test('leaves a line that does not repeat as setWhen does', () => {
		expect(removeWhen('- [ ] a ⏳ 2026-11-13')).toEqual({ line: '- [ ] a', repeatRemoved: false });
	});
});
