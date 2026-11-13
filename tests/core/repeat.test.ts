import { describe, expect, test } from 'vitest';
import {
	addDays,
	nextDay,
	readEnd,
	readRule,
	stepDay,
	upcomingDays,
	writeEnd,
	writeRule,
	type RepeatRule,
} from '../../src/core/repeat';

function rule(every: number, unit: RepeatRule['unit'], flags: Partial<RepeatRule> = {}): RepeatRule {
	return { every, unit, onLast: false, whenDone: false, ...flags };
}

describe('readRule', () => {
	test.each([
		['every day', rule(1, 'day')],
		['Every 3 Days', rule(3, 'day')],
		['every 1 day', rule(1, 'day')],
		['every 2 weeks', rule(2, 'week')],
		['every year', rule(1, 'year')],
		['every month on the last when done', rule(1, 'month', { onLast: true, whenDone: true })],
	])('reads %s', (text, expected) => {
		expect(readRule(text)).toEqual(expected);
	});

	test.each(['every weekday', 'every week on Tuesday', 'every 0 days', 'every day on the last', 'every month on the 31st'])(
		'refuses %s',
		(text) => {
			expect(readRule(text)).toBeNull();
		},
	);
});

describe('writeRule', () => {
	test.each([
		[rule(1, 'day'), 'every day'],
		[rule(3, 'day'), 'every 3 days'],
		[rule(2, 'month', { onLast: true }), 'every 2 months on the last'],
		[rule(1, 'week', { whenDone: true }), 'every week when done'],
	])('writes %j', (value, text) => {
		expect(writeRule(value)).toBe(text);
	});
});

describe('readEnd and writeEnd', () => {
	test('reads a date', () => {
		expect(readEnd('2026-12-31')).toEqual({ kind: 'date', day: '2026-12-31' });
	});

	test.each(['5x', '5X', '05x'])('reads %s as five times', (text) => {
		expect(readEnd(text)).toEqual({ kind: 'times', left: 5 });
	});

	test.each(['0x', '-1x', 'soon', '2026-02-30'])('refuses %s', (text) => {
		expect(readEnd(text)).toBeNull();
	});

	test('writes both kinds', () => {
		expect(writeEnd({ kind: 'date', day: '2026-12-31' })).toBe('🔚 2026-12-31');
		expect(writeEnd({ kind: 'times', left: 5 })).toBe('🔚 5x');
	});
});

describe('addDays', () => {
	test('crosses a month and a clock change', () => {
		expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
		expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
	});
});

describe('stepDay', () => {
	test.each([
		['2026-01-31', rule(1, 'month'), '2026-02-28'],
		['2026-02-28', rule(1, 'month'), '2026-03-28'],
		['2024-02-29', rule(1, 'year'), '2025-02-28'],
		['2026-11-14', rule(2, 'month', { onLast: true }), '2026-11-30'],
		['2026-11-30', rule(2, 'month', { onLast: true }), '2027-01-31'],
		['2026-01-31', rule(1, 'month', { onLast: true }), '2026-02-28'],
		['2026-11-13', rule(3, 'day'), '2026-11-16'],
		['2026-11-13', rule(2, 'week'), '2026-11-27'],
		['2026-03-28', rule(1, 'day'), '2026-03-29'],
	])('from %s by %j gives %s', (day, repeat, expected) => {
		expect(stepDay(day, repeat)).toBe(expected);
	});
});

describe('nextDay', () => {
	const today = '2026-11-13';

	test.each([
		['a missed weekly item lands after today', '2026-11-01', rule(1, 'week'), today, '2026-11-15'],
		['an item ticked early steps once', '2026-11-20', rule(1, 'week'), today, '2026-11-27'],
		['an item ticked on its day steps once', '2026-11-13', rule(1, 'week'), today, '2026-11-20'],
		['a 31st monthly item missed by months drifts', '2026-01-31', rule(1, 'month'), '2026-04-15', '2026-04-28'],
		['when done steps from today', '2026-10-01', rule(1, 'month', { whenDone: true }), today, '2026-12-13'],
		['when done on the last', '2026-10-01', rule(1, 'month', { onLast: true, whenDone: true }), today, '2026-11-30'],
	])('%s', (_name, anchor, repeat, now, expected) => {
		expect(nextDay(anchor, repeat, now)).toBe(expected);
	});
});

describe('upcomingDays', () => {
	const today = '2026-11-13';
	const weekly = rule(1, 'week');

	test('lists the next dates with no end', () => {
		expect(upcomingDays('2026-11-13', weekly, null, today, 3)).toEqual(['2026-11-20', '2026-11-27', '2026-12-04']);
	});

	test('a count of 2x leaves one more date', () => {
		expect(upcomingDays('2026-11-13', weekly, { kind: 'times', left: 2 }, today, 3)).toEqual(['2026-11-20']);
	});

	test('a count of 1x leaves none, since that tick ends the repeat', () => {
		expect(upcomingDays('2026-11-13', weekly, { kind: 'times', left: 1 }, today, 3)).toEqual([]);
	});

	test('stops past an end date and keeps the end day itself', () => {
		expect(upcomingDays('2026-11-13', weekly, { kind: 'date', day: '2026-11-30' }, today, 3)).toEqual([
			'2026-11-20',
			'2026-11-27',
		]);
		expect(upcomingDays('2026-11-13', weekly, { kind: 'date', day: '2026-11-27' }, today, 3)).toEqual([
			'2026-11-20',
			'2026-11-27',
		]);
	});

	test('without an anchor, steps from today', () => {
		expect(upcomingDays(null, rule(1, 'day'), null, today, 3)).toEqual(['2026-11-14', '2026-11-15', '2026-11-16']);
	});
});
