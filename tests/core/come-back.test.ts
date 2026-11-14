import { expect, test } from 'vitest';
import { comeBackEdit, planComeBacks } from '../../src/core/come-back';
import { ListEditing } from '../../src/core/editing';
import { NO_LINES_MOVED } from '../../src/core/follow';
import { splitLines } from '../../src/core/lines';

const now = new Date(2026, 10, 15, 8, 0);
const HEAD = '---\nprincelists: true\n---\n';
const DUE = '- [x] Water ✔ 2026-11-14 18:05 🔁 every day ⏳ 2026-11-14\n  - [x] Step\n';
const NOT_DUE = '- [x] Review ✔ 2026-11-14 09:00 🔁 every week ⏳ 2026-11-14\n';
const OPEN = '- [ ] Call mum\n';
const TEXT = HEAD + DUE + NOT_DUE + OPEN;
const BACK = '- [ ] Water 🔁 every day ⏳ 2026-11-15\n  - [ ] Step\n';

test('brings back the due item and unticks its checklist, leaving every other line', () => {
	expect(planComeBacks(TEXT, 3, now)).toEqual({ count: 1, next: HEAD + BACK + NOT_DUE + OPEN });
});

test('keeps CRLF on every line', () => {
	const crlf = (text: string) => text.replace(/\n/g, '\r\n');
	expect(planComeBacks(crlf(TEXT), 3, now)?.next).toBe(crlf(HEAD + BACK + NOT_DUE + OPEN));
});

test('null when nothing is due', () => {
	expect(planComeBacks(HEAD + NOT_DUE + OPEN, 3, now)).toBeNull();
});

test('brings back a hidden item: archived since its tick, under a heading', () => {
	const weekly = '## Weekly\n- [x] Review ✔ 2026-11-07 09:00 🔁 every week ⏳ 2026-11-07\n';
	expect(planComeBacks(HEAD + OPEN + weekly, 3, now)).toEqual({
		count: 1,
		next: HEAD + OPEN + '## Weekly\n- [ ] Review 🔁 every week ⏳ 2026-11-14\n',
	});
});

test('a card open on the item: a tag typed in its title stays typed once', () => {
	const state = new ListEditing(() => 3);
	state.text = TEXT;
	state.open(3);
	state.focusTitle();
	state.typeTitle('Water #gar');
	const planned = planComeBacks(state.text, 3, now);
	if (!planned) throw new Error('nothing came back');
	state.applyOwn(planned.next, comeBackEdit(state.selected, now));
	state.typeTitle('Water #garden');
	expect(splitLines(state.text)[3]?.text).toBe('- [ ] Water #garden 🔁 every day ⏳ 2026-11-15');
});

test('no card open: the edit moves no line', () => {
	expect(comeBackEdit(null, now)).toBe(NO_LINES_MOVED);
});
