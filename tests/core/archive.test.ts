import { describe, expect, test } from 'vitest';
import { archiveDelayHoursOf, archiveDelayMs, doneAt, isArchived, type ArchiveDelayHours } from '../../src/core/archive';

const now = new Date(2026, 9, 20, 12, 0);
const VS16 = '️';

function at(...args: [number, number, number, number?, number?, number?, number?]): {
	kind: 'at';
	time: Date;
} {
	return { kind: 'at', time: new Date(...args) };
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('archiveDelayMs', () => {
	test.each([
		['0', 0],
		['1', HOUR],
		['12', 12 * HOUR],
		['24', DAY],
		['48', 2 * DAY],
		['168', 7 * DAY],
	])('reads the hours choice %s', (hours, expected) => {
		expect(archiveDelayMs(hours as ArchiveDelayHours)).toBe(expected);
	});
});

describe('archiveDelayHoursOf', () => {
	test('keeps a stored choice', () => {
		expect(archiveDelayHoursOf('168')).toBe('168');
	});

	test.each([['5'], [''], ['-24'], ['24.5'], [24], [null], [undefined]])('reads a stored value that is no choice as a day: %s', (stored) => {
		expect(archiveDelayHoursOf(stored)).toBe('24');
	});
});

describe('doneAt', () => {
	test.each([
		['a ✔ with a time', '- [x] a ✔ 2026-10-20 11:00', at(2026, 9, 20, 11, 0)],
		['a ✔ with a date only', '- [x] a ✔ 2026-10-19', at(2026, 9, 19, 23, 59, 59, 999)],
		['a ✅ field', '- [x] a ✅ 2026-10-19', at(2026, 9, 19, 23, 59, 59, 999)],
		['a ✅ field with U+FE0F', `- [x] a ✅${VS16} 2026-10-19`, at(2026, 9, 19, 23, 59, 59, 999)],
		['a ✔ with U+FE0F', `- [x] a ✔${VS16} 2026-10-20 11:00`, at(2026, 9, 20, 11, 0)],
		['a done line with no mark', '- [x] a', { kind: 'longAgo' }],
		['a time that does not exist', '- [x] a ✔ 2026-13-45 10:00', { kind: 'longAgo' }],
		['a mark more than 24 h ahead', '- [x] a ✔ 2026-10-22 12:00', { kind: 'longAgo' }],
		['a mark 23 h ahead', '- [x] a ✔ 2026-10-21 11:00', at(2026, 9, 21, 11, 0)],
		['a mark exactly 24 h ahead', '- [x] a ✔ 2026-10-21 12:00', at(2026, 9, 21, 12, 0)],
		['a mark one minute over 24 h ahead', '- [x] a ✔ 2026-10-21 12:01', { kind: 'longAgo' }],
		[
			'the earliest of two marks',
			'- [x] a ✔ 2026-10-20 09:07 ✔ 2026-10-20 09:00',
			at(2026, 9, 20, 9, 0),
		],
		[
			'an unreadable mark after a readable one',
			'- [x] a ✔ 2026-10-20 09:00 ✔ 2026-13-45 10:00',
			at(2026, 9, 20, 9, 0),
		],
		[
			'a far-future mark after a readable one',
			'- [x] a ✔ 2026-10-20 09:00 ✔ 2026-10-25 09:00',
			at(2026, 9, 20, 9, 0),
		],
		[
			'a ✔ and an earlier ✅',
			'- [x] a ✔ 2026-10-20 09:00 ✅ 2026-10-19',
			at(2026, 9, 19, 23, 59, 59, 999),
		],
		['any non-space status: -', '- [-] a', { kind: 'longAgo' }],
		['any non-space status: /', '- [/] a', { kind: 'longAgo' }],
		['any non-space status: X', '- [X] a', { kind: 'longAgo' }],
	])('%s', (_name, line, expected) => {
		expect(doneAt(line, now)).toEqual(expected);
	});

	test.each([
		['an open item with a leftover mark', '- [ ] a ✔ 2026-10-19 10:00'],
		['a line that is not a task', 'just a paragraph ✔ 2026-10-19 10:00'],
	])('is null for %s', (_name, line) => {
		expect(doneAt(line, now)).toBeNull();
	});
});

describe('isArchived', () => {
	test.each([
		['a ✔ time is not yet 24 h old', '- [x] a ✔ 2026-10-20 11:00', new Date(2026, 9, 21, 10, 59), false],
		['a ✔ time is exactly 24 h old', '- [x] a ✔ 2026-10-20 11:00', new Date(2026, 9, 21, 11, 0), true],
		['a ✔ date at the same day', '- [x] a ✔ 2026-10-19', now, false],
		['a ✔ date from the start of the second day', '- [x] a ✔ 2026-10-19', new Date(2026, 9, 21, 0, 0), true],
		['a ✅ date matches a ✔ date', '- [x] a ✅ 2026-10-19', new Date(2026, 9, 21, 0, 0), true],
		['a done line with no mark', '- [x] a', now, true],
		['an unreadable time', '- [x] a ✔ 2026-13-45 10:00', now, true],
		['a time more than 24 h ahead', '- [x] a ✔ 2026-10-22 12:00', now, true],
		['a time 23 h ahead', '- [x] a ✔ 2026-10-21 11:00', now, false],
		['a time exactly 24 h ahead', '- [x] a ✔ 2026-10-21 12:00', now, false],
		['an open item', '- [ ] a ✔ 2026-10-19 10:00', now, false],
		['a line that is not a task', 'a paragraph', now, false],
	])('%s', (_name, line, when, expected) => {
		expect(isArchived(line, when, DAY)).toBe(expected);
	});

	test.each([
		['at once, a tick from a moment ago', 0, new Date(2026, 9, 20, 12, 0), true],
		['after an hour, a tick 59 minutes old', HOUR, new Date(2026, 9, 20, 11, 59), false],
		['after an hour, a tick an hour old', HOUR, new Date(2026, 9, 20, 13, 0), true],
		['after a week, a tick 6 days old', 7 * DAY, new Date(2026, 9, 26, 12, 0), false],
		['after a week, a tick 7 days old', 7 * DAY, new Date(2026, 9, 27, 12, 0), true],
	])('%s', (_name, delay, when, expected) => {
		expect(isArchived('- [x] a ✔ 2026-10-20 12:00', when, delay)).toBe(expected);
	});

	test('hides a date-only tick the delay after the end of its day', () => {
		expect(isArchived('- [x] a ✔ 2026-10-19', new Date(2026, 9, 19, 23, 59), 0)).toBe(false);
		expect(isArchived('- [x] a ✔ 2026-10-19', new Date(2026, 9, 20, 0, 0), 0)).toBe(true);
		expect(isArchived('- [x] a ✔ 2026-10-19', new Date(2026, 9, 20, 0, 59), HOUR)).toBe(false);
		expect(isArchived('- [x] a ✔ 2026-10-19', new Date(2026, 9, 20, 1, 0), HOUR)).toBe(true);
	});

	test('counts a tick more than 24 h ahead as long ago, whatever the delay', () => {
		expect(isArchived('- [x] a ✔ 2026-10-22 12:00', now, 7 * DAY)).toBe(true);
		expect(isArchived('- [x] a ✔ 2026-10-21 11:00', now, 7 * DAY)).toBe(false);
	});
});
