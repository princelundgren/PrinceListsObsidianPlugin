import { describe, expect, test } from 'vitest';
import { followLine, moveEdit, ownEdit, type OwnEdit } from '../../src/core/follow';
import { EditHistory, HISTORY_LIMIT, textEdit } from '../../src/core/history';
import { planItemMove, type PlannedMove } from '../../src/core/list-actions';

const t0 = '- [ ] a\n- [ ] b\n';
const t1 = '- [x] a ✔ 2026-10-22 09:00\n- [ ] b\n';
const t2 = '- [ ] a\n- [ ] b\n- [ ] c\n';
const t3 = '- [ ] b\n';

const tick: OwnEdit = ownEdit(0, t0, t1, 'change');
const s = {};
const s2 = {};

describe('EditHistory', () => {
	test('undo takes the top step back, and redo does it again', () => {
		const history = new EditHistory();
		history.wrote(t0, t1, tick);
		const undo = history.undo(t1);
		expect(undo).toEqual({ next: t0, edit: { start: 0, delta: 0, kind: 'change', history: 'undo' } });
		history.wrote(t1, t0, (undo as { edit: OwnEdit }).edit);
		expect(history.undo(t0)).toBeNull();
		const redo = history.redo(t0);
		expect(redo).toEqual({ next: t1, edit: { start: 0, delta: 0, kind: 'change', history: 'redo' } });
		history.wrote(t0, t1, (redo as { edit: OwnEdit }).edit);
		expect(history.redo(t1)).toBeNull();
		expect(history.undo(t1)?.next).toBe(t0);
	});

	test('a new action empties the redo stack', () => {
		const history = new EditHistory();
		history.wrote(t0, t1, tick);
		history.wrote(t1, t0, { ...textEdit(t1, t0), history: 'undo' });
		history.wrote(t0, t2, textEdit(t0, t2));
		expect(history.redo(t2)).toBeNull();
		expect(history.undo(t2)?.next).toBe(t0);
	});

	test("one session's keystrokes make one step, and another session or a write starts a new one", () => {
		const history = new EditHistory();
		history.typed(s, t0, t1, textEdit(t0, t1));
		history.typed(s, t1, t2, textEdit(t1, t2));
		expect(history.undo(t2)?.next).toBe(t0);
		history.typed(s2, t2, t3, textEdit(t2, t3));
		expect(history.undo(t3)?.next).toBe(t2);

		const interleaved = new EditHistory();
		interleaved.typed(s, t0, t1, textEdit(t0, t1));
		interleaved.wrote(t1, t2, textEdit(t1, t2));
		interleaved.typed(s, t2, t3, textEdit(t2, t3));
		expect(interleaved.undo(t3)?.next).toBe(t2);
		interleaved.wrote(t3, t2, { ...textEdit(t3, t2), history: 'undo' });
		expect(interleaved.undo(t2)?.next).toBe(t1);
		interleaved.wrote(t2, t1, { ...textEdit(t2, t1), history: 'undo' });
		expect(interleaved.undo(t1)?.next).toBe(t0);
	});

	test('a session that ends where it started leaves no step', () => {
		const history = new EditHistory();
		history.wrote(t2, t0, textEdit(t2, t0));
		history.typed(s, t0, t1, textEdit(t0, t1));
		history.typed(s, t1, t0, textEdit(t1, t0));
		expect(history.undo(t0)?.next).toBe(t2);
		history.typed(s, t0, t3, textEdit(t0, t3));
		expect(history.undo(t3)?.next).toBe(t0);
	});

	test('a keystroke after an undo empties the redo stack', () => {
		const history = new EditHistory();
		history.wrote(t0, t1, tick);
		history.wrote(t1, t0, { ...textEdit(t1, t0), history: 'undo' });
		history.typed(s, t0, t2, textEdit(t0, t2));
		expect(history.redo(t2)).toBeNull();
		expect(history.undo(t2)?.next).toBe(t0);
	});

	test('a keystroke that changes nothing keeps the redo stack', () => {
		const history = new EditHistory();
		history.wrote(t0, t1, tick);
		history.wrote(t1, t0, { ...textEdit(t1, t0), history: 'undo' });
		history.typed(s, t0, t0, textEdit(t0, t0));
		expect(history.redo(t0)?.next).toBe(t1);
	});

	test('a cancel that takes its insert back leaves no step', () => {
		const history = new EditHistory();
		history.wrote(t2, t0, textEdit(t2, t0));
		history.wrote(t0, t1, textEdit(t0, t1));
		history.wrote(t1, t0, { ...textEdit(t1, t0), history: 'cancel' });
		expect(history.redo(t0)).toBeNull();
		expect(history.undo(t0)?.next).toBe(t2);
	});

	test("a cancel that doesn't take its insert back exactly clears the history", () => {
		const history = new EditHistory();
		history.wrote(t2, t0, textEdit(t2, t0));
		history.wrote(t0, t1, textEdit(t0, t1));
		history.wrote(t1, t3, { ...textEdit(t1, t3), history: 'cancel' });
		expect(history.undo(t3)).toBeNull();
		expect(history.redo(t3)).toBeNull();
	});

	test("the delete's Undo button is an undo, which can be redone", () => {
		const history = new EditHistory();
		history.wrote(t0, t1, textEdit(t0, t1));
		history.wrote(t1, t0, { ...textEdit(t1, t0), history: 'undo' });
		expect(history.redo(t0)?.next).toBe(t1);
	});

	test('an undo or redo that matches no step is pushed like an action', () => {
		const history = new EditHistory();
		history.wrote(t0, t1, tick);
		history.wrote(t1, t2, { ...textEdit(t1, t2), history: 'undo' });
		expect(history.undo(t2)?.next).toBe(t1);
		history.wrote(t2, t3, { ...textEdit(t2, t3), history: 'redo' });
		expect(history.undo(t3)?.next).toBe(t2);
	});

	test('a write that starts from a text the top step did not leave clears the history first', () => {
		const history = new EditHistory();
		history.wrote(t0, t1, tick);
		history.wrote(t2, t3, textEdit(t2, t3));
		expect(history.undo(t3)?.next).toBe(t2);
		history.wrote(t3, t2, { ...textEdit(t3, t2), history: 'undo' });
		expect(history.undo(t2)).toBeNull();
		expect(history.undo(t1)).toBeNull();
	});

	test('an undo or a keystroke that starts from a text the top step did not leave never jumps over it', () => {
		const undone = new EditHistory();
		undone.wrote(t0, t1, tick);
		undone.wrote(t2, t0, { ...textEdit(t2, t0), history: 'undo' });
		expect(undone.redo(t0)).toBeNull();
		expect(undone.undo(t0)?.next).toBe(t2);

		const typing = new EditHistory();
		typing.typed(s, t0, t1, textEdit(t0, t1));
		typing.typed(s, t2, t3, textEdit(t2, t3));
		expect(typing.undo(t3)?.next).toBe(t2);
	});

	test("undo is null for a text that isn't the top step's after, and clear empties both stacks", () => {
		const history = new EditHistory();
		history.wrote(t0, t1, tick);
		history.wrote(t1, t2, textEdit(t1, t2));
		expect(history.undo(t1)).toBeNull();
		expect(history.undo(t0)).toBeNull();
		history.wrote(t2, t1, { ...textEdit(t2, t1), history: 'undo' });
		expect(history.redo(t2)).toBeNull();
		history.clear();
		expect(history.undo(t1)).toBeNull();
		expect(history.redo(t1)).toBeNull();
	});

	describe('a new item or heading', () => {
		// t0 with an empty item added at line 1, then its title typed.
		const added = '- [ ] a\n- [ ] \n- [ ] b\n';
		const titled = '- [ ] a\n- [ ] milk\n- [ ] b\n';
		const titledMore = '- [ ] a\n- [ ] milk2\n- [ ] b\n';
		const insert: OwnEdit = { ...ownEdit(1, t0, added, 'insert'), history: 'new' };
		const typing = (before: string, after: string) => ownEdit(1, before, after, 'change');

		test('its first typing session joins the step that added it, for undo and redo', () => {
			const history = new EditHistory();
			history.wrote(t0, added, insert);
			history.typed(s, added, titled, typing(added, titled));
			history.typed(s, titled, titledMore, typing(titled, titledMore));
			const undo = history.undo(titledMore);
			expect(undo?.next).toBe(t0);
			history.wrote(titledMore, t0, (undo as { edit: OwnEdit }).edit);
			expect(history.redo(t0)?.next).toBe(titledMore);
		});

		test('its name save joins the step that added it', () => {
			const before = '- [ ] a\n';
			const heading = '- [ ] a\n##\n';
			const named = '- [ ] a\n## Kitchen\n';
			const history = new EditHistory();
			history.wrote(before, heading, { ...ownEdit(1, before, heading, 'insert'), history: 'new' });
			history.wrote(heading, named, ownEdit(1, heading, named, 'change'));
			const undo = history.undo(named);
			expect(undo?.next).toBe(before);
			history.wrote(named, before, (undo as { edit: OwnEdit }).edit);
			expect(history.redo(before)?.next).toBe(named);
		});

		test('only an edit of its own line, with nothing between, joins it', () => {
			const elsewhere = new EditHistory();
			elsewhere.wrote(t0, added, insert);
			const ticked = '- [x] a ✔ 2026-10-22 09:00\n- [ ] \n- [ ] b\n';
			elsewhere.wrote(added, ticked, ownEdit(0, added, ticked, 'change'));
			expect(elsewhere.undo(ticked)?.next).toBe(added);

			const between = new EditHistory();
			between.wrote(t0, added, insert);
			between.typed(s2, added, ticked, ownEdit(0, added, ticked, 'change'));
			const both = '- [x] a ✔ 2026-10-22 09:00\n- [ ] milk\n- [ ] b\n';
			between.typed(s, ticked, both, typing(ticked, both));
			expect(between.undo(both)?.next).toBe(ticked);
		});

		test("one nothing joined can't be redone once undone, since it would come back empty", () => {
			const history = new EditHistory();
			history.wrote(t2, t0, textEdit(t2, t0));
			history.wrote(t0, added, insert);
			history.wrote(added, t0, { ...textEdit(added, t0), history: 'undo' });
			expect(history.redo(t0)).toBeNull();
			expect(history.undo(t0)?.next).toBe(t2);
		});
	});

	test('a session still open when an undo exposes its step starts a new step', () => {
		const history = new EditHistory();
		history.typed(s, t0, t1, textEdit(t0, t1));
		history.wrote(t1, t2, textEdit(t1, t2));
		history.wrote(t2, t1, { ...textEdit(t2, t1), history: 'undo' });
		history.typed(s, t1, t3, textEdit(t1, t3));
		expect(history.undo(t3)?.next).toBe(t1);
	});

	test('a session still open when a cancel exposes its step starts a new step', () => {
		const history = new EditHistory();
		history.typed(s, t0, t1, textEdit(t0, t1));
		history.wrote(t1, t2, textEdit(t1, t2));
		history.wrote(t2, t1, { ...textEdit(t2, t1), history: 'cancel' });
		history.typed(s, t1, t3, textEdit(t1, t3));
		expect(history.undo(t3)?.next).toBe(t1);
	});

	test(`keeps the last ${HISTORY_LIMIT} steps`, () => {
		const history = new EditHistory();
		const texts = Array.from({ length: HISTORY_LIMIT + 2 }, (_, i) => `- [ ] ${i}\n`);
		for (let i = 0; i <= HISTORY_LIMIT; i++) history.wrote(texts[i] as string, texts[i + 1] as string, textEdit(texts[i] as string, texts[i + 1] as string));
		let text = texts[HISTORY_LIMIT + 1] as string;
		for (let i = 0; i < HISTORY_LIMIT; i++) {
			const undo = history.undo(text);
			expect(undo, `undo ${i + 1}`).not.toBeNull();
			history.wrote(text, (undo as { next: string }).next, (undo as { edit: OwnEdit }).edit);
			text = (undo as { next: string }).next;
		}
		expect(text).toBe(texts[1]);
		expect(history.undo(text)).toBeNull();
	});

	test("a move's undo takes each line back where it came from, and its redo moves them again", () => {
		const text = '- [ ] a\n- [ ] b\n- [ ] c\n';
		const moved = planItemMove(text, 0, 2, 'first') as PlannedMove;
		expect(moved.edit).toEqual(moveEdit([1, 2, 0]));
		const history = new EditHistory();
		history.wrote(text, moved.next, moved.edit);
		const undo = history.undo(moved.next);
		expect(undo?.next).toBe(text);
		const back = (undo as { edit: OwnEdit }).edit;
		expect(back).toMatchObject({ kind: 'move', history: 'undo' });
		expect([0, 1, 2].map((line) => followLine(line, back))).toEqual([2, 0, 1]);
		history.wrote(moved.next, text, back);
		const redo = history.redo(text);
		expect(redo?.next).toBe(moved.next);
		const again = (redo as { edit: OwnEdit }).edit;
		expect(again).toMatchObject({ kind: 'move', history: 'redo' });
		expect([0, 1, 2].map((line) => followLine(line, again))).toEqual([1, 2, 0]);
	});

	test('a line the move added maps to null in its undo', () => {
		const history = new EditHistory();
		const before = '- [ ] a\n- [ ] b\n';
		const after = '- [ ] b\n\n- [ ] a\n';
		history.wrote(before, after, moveEdit([2, 0]));
		const back = (history.undo(after) as { edit: OwnEdit }).edit;
		expect([0, 1, 2].map((line) => followLine(line, back))).toEqual([1, null, 0]);
	});
});

describe('textEdit', () => {
	test('runs from the first line where the texts differ, as an insert, a delete or a change', () => {
		expect(textEdit(t0, t2)).toEqual({ start: 2, delta: 1, kind: 'insert' });
		expect(textEdit(t2, t0)).toEqual({ start: 2, delta: -1, kind: 'delete' });
		expect(textEdit(t0, t1)).toEqual({ start: 0, delta: 0, kind: 'change' });
	});

	test("a line whose ending is all that changed isn't where the run starts", () => {
		expect(textEdit('- [ ] a', '- [ ] a\n- [ ] b')).toEqual({ start: 1, delta: 1, kind: 'insert' });
	});
});
