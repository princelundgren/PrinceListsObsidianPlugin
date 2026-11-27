import { describe, expect, test } from 'vitest';
import { isOverdue, type OverdueLabel, overdueLabelOf, rowDay } from '../../src/core/overdue';

const TODAY = '2026-11-26';

describe('overdueLabelOf', () => {
	test.each(['yesterday-or-date', 'overdue', 'today'])('keeps the choice %s', (stored) => {
		expect(overdueLabelOf(stored)).toBe(stored);
	});

	test.each([undefined, 'late', 1, null])('reads %s as yesterday-or-date', (stored) => {
		expect(overdueLabelOf(stored)).toBe('yesterday-or-date');
	});
});

describe('isOverdue', () => {
	test('is true only for an open item whose day is before today', () => {
		expect(isOverdue('2026-11-25', TODAY, false)).toBe(true);
		expect(isOverdue('2025-12-31', TODAY, false)).toBe(true);
		expect(isOverdue('2026-11-25', TODAY, true)).toBe(false);
		expect(isOverdue(TODAY, TODAY, false)).toBe(false);
	});
});

describe('rowDay', () => {
	test.each([
		['yesterday-or-date', '2026-11-25', { shown: 'Yesterday', spoken: 'Overdue, Yesterday' }],
		['yesterday-or-date', '2026-11-23', { shown: 'Nov 23', spoken: 'Overdue, Nov 23' }],
		['overdue', '2026-11-23', { shown: 'Overdue', spoken: 'Overdue, Nov 23' }],
		['today', '2026-11-23', { shown: 'Today', spoken: 'Overdue, Nov 23' }],
	] as const)('with %s shows an open %s as late', (label, day, expected) => {
		expect(rowDay(day, TODAY, false, label, 'en')).toEqual(expected);
	});

	test.each(['yesterday-or-date', 'overdue', 'today'] as const)('with %s shows a ticked past day plainly', (label: OverdueLabel) => {
		expect(rowDay('2026-11-23', TODAY, true, label, 'en')).toEqual({ shown: 'Nov 23', spoken: null });
	});

	test('leaves today and later days as they are', () => {
		expect(rowDay(TODAY, TODAY, false, 'overdue', 'en')).toEqual({ shown: 'Today', spoken: null });
		expect(rowDay('2026-11-27', TODAY, false, 'overdue', 'en')).toEqual({ shown: 'Tomorrow', spoken: null });
	});
});
