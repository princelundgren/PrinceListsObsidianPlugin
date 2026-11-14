import { describe, expect, it, test } from 'vitest';
import { tickLine, untickLine } from '../../src/core/item-line';
import {
	anchorOf,
	backDay,
	comeBack,
	canWrite,
	draftOf,
	ensureTickable,
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

describe('ensureTickable', () => {
	const today = '2026-11-13';

	test('refuses what Save writes over a title 🔚 that is no end, with and without a chosen end', () => {
		for (const end of [null, { kind: 'times', left: 3 } as const]) {
			const written = setRepeat('- [ ] Trip 🔚 soon', every(1, 'day'), end, today);
			expect(() => ensureTickable(written), written).toThrow(
				expect.objectContaining({ problem: 'end', message: "This item's 🔚 end can't be read, so the repeat isn't saved." }),
			);
		}
	});

	test('refuses a line with a date that does not exist', () => {
		expect(() => ensureTickable(setRepeat('- [ ] a ⏳ 2026-02-30', every(1, 'day'), null, today))).toThrow(
			expect.objectContaining({ problem: 'date', message: "This item has a date that doesn't exist, so the repeat isn't saved." }),
		);
	});

	test('keeps the tick\'s message for a tick', () => {
		expect(() => tickRepeating('- [ ] a 🔚 soon ⏳ 2026-11-13 🔁 every day', now)).toThrow(
			"This item's 🔚 end can't be read, so it isn't ticked.",
		);
	});

	test('passes a plain line, and one with a readable end, unchanged', () => {
		for (const end of [null, { kind: 'times', left: 3 } as const]) {
			const written = setRepeat('- [ ] Water plants', every(3, 'day'), end, today);
			expect(ensureTickable(written)).toBe(written);
		}
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

const at = (d: number, h = 20) => new Date(2026, 10, d, h, 0);

describe('backDay', () => {
	const daily = '- [x] Water ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14';
	it('daily, ticked on the day', () => expect(backDay(daily, at(14))).toBe('2026-11-15'));
	it('weekly', () => expect(backDay('- [x] Review ✔ 2026-11-16 09:00 🔁 every week ⏳ 2026-11-16', at(16))).toBe('2026-11-23'));
	it('ticked early', () => expect(backDay('- [x] Water ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-20', at(14))).toBe('2026-11-21'));
	it('ticked late keeps the rhythm', () => expect(backDay('- [x] Review ✔ 2026-11-14 18:05 🔁 every week ⏳ 2026-11-02', at(14))).toBe('2026-11-16'));
	it('when done', () => expect(backDay('- [x] Water ✔ 2026-11-14 18:05 🔁 every 3 days when done ⏳ 2026-11-01', at(14))).toBe('2026-11-17'));
	it('no date', () => expect(backDay('- [x] Water ✔ 2026-11-14 18:05 🔁 every day', at(14))).toBe('2026-11-15'));
	it('last time', () => expect(backDay('- [x] Physio 🔚 1x ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14', at(14))).toBeNull());
	it('past the end date', () => expect(backDay('- [x] Physio 🔚 2026-11-14 ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14', at(14))).toBeNull());
	it('Tasks history line', () => expect(backDay('- [x] Water 🔁 every day ⏳ 2026-11-14 ✅ 2026-11-14', at(14))).toBeNull());
	it('mark ahead: the anchor stands in', () => expect(backDay('- [x] Water ✔ 2026-11-20 18:05 🔁 every day ⏳ 2026-11-10', at(14))).toBe('2026-11-11'));
	it('no anchor and no mark that counts', () => expect(backDay('- [x] Water ✔ 2026-11-20 18:05 🔁 every day', at(14))).toBe('2026-11-14'));
	it('two marks: the earliest', () => expect(backDay('- [x] Water ✔ 2026-11-12 08:00 ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-12', at(14))).toBe('2026-11-13'));
	it('open, unreadable or past 9999', () => {
		expect(backDay('- [ ] Water 🔁 every day ⏳ 2026-11-14', at(14))).toBeNull();
		expect(backDay('- [x] Water ✔ 2026-11-14 18:05 🔁 every weekday ⏳ 2026-11-14', at(14))).toBeNull();
		expect(backDay('- [x] Water ✔ 2026-11-14 18:05 🔁 every year ⏳ 9999-12-31', at(14))).toBeNull();
		expect(backDay('- [x] Water ✔ 2026-11-14 18:05 🔁 every day 🛫 9999-12-31 📅 2026-11-14', at(14))).toBeNull();
	});
});

describe('comeBack', () => {
	const daily = '- [x] Water ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14';
	it('not before its date', () => expect(comeBack(daily, at(14, 23))).toBeNull());
	it('on its date', () => expect(comeBack(daily, at(15, 8))).toBe('- [ ] Water 🔁 every day ⏳ 2026-11-15'));
	it('days later, on today', () => expect(comeBack(daily, at(18))).toBe('- [ ] Water 🔁 every day ⏳ 2026-11-18'));
	it('weekly, on its latest weekday', () =>
		expect(comeBack('- [x] Review ✔ 2026-11-16 09:00 🔁 every week ⏳ 2026-11-16', new Date(2026, 11, 2, 9))).toBe('- [ ] Review 🔁 every week ⏳ 2026-11-30'));
	it('when done, late', () =>
		expect(comeBack('- [x] Water ✔ 2026-11-14 18:05 🔁 every 3 days when done ⏳ 2026-11-14', at(25))).toBe('- [ ] Water 🔁 every 3 days when done ⏳ 2026-11-17'));
	it('counts down', () =>
		expect(comeBack('- [x] Physio 🔚 3x ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14', at(15))).toBe('- [ ] Physio 🔚 2x 🔁 every day ⏳ 2026-11-15'));
	it('late past its end date, on the last date before it', () =>
		expect(comeBack('- [x] Physio 🔚 2026-11-20 ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14', at(25))).toBe('- [ ] Physio 🔚 2026-11-20 🔁 every day ⏳ 2026-11-20'));
	it('moves due and start, keeps ➕, drops ✅', () =>
		expect(comeBack('- [x] Rent ✔ 2026-11-14 18:05 🔁 every day ➕ 2026-11-01 🛫 2026-11-12 📅 2026-11-14 ✅ 2026-11-14', at(15)))
			.toBe('- [ ] Rent 🔁 every day ➕ 2026-11-01 🛫 2026-11-13 📅 2026-11-15'));
	it('no date gains ⏳', () =>
		expect(comeBack('- [x] Water ✔ 2026-11-14 18:05 🔁 every day', at(17))).toBe('- [ ] Water 🔁 every day ⏳ 2026-11-15'));
	it('no date and no mark that counts: today', () =>
		expect(comeBack('- [x] Water ✔ 2026-11-20 18:05 🔁 every day', at(14))).toBe('- [ ] Water 🔁 every day ⏳ 2026-11-14'));
	it('a date that would pass 9999 on a later step never', () =>
		expect(comeBack('- [x] Water ✔ 2026-11-14 18:05 🔁 every day 🛫 9999-12-30 📅 2026-11-14', at(18))).toBeNull());
});
