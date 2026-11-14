import { expect, test } from 'vitest';
import { planComeBacks } from '../../src/core/come-back';

const now = new Date(2026, 10, 15, 8, 0);
const HEAD = '---\nprincelists: true\n---\n';
const DUE = '- [x] Water ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14\n  - [x] Step\n';
const NOT_DUE = '- [x] Review ✔ 2026-11-14 09:00 🔁 every week ⏳ 2026-11-14\n';
const OPEN = '- [ ] Call mum\n';
const TEXT = HEAD + DUE + NOT_DUE + OPEN;
const BACK = '- [ ] Water 🔁 every day ⏳ 2026-11-15\n  - [ ] Step\n';
const all = () => true;

test('brings back the due item and unticks its checklist, leaving every other line', () => {
	expect(planComeBacks(TEXT, 3, now, all)).toEqual({ count: 1, next: HEAD + BACK + NOT_DUE + OPEN });
});

test('keeps CRLF on every line', () => {
	const crlf = (text: string) => text.replace(/\n/g, '\r\n');
	expect(planComeBacks(crlf(TEXT), 3, now, all)?.next).toBe(crlf(HEAD + BACK + NOT_DUE + OPEN));
});

test('null when nothing is due', () => {
	expect(planComeBacks(HEAD + NOT_DUE + OPEN, 3, now, all)).toBeNull();
});

test('leaves a due item whose line gathers refuses', () => {
	expect(planComeBacks(TEXT, 3, now, () => false)).toBeNull();
	const tea = '- [x] Tea ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14\n';
	expect(planComeBacks(HEAD + DUE + tea, 3, now, (line) => !line.includes('Water'))).toEqual({
		count: 1,
		next: HEAD + DUE + '- [ ] Tea 🔁 every day ⏳ 2026-11-15\n',
	});
});
