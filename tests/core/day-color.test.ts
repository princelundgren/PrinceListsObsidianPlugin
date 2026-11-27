import { describe, expect, test } from 'vitest';
import { dayColor, overdueColorOf, todayColorOf } from '../../src/core/day-color';

const TODAY = '2026-11-27';
const COLORS = { overdueColor: 'orange', todayColor: 'cyan' } as const;

describe('overdueColorOf', () => {
	test('keeps a stored choice', () => {
		expect(overdueColorOf('blue')).toBe('blue');
		expect(overdueColorOf('red')).toBe('red');
	});

	test.each([undefined, 'crimson', 1, null])('reads %s as none', (stored) => {
		expect(overdueColorOf(stored)).toBe('none');
	});
});

describe('todayColorOf', () => {
	test('keeps a stored choice', () => {
		expect(todayColorOf('pink')).toBe('pink');
		expect(todayColorOf('blue')).toBe('blue');
	});

	test.each([undefined, 'lime', 3, null])('reads %s as none', (stored) => {
		expect(todayColorOf(stored)).toBe('none');
	});
});

describe('dayColor', () => {
	test("gives an open overdue item the overdue color, and an open item due today today's", () => {
		expect(dayColor('2026-11-26', TODAY, false, COLORS)).toBe('orange');
		expect(dayColor('2025-01-02', TODAY, false, COLORS)).toBe('orange');
		expect(dayColor(TODAY, TODAY, false, COLORS)).toBe('cyan');
	});

	test('leaves a ticked item gray, today or past', () => {
		expect(dayColor(TODAY, TODAY, true, COLORS)).toBe('none');
		expect(dayColor('2026-11-26', TODAY, true, COLORS)).toBe('none');
	});

	test('leaves tomorrow and later gray', () => {
		expect(dayColor('2026-11-28', TODAY, false, COLORS)).toBe('none');
		expect(dayColor('2027-03-01', TODAY, false, COLORS)).toBe('none');
	});
});
