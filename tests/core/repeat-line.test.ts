import { describe, expect, test } from 'vitest';
import {
	anchorOf,
	hasDate,
	repeatOf,
	RepeatingItemError,
	tickRepeating,
	type RepeatProblem,
} from '../../src/core/repeat-line';
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
