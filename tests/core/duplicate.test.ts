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
		expect(plan?.copied).toBe(1);
	});

	test('puts each copy below its own item, and maps every line to where it went', () => {
		const text = FRONT + '- [ ] a\n- [ ] b\n- [ ] c\n';
		const plan = planGroupDuplicate(text, 3, [5, 3]);
		expect(body(plan?.next)).toBe('- [ ] a\n- [ ] a\n- [ ] b\n- [ ] c\n- [ ] c\n');
		expect(plan?.copied).toBe(2);
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

	test('drops a block id on a line of its own with one of the blank lines around it', () => {
		const table = '- [ ] a\n  | x |\n  |---|\n\n  ^tbl\n\n  more\n';
		expect(body(planGroupDuplicate(FRONT + table, 3, [3])?.next)).toBe(table + '- [ ] a\n  | x |\n  |---|\n\n  more\n');
		const list = '- [ ] a\n  note\n\n  ^n1\n  - [ ] sub\n';
		expect(body(planGroupDuplicate(FRONT + list, 3, [3])?.next)).toBe(list + '- [ ] a\n  note\n\n  - [ ] sub\n');
	});

	test('drops a block id on a quote line of its own, and the empty quote line above it', () => {
		const quote = '- [ ] a\n  > quote\n  >\n  > ^q1\n';
		expect(body(planGroupDuplicate(FRONT + quote, 3, [3])?.next)).toBe(quote + '- [ ] a\n  > quote\n');
	});

	test('keeps an item whose title is only an id an item', () => {
		expect(body(planGroupDuplicate(FRONT + '- [ ] ^abc\n', 3, [3])?.next)).toBe('- [ ] ^abc\n- [ ] \n');
		expect(body(planGroupDuplicate(FRONT + '- [ ] 🆔 abc\n', 3, [3])?.next)).toBe('- [ ] 🆔 abc\n- [ ] \n');
	});

	test('takes off only the Tasks id field, wherever it sits among the fields', () => {
		expect(body(planGroupDuplicate(FRONT + '- [ ] see 🆔 abc docs\n', 3, [3])?.next)).toBe('- [ ] see 🆔 abc docs\n- [ ] see 🆔 abc docs\n');
		expect(body(planGroupDuplicate(FRONT + '- [ ] a 🆔 abc⛔ xyz\n', 3, [3])?.next)).toBe('- [ ] a 🆔 abc⛔ xyz\n- [ ] a ⛔ xyz\n');
		expect(body(planGroupDuplicate(FRONT + '- [ ] 🆔 abc #home\n', 3, [3])?.next)).toBe('- [ ] 🆔 abc #home\n- [ ] #home\n');
		const subTask = '- [ ] a\n  - [ ] 🆔 x1 ^s1\n    more\n';
		expect(body(planGroupDuplicate(FRONT + subTask, 3, [3])?.next)).toBe(subTask + '- [ ] a\n  - [ ] ^s1\n    more\n');
	});

	test("drops from the copy's ⛔ fields the ids its own 🆔 fields lost, and a ⛔ left empty", () => {
		const text = FRONT + '- [ ] a ⛔ x2,out\n  - [ ] s1 🆔 x1\n  - [ ] s2 🆔 x2 ⛔ x1\n  - [ ] s3 ⛔ out\n';
		expect(body(planGroupDuplicate(text, 3, [3])?.next)).toBe(
			text.slice(FRONT.length) + '- [ ] a ⛔ out\n  - [ ] s1\n  - [ ] s2\n  - [ ] s3 ⛔ out\n',
		);
		const selectors = FRONT + '- [ ] a \u{1f194}\ufe0f x1\n  - [ ] s \u26d4\ufe0f x1,y\n';
		expect(body(planGroupDuplicate(selectors, 3, [3])?.next)).toBe(
			selectors.slice(FRONT.length) + '- [ ] a\n  - [ ] s \u26d4\ufe0f y\n',
		);
	});

	test('keeps a block id the same way on item lines and notes lines', () => {
		const text = FRONT + '- [ ] a\t^b1\n  note\t^n1\n  - [ ] s\t^s1\n';
		expect(body(planGroupDuplicate(text, 3, [3])?.next)).toBe(text.slice(FRONT.length).repeat(2));
	});

	test('takes a block id off only the end of a block, where Obsidian reads one', () => {
		const text = FRONT + '- [ ] a\n  raise 2 ^10\n  and more ^p1\n';
		expect(body(planGroupDuplicate(text, 3, [3])?.next)).toBe(text.slice(FRONT.length) + '- [ ] a\n  raise 2 ^10\n  and more\n');
	});

	test('takes a block id off a sub-task only where it ends its paragraph', () => {
		const text = FRONT + '- [ ] a\n  - [ ] s raise 2 ^10\n    and more\n  - [ ] t ^t1\n';
		expect(body(planGroupDuplicate(text, 3, [3])?.next)).toBe(
			text.slice(FRONT.length) + '- [ ] a\n  - [ ] s raise 2 ^10\n    and more\n  - [ ] t\n',
		);
	});

	test('takes the block id off a paragraph right above a table', () => {
		const table = '  | x | y |\n  |---|---|\n  | 1 | 2 |\n';
		const text = FRONT + '- [ ] a\n  intro ^p1\n' + table;
		expect(body(planGroupDuplicate(text, 3, [3])?.next)).toBe(text.slice(FRONT.length) + '- [ ] a\n  intro\n' + table);
	});

	test('takes the block id off a paragraph right above a table in a quote', () => {
		const table = '  > | x | y |\n  > |---|---|\n';
		const text = FRONT + '- [ ] a\n  > intro ^p1\n' + table;
		expect(body(planGroupDuplicate(text, 3, [3])?.next)).toBe(text.slice(FRONT.length) + '- [ ] a\n  > intro\n' + table);
	});

	test("keeps a block id in a quoted table's last row, where it is a cell's text", () => {
		for (const row of ['  > | 1 | 2 | ^t1\n', '  > | 1 | 2 ^t1\n']) {
			const table = '  > | x | y |\n  > |---|---|\n' + row;
			const text = FRONT + '- [ ] a\n' + table;
			expect(body(planGroupDuplicate(text, 3, [3])?.next)).toBe(text.slice(FRONT.length).repeat(2));
			const withIntro = FRONT + '- [ ] a\n  > intro ^p1\n' + table;
			expect(body(planGroupDuplicate(withIntro, 3, [3])?.next)).toBe(withIntro.slice(FRONT.length) + '- [ ] a\n  > intro\n' + table);
		}
	});

	test('takes the block id off the text line of an underlined heading, as off a # heading', () => {
		const underlined = FRONT + '- [ ] a\n  Title ^h1\n  ---\n';
		expect(body(planGroupDuplicate(underlined, 3, [3])?.next)).toBe(underlined.slice(FRONT.length) + '- [ ] a\n  Title\n  ---\n');
		const marked = FRONT + '- [ ] a\n  ## Title ^h1\n';
		expect(body(planGroupDuplicate(marked, 3, [3])?.next)).toBe(marked.slice(FRONT.length) + '- [ ] a\n  ## Title\n');
	});

	test('keeps a block id whose removal would turn its line into an underline or a rule', () => {
		for (const notes of ['  Title\n  --- ^h1\n', '  Title\n  === ^h1\n', '  *** ^x\n', '  > Title\n  > - - - ^q\n']) {
			const text = FRONT + '- [ ] a\n' + notes;
			expect(body(planGroupDuplicate(text, 3, [3])?.next)).toBe(text.slice(FRONT.length).repeat(2));
		}
	});

	test('takes the Tasks id off a sub-task in the notes, but leaves a code block as it is', () => {
		const text = FRONT + '- [ ] a\n  - [ ] sub 🆔 x1\n  ```\n  code ^x\n  ```\n';
		expect(body(planGroupDuplicate(text, 3, [3])?.next)).toBe(
			'- [ ] a\n  - [ ] sub 🆔 x1\n  ```\n  code ^x\n  ```\n- [ ] a\n  - [ ] sub\n  ```\n  code ^x\n  ```\n',
		);
		const quoted = FRONT + '- [ ] a\n  > ```\n  > code ^x\n  > ```\n';
		expect(body(planGroupDuplicate(quoted, 3, [3])?.next)).toBe(quoted.slice(FRONT.length).repeat(2));
	});

	test("unticks the copy's checklist, as a repeat does, but not a box in a code block", () => {
		const text = FRONT + '- [x] a\n  - [x] flour\n  - [ ] eggs\n  ```\n  - [x] code\n  ```\n';
		expect(body(planGroupDuplicate(text, 3, [3])?.next)).toBe(
			'- [x] a\n  - [x] flour\n  - [ ] eggs\n  ```\n  - [x] code\n  ```\n- [ ] a\n  - [ ] flour\n  - [ ] eggs\n  ```\n  - [x] code\n  ```\n',
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
