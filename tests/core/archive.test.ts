import { describe, expect, test } from 'vitest';
import { ARCHIVE_DELAY_MS, doneAt, isArchived } from '../../src/core/archive';

const now = new Date(2026, 9, 20, 12, 0);
const VS16 = '️';

function at(...args: [number, number, number, number?, number?, number?, number?]): {
	kind: 'at';
	time: Date;
} {
	return { kind: 'at', time: new Date(...args) };
}

describe('ARCHIVE_DELAY_MS', () => {
	test('is 24 hours', () => {
		expect(ARCHIVE_DELAY_MS).toBe(24 * 60 * 60 * 1000);
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
		expect(isArchived(line, when)).toBe(expected);
	});
});
