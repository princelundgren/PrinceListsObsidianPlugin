import { describe, expect, test } from 'vitest';
import { planGroupDuplicate } from '../../src/core/duplicate';
import { followLine } from '../../src/core/follow';
import { EditHistory } from '../../src/core/history';

const FRONT = '---\nprincelists: true\n---\n';
const body = (t: string | undefined) => t?.slice(FRONT.length);

describe('planGroupDuplicate', () => {
	test('copies an item with its notes right below it', () => {
		const text = FRONT + '- [ ] a\n  note\n- [ ] b\n';
		const plan = planGroupDuplicate(text, 3, [3]);
		expect(body(plan?.next)).toBe('- [ ] a\n  note\n- [ ] a\n  note\n- [ ] b\n');
		expect(plan?.copies).toEqual([5]);
	});

	test('puts each copy below its own item, and maps every line to where it went', () => {
		const text = FRONT + '- [ ] a\n- [ ] b\n- [ ] c\n';
		const plan = planGroupDuplicate(text, 3, [5, 3]);
		expect(body(plan?.next)).toBe('- [ ] a\n- [ ] a\n- [ ] b\n- [ ] c\n- [ ] c\n');
		expect(plan?.copies).toEqual([4, 7]);
		expect([3, 4, 5].map((line) => followLine(line, plan!.edit))).toEqual([3, 5, 6]);
	});

	test('unticks a copy of a ticked item, dropping its done marks', () => {
		const text = FRONT + '- [x] a ✔ 2026-11-01 10:00 ✅ 2026-11-01\n';
		expect(body(planGroupDuplicate(text, 3, [3])?.next)).toBe('- [x] a ✔ 2026-11-01 10:00 ✅ 2026-11-01\n- [ ] a\n');
	});

	test('keeps the star, date, repeat and tags, but not a block id or a Tasks id', () => {
		const text = FRONT + '- [ ] a ⭐ 🔁 every week ⏳ 2026-11-20 🆔 abc #home ^b1\n  note ^n1\n';
		expect(body(planGroupDuplicate(text, 3, [3])?.next)).toBe(
			'- [ ] a ⭐ 🔁 every week ⏳ 2026-11-20 🆔 abc #home ^b1\n  note ^n1\n- [ ] a ⭐ 🔁 every week ⏳ 2026-11-20 #home\n  note\n',
		);
	});

	test('drops a block id on a line of its own, and the blank line it leaves at the end', () => {
		expect(body(planGroupDuplicate(FRONT + '- [ ] a\n  ^n1\n- [ ] b\n', 3, [3])?.next)).toBe('- [ ] a\n  ^n1\n- [ ] a\n- [ ] b\n');
		const table = '- [ ] a\n\t| x |\n\t|---|\n\n\t^tbl\n';
		expect(body(planGroupDuplicate(FRONT + table, 3, [3])?.next)).toBe(table + '- [ ] a\n\t| x |\n\t|---|\n');
	});

	test('keeps an item whose title is only an id an item', () => {
		expect(body(planGroupDuplicate(FRONT + '- [ ] ^abc\n', 3, [3])?.next)).toBe('- [ ] ^abc\n- [ ] \n');
		expect(body(planGroupDuplicate(FRONT + '- [ ] 🆔 abc\n', 3, [3])?.next)).toBe('- [ ] 🆔 abc\n- [ ] \n');
	});

	test('takes off only the Tasks id field, wherever it sits among the fields', () => {
		expect(body(planGroupDuplicate(FRONT + '- [ ] see 🆔 abc docs\n', 3, [3])?.next)).toBe('- [ ] see 🆔 abc docs\n- [ ] see 🆔 abc docs\n');
		expect(body(planGroupDuplicate(FRONT + '- [ ] a 🆔 abc⛔ xyz\n', 3, [3])?.next)).toBe('- [ ] a 🆔 abc⛔ xyz\n- [ ] a ⛔ xyz\n');
	});

	test('takes the Tasks id off a sub-task in the notes, but leaves a code block as it is', () => {
		const text = FRONT + '- [ ] a\n  - [ ] sub 🆔 x1\n  ```\n  code ^x\n  ```\n';
		expect(body(planGroupDuplicate(text, 3, [3])?.next)).toBe(
			'- [ ] a\n  - [ ] sub 🆔 x1\n  ```\n  code ^x\n  ```\n- [ ] a\n  - [ ] sub\n  ```\n  code ^x\n  ```\n',
		);
	});

	test('copies a loose item without the blank line after it', () => {
		const text = FRONT + '- [ ] a\n\n  note\n\n- [ ] b\n';
		expect(body(planGroupDuplicate(text, 3, [3])?.next)).toBe('- [ ] a\n\n  note\n- [ ] a\n\n  note\n\n- [ ] b\n');
	});

	test('keeps a file without a final newline that way, and its CRLF endings', () => {
		const front = FRONT.replace(/\n/g, '\r\n');
		const text = front + '- [ ] a\r\n- [ ] b';
		expect(planGroupDuplicate(text, 3, [4])?.next).toBe(front + '- [ ] a\r\n- [ ] b\r\n- [ ] b');
	});

	test('copies nothing when a heading is among the rows', () => {
		const text = FRONT + '## H\n- [ ] a\n';
		expect(planGroupDuplicate(text, 3, [3, 4])).toBeNull();
	});

	test('undoes with the copies gone and every other line back in its place', () => {
		const text = FRONT + '- [ ] a\n  note\n- [ ] b\n';
		const plan = planGroupDuplicate(text, 3, [3, 5])!;
		const history = new EditHistory();
		history.wrote(text, plan.next, plan.edit);
		const undo = history.undo(plan.next)!;
		expect([3, 4, 5, 6, 7, 8].map((line) => followLine(line, undo.edit))).toEqual([3, 4, null, null, 5, null]);
	});
});
