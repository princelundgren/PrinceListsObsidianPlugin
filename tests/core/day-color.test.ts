import { describe, expect, test } from 'vitest';
import { dayColor, overdueColorOf, todayColorOf } from '../../src/core/day-color';

const TODAY = '2026-11-27';
const COLORS = { overdueColor: 'orange', todayColor: 'cyan' } as const;

describe('overdueColorOf', () => {
	test.each([
		['blue', undefined, 'blue'],
		['none', true, 'none'],
		['red', false, 'red'],
	])('keeps a stored %s, whatever colorOverdue says', (stored, colorOverdue, color) => {
		expect(overdueColorOf(stored, colorOverdue)).toBe(color);
	});

	test('reads an old colorOverdue of false as none, so a color turned off stays off', () => {
		expect(overdueColorOf(undefined, false)).toBe('none');
	});

	test.each([
		[undefined, true],
		[undefined, undefined],
		['crimson', false],
		[1, undefined],
	])('reads %s with colorOverdue %s as red', (stored, colorOverdue) => {
		expect(overdueColorOf(stored, colorOverdue)).toBe('red');
	});
});

describe('todayColorOf', () => {
	test('keeps a stored choice', () => {
		expect(todayColorOf('pink')).toBe('pink');
		expect(todayColorOf('none')).toBe('none');
	});

	test.each([undefined, 'lime', 3, null])('reads %s as green', (stored) => {
		expect(todayColorOf(stored)).toBe('green');
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
