import { describe, expect, test } from 'vitest';
import {
	TASKS_SIGNIFIERS,
	formatStamp,
	isDoneStatus,
	isRepeating,
	joinItemLine,
	markTime,
	parseItemLine,
	setTitle,
	tickLine,
	untickLine,
} from '../../src/core/item-line';

const now = new Date(2026, 9, 20, 23, 55);
const STAMP = '✔ 2026-10-20 23:55';
const VS16 = '️';

describe('tickLine', () => {
	test.each([
		['- [ ] cutting board', `- [x] cutting board ${STAMP}`],
		[
			'- [ ] storage boxes ⏳ 2026-10-21 📅 2026-10-30 #shop ^abc123',
			`- [x] storage boxes ${STAMP} ⏳ 2026-10-21 📅 2026-10-30 #shop ^abc123`,
		],
		['* [ ] a 🔼', `* [x] a ${STAMP} 🔼`],
		['- [ ] a ✔ 2026-10-19 10:00', `- [x] a ${STAMP}`],
		// Beyond the table: rules the design states.
		['- [ ] a 📅 2026-10-30', `- [x] a ${STAMP} 📅 2026-10-30`],
		[`- [ ] a 📅${VS16} 2026-10-30`, `- [x] a ${STAMP} 📅${VS16} 2026-10-30`],
		[`- [ ] a 🔼${VS16} 📅 2026-10-30`, `- [x] a ${STAMP} 🔼${VS16} 📅 2026-10-30`],
		['- [ ] a📅 2026-10-30', `- [x] a ${STAMP} 📅 2026-10-30`],
		['- [ ] a #x 📅 2026-10-30 #y', `- [x] a ${STAMP} #x 📅 2026-10-30 #y`],
		['- [ ] buy #milk', `- [x] buy ${STAMP} #milk`],
		['- [ ] a 🔁 every week 📅 2026-10-30', `- [x] a ${STAMP} 🔁 every week 📅 2026-10-30`],
		['- [ ] a ✔ nonsense', `- [x] a ✔ nonsense ${STAMP}`],
		['- [ ] a ^id', `- [x] a ${STAMP} ^id`],
	])('%s', (input, expected) => {
		expect(tickLine(input, now)).toBe(expected);
	});

	test.each([
		['🔺'],
		['⏫'],
		['🔼'],
		['🔽'],
		['⏬'],
		['🛫 2026-10-01'],
		['➕ 2026-10-01'],
		['⏳ 2026-10-01'],
		['⌛ 2026-10-01'],
		['📅 2026-10-01'],
		['📆 2026-10-01'],
		['🗓 2026-10-01'],
		['✅ 2026-10-01'],
		['❌ 2026-10-01'],
		['🔁 every week'],
		['🔁 every 2 weeks on Monday!'],
		['🏁 delete'],
		['🆔 abc'],
		['⛔ a, b'],
		['⛔ a,b-1_c'],
		[`🛫${VS16} 2026-10-01`],
		[`🔁${VS16} every week`],
		[`🆔${VS16} abc`],
	])('puts ✔ before the field %s', (field) => {
		expect(tickLine(`- [ ] t ${field}`, now)).toBe(`- [x] t ${STAMP} ${field}`);
	});

	test.each([
		['- [ ] a 📅 2026-10-30 ^id ', `- [x] a ${STAMP} 📅 2026-10-30 ^id `],
		['- [ ] a   ', `- [x] a ${STAMP}   `],
		['- [ ] a 🔼 ', `- [x] a ${STAMP} 🔼 `],
		['- [ ] #milk', `- [x] ${STAMP.padStart(STAMP.length + 1)} #milk`],
		['- [ ] 📅 2026-10-30', `- [x] ${STAMP.padStart(STAMP.length + 1)} 📅 2026-10-30`],
	])('trailing whitespace and empty titles: %s', (input, expected) => {
		expect(tickLine(input, now)).toBe(expected);
	});

	test('leaves a line that is not a task line alone', () => {
		expect(tickLine('- bullet', now)).toBe('- bullet');
	});
});

describe('untickLine', () => {
	test.each([
		[`- [x] a ${STAMP} ✅ 2026-10-20 📅 2026-10-30`, '- [ ] a 📅 2026-10-30'],
		['- [X] a', '- [ ] a'],
		[`- [x] a ${STAMP}`, '- [ ] a'],
		[`- [x] a ${STAMP} 📅 2026-10-30 ✅ 2026-10-20`, '- [ ] a 📅 2026-10-30'],
		['- [x] a ✔ 2026-10-20 10:00 ', '- [ ] a '],
		['- [x]  ✔ 2026-10-20 10:00 ⏳ 2026-10-30', '- [ ] ⏳ 2026-10-30'],
		['- [x]  📅 2026-10-30', '- [ ]  📅 2026-10-30'],
	])('%s', (input, expected) => {
		expect(untickLine(input)).toBe(expected);
	});
	test.each(['- [ ] ⏳ 2026-10-30', '- [ ] 📅 2026-11-01', '- [ ] '])('a tick and an untick of %s give it back', (line) => {
		expect(untickLine(tickLine(line, new Date(2026, 9, 28, 10, 0)))).toBe(line);
	});
});

describe('setTitle', () => {
	test('drops a leftover mark on an open line', () => {
		expect(setTitle('- [ ] a ✔ 2026-10-19 10:00 📅 2026-10-30', 'b')).toBe('- [ ] b 📅 2026-10-30');
	});
	test('keeps the earliest of doubled marks', () => {
		expect(setTitle('- [x] a ✔ 2026-10-20 09:07 ✔ 2026-10-20 09:00', 'b')).toBe(
			'- [x] b ✔ 2026-10-20 09:00',
		);
	});
	test('counts a date-only mark as the end of its day', () => {
		expect(setTitle('- [x] a ✔ 2026-10-20 ✔ 2026-10-20 23:59', 'b')).toBe(
			'- [x] b ✔ 2026-10-20 23:59',
		);
	});
	test('keeps the earliest readable mark, and a date-only mark counts as the end of its day', () => {
		expect(setTitle('- [x] a ✔ 2026-10-20 ✔ 2026-10-20 09:00', 'b')).toBe(
			'- [x] b ✔ 2026-10-20 09:00',
		);
	});
	test('skips unreadable marks, and keeps the first when none is readable', () => {
		expect(setTitle('- [x] a ✔ 2026-13-01 10:00 ✔ 2026-10-20 09:00', 'b')).toBe(
			'- [x] b ✔ 2026-10-20 09:00',
		);
		expect(setTitle('- [x] a ✔ 2026-10-20 25:99 ✔ 2026-13-01', 'b')).toBe(
			'- [x] b ✔ 2026-10-20 25:99',
		);
	});
	test('keeps a mark when the line has trailing whitespace', () => {
		expect(setTitle('- [x] a ✔ 2026-10-20 10:00 ', 'b')).toBe('- [x] b ✔ 2026-10-20 10:00 ');
	});
	test.each([
		['- [ ] #milk', '- [ ] b #milk'],
		['- [ ] #milk 📅 2026-10-30', '- [ ] b #milk 📅 2026-10-30'],
		['- [ ] 📅 2026-10-30', '- [ ] b 📅 2026-10-30'],
		['- [ ] a📅 2026-10-30', '- [ ] b 📅 2026-10-30'],
	])('puts a gap between the new title and a tail that starts the line: %s', (input, expected) => {
		expect(setTitle(input, 'b')).toBe(expected);
	});
	test('an empty title leaves no stray gap', () => {
		expect(setTitle('- [ ] a #milk', '')).toBe('- [ ]  #milk');
	});
	test('keeps a single mark, tail and block ID as they were', () => {
		expect(setTitle('- [x] a ✔ 2026-10-20 09:00 ⏳ 2026-10-21 #t ^id', 'b')).toBe(
			'- [x] b ✔ 2026-10-20 09:00 ⏳ 2026-10-21 #t ^id',
		);
	});
});

describe('isRepeating', () => {
	test('true for a 🔁 field', () => {
		expect(isRepeating('- [ ] a 🔁 every week 📅 2026-10-30')).toBe(true);
	});
	test('false without one, or for a non-task line', () => {
		expect(isRepeating('- [ ] a 📅 2026-10-30')).toBe(false);
		expect(isRepeating('- bullet')).toBe(false);
	});
});

describe('parseItemLine', () => {
	test('accepts U+FE0F after ✔', () => {
		const parts = parseItemLine(`- [ ] a ✔${VS16} 2026-10-20 10:00`);
		expect(parts?.marks).toBe(` ✔${VS16} 2026-10-20 10:00`);
		expect(parts?.title).toBe('a');
	});
	test('splits every part', () => {
		expect(parseItemLine('12. [x] t ✔ 2026-10-20 09:00 📅 2026-10-30 ^id')).toEqual({
			before: '12. [',
			status: 'x',
			afterStatus: '] ',
			title: 't',
			marks: ' ✔ 2026-10-20 09:00',
			tail: ' 📅 2026-10-30 ^id',
		});
	});
	test.each(['- bullet', '## h', '-[ ] x', '- [ab] x'])('returns null for %s', (t) => {
		expect(parseItemLine(t)).toBeNull();
	});
	test('round-trips through joinItemLine', () => {
		for (const t of [
			'- [ ] cutting board',
			'- [ ] storage boxes ⏳ 2026-10-21 📅 2026-10-30 #shop ^abc123',
			'* [ ] a 🔼',
			'- [ ] a ✔ 2026-10-19 10:00',
			`- [x] a ${STAMP} ✅ 2026-10-20 📅 2026-10-30`,
			'- [X] a',
			`- [ ] a ✔${VS16} 2026-10-20 10:00`,
			'- [ ] a ✔ 2026-10-20 09:07 ✔ 2026-10-20 09:00',
			'- [ ] a🔼 ',
			'  - [ ] indented  #t  ^id',
			'- [ ] a ✔ 2026-10-19 10:00 📅 2026-10-30',
			'- [x] a ✔ 2026-10-20 09:07 ✔ 2026-10-20 09:00',
			'- [ ] a 🔁 every week 📅 2026-10-30',
			'- [ ] a 📅 2026-10-30 ^id ',
		]) {
			expect(joinItemLine(parseItemLine(t) as NonNullable<ReturnType<typeof parseItemLine>>)).toBe(t);
		}
	});
	test('setTitle with the same title is a no-op when there are no doubled or leftover marks', () => {
		for (const t of [
			'- [ ] cutting board',
			'- [ ] storage boxes ⏳ 2026-10-21 📅 2026-10-30 #shop ^abc123',
			`- [x] a ${STAMP} ✅ 2026-10-20 📅 2026-10-30`,
			'* [ ] a 🔼',
		]) {
			expect(setTitle(t, (parseItemLine(t) as { title: string }).title)).toBe(t);
		}
	});
	test('does not treat a field-like word inside the title as a field', () => {
		expect(parseItemLine('- [ ] 📅 plan the trip')?.tail).toBe('');
	});
});

describe('markTime', () => {
	test.each([
		['✔ 2026-10-20 09:07', new Date(2026, 9, 20, 9, 7)],
		[`✔${VS16} 2026-10-20 09:07`, new Date(2026, 9, 20, 9, 7)],
		['✔ 2026-10-20', new Date(2026, 9, 20, 23, 59, 59, 999)],
		['✅ 2026-10-20', new Date(2026, 9, 20, 23, 59, 59, 999)],
		['✅2026-10-20', new Date(2026, 9, 20, 23, 59, 59, 999)],
	])('%s', (mark, expected) => {
		expect(markTime(mark)?.getTime()).toBe(expected.getTime());
	});
	test.each(['✔ 2026-13-01', '✔ 2026-02-30', '✔ 2026-10-20 25:99', '✔ 2026-10-20 24:00', '✅ 2026-00-10', 'nope'])(
		'null for %s',
		(mark) => {
			expect(markTime(mark)).toBeNull();
		},
	);
});

test('a long ⛔ line parses without catastrophic backtracking', () => {
	const line = `- [ ] a ⛔ a${' ,a'.repeat(26)}!`;
	const start = performance.now();
	parseItemLine(line);
	expect(performance.now() - start).toBeLessThan(50);
});

test('isDoneStatus is true for anything but a space', () => {
	expect(isDoneStatus(' ')).toBe(false);
	expect(isDoneStatus('x')).toBe(true);
	expect(isDoneStatus('X')).toBe(true);
	expect(isDoneStatus('-')).toBe(true);
});

test('formatStamp is local time on a 24-hour clock, zero-padded', () => {
	expect(formatStamp(now)).toBe(STAMP);
	expect(formatStamp(new Date(2026, 0, 5, 7, 3))).toBe('✔ 2026-01-05 07:03');
});

test('TASKS_SIGNIFIERS is the design’s 18', () => {
	expect([...TASKS_SIGNIFIERS].sort()).toEqual([...'🔺⏫🔼🔽⏬🛫➕⏳⌛📅📆🗓✅❌🔁🏁🆔⛔'.match(/./gu) as string[]].sort());
	expect(TASKS_SIGNIFIERS).toHaveLength(18);
});
