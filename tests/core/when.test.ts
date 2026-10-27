import { describe, expect, test } from 'vitest';
import { itemRow } from '../../src/core/display';
import { parseItemLine } from '../../src/core/item-line';
import { dayLabelKind, dayOf, daysFrom, setWhen, whenOf } from '../../src/core/when';

describe('whenOf', () => {
	test.each(['- [ ] a ⏳ 2026-10-30', '- [ ] a ⌛ 2026-10-30', '- [ ] a ⏳️ 2026-10-30'])('reads %s', (line) => {
		expect(whenOf(line)).toBe('2026-10-30');
	});
	test('takes the earliest of several', () => {
		expect(whenOf('- [ ] a ⏳ 2026-10-30 ⏳ 2026-10-28')).toBe('2026-10-28');
	});
	test.each(['- [ ] ⏳ 2026-10-30 a', '- [ ] a ⏳ 2026-02-30', '- [ ] a 📅 2026-10-30'])('finds none in %s', (line) => {
		expect(whenOf(line)).toBeNull();
	});
});

describe('setWhen', () => {
	test.each<[string, string | null, string]>([
		['- [ ] a', '2026-10-30', '- [ ] a ⏳ 2026-10-30'],
		['- [ ] a ⏳ 2026-10-21 📅 2026-10-30', '2026-11-02', '- [ ] a ⏳ 2026-11-02 📅 2026-10-30'],
		['- [x] Buy milk ⭐ ✔ 2026-10-27 18:05 ^id', '2026-10-30', '- [x] Buy milk ⭐ ✔ 2026-10-27 18:05 ⏳ 2026-10-30 ^id'],
		['- [ ] a 📅 2026-10-30 #shop ^id  ', '2026-11-02', '- [ ] a 📅 2026-10-30 #shop ⏳ 2026-11-02 ^id  '],
		['- [ ] a ⏳ 2026-10-30 📅 2026-11-01 ⌛ 2026-10-28', '2026-11-05', '- [ ] a ⏳ 2026-11-05 📅 2026-11-01'],
		['- [ ] a ⏳ 2026-10-30 📅 2026-11-01 ⌛ 2026-10-28', null, '- [ ] a 📅 2026-11-01'],
		['- [ ] a ⏳ 2026-10-30', null, '- [ ] a'],
		['- [ ] a ⌛ 2026-10-30', '2026-11-02', '- [ ] a ⏳ 2026-11-02'],
		['- [ ] ', '2026-11-02', '- [ ] ⏳ 2026-11-02'],
	])('%s with %s gives %s', (line, day, expected) => {
		expect(setWhen(line, day)).toBe(expected);
	});

	test('keeps everything else on the line, and the title reads the same', () => {
		const line = '- [x] Buy milk ⭐ ✔ 2026-10-27 18:05 📅 2026-11-01 #shop ⏳ 2026-10-30 ^id  ';
		const changed = setWhen(line, '2026-11-02');
		expect(changed).toBe(line.replace('⏳ 2026-10-30', '⏳ 2026-11-02'));
		expect(parseItemLine(changed)?.title).toBe(parseItemLine(line)?.title);
		expect(itemRow(line, 0, new Date(2026, 9, 27)).when).toBe('2026-10-30');
	});
});

describe('days', () => {
	test('dayOf is the local calendar day', () => {
		expect(dayOf(new Date(2026, 9, 27, 23, 59))).toBe('2026-10-27');
		expect(dayOf(new Date(2026, 9, 28, 0, 0))).toBe('2026-10-28');
	});
	test('daysFrom counts calendar days across a daylight-saving change and a new year', () => {
		expect(daysFrom('2026-03-28', '2026-03-30')).toBe(2);
		expect(daysFrom('2026-12-31', '2027-01-01')).toBe(1);
	});
	test('dayLabelKind names today, tomorrow, the next days by weekday, and the rest by date', () => {
		const kinds = ['2026-10-27', '2026-10-28', '2026-10-29', '2026-11-02', '2026-11-03', '2026-10-26'].map((day) => dayLabelKind(day, '2026-10-27'));
		expect(kinds).toEqual(['today', 'tomorrow', 'weekday', 'weekday', 'date', 'date']);
	});
});
