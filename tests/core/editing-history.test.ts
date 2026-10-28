import { describe, expect, test } from 'vitest';
import { ListEditing, type Typed } from '../../src/core/editing';
import { isEmptyItem } from '../../src/core/empty-item';
import { ownEdit, type OwnEdit } from '../../src/core/follow';
import { planItemInsert, type PlannedInsert } from '../../src/core/list-actions';
import { splitLines } from '../../src/core/lines';
import { contentStartOf, list } from './edit-helpers';

const FRONTMATTER = '---\nprincelists: true\n---\n';

function editing(text: string): ListEditing {
	const state = new ListEditing((t) => contentStartOf(splitLines(t)));
	state.text = text;
	return state;
}

// Each keystroke types the field's whole value so far, as the view passes the textarea's value.
function typeEach(type: (value: string) => Typed, values: readonly string[]): Typed[] {
	return values.map((value) => type(value));
}

describe('the undo history', () => {
	const text = `${FRONTMATTER}- [ ] a\n- [ ] b\n`;

	test('an own write records a step', () => {
		const state = editing(text);
		const ticked = `${FRONTMATTER}- [x] a ✔ 2026-10-21 09:00\n- [ ] b\n`;
		state.applyOwn(ticked, ownEdit(3, text, ticked, 'change'));
		expect(state.history.undo(state.text)?.next).toBe(text);
	});

	test("one session's keystrokes make one step, and the next session another", () => {
		const state = editing(text);
		state.open(4);
		state.focusTitle();
		typeEach((v) => state.typeTitle(v), ['bu', 'buy', 'buy milk']);
		state.blurTitle();
		const typed = state.text;
		state.focusTitle();
		state.typeTitle('buy milk!');
		const undo = state.history.undo(state.text);
		expect(undo?.next).toBe(typed);
		state.applyOwn(typed, (undo as { edit: OwnEdit }).edit);
		expect(state.history.undo(state.text)?.next).toBe(text);
	});

	test("the notes' and the list note's keystrokes make a step for each session", () => {
		const state = editing(text);
		state.open(4);
		state.openNotesPiece({ start: 5, end: 5 }, true);
		typeEach((v) => state.typeNotesPiece(v), ['n', 'no', 'note']);
		state.closeNotes();
		const noted = state.text;
		state.openListNote({ start: 3, end: 3 }, false);
		typeEach((v) => state.typeListNote(v), ['L', 'Li', 'List']);
		const undo = state.history.undo(state.text);
		expect(undo?.next).toBe(noted);
		state.applyOwn(noted, (undo as { edit: OwnEdit }).edit);
		expect(state.history.undo(state.text)?.next).toBe(text);
	});

	test('an outside change clears it', () => {
		const state = editing(text);
		const ticked = `${FRONTMATTER}- [x] a ✔ 2026-10-21 09:00\n- [ ] b\n`;
		state.applyOwn(ticked, ownEdit(3, text, ticked, 'change'));
		const synced = `${ticked}- [ ] c\n`;
		state.outsideChange(synced);
		expect(state.history.undo(synced)).toBeNull();
		expect(state.history.undo(ticked)).toBeNull();
	});

	test('a reset, for another file, clears it', () => {
		const state = editing(text);
		const ticked = `${FRONTMATTER}- [x] a ✔ 2026-10-21 09:00\n- [ ] b\n`;
		state.applyOwn(ticked, ownEdit(3, text, ticked, 'change'));
		state.reset();
		expect(state.history.undo(ticked)).toBeNull();
	});

	// "+", a title typed, the card closed: then Cmd+Z, Cmd+Z and Cmd+Shift+Z. The card is gone, so a
	// second Cmd+Z pressed before the first lands is a history undo too.
	test('undo and redo never leave an empty new item without its card', () => {
		const state = editing(text);
		const ticked = `${FRONTMATTER}- [x] a ✔ 2026-10-21 09:00\n- [ ] b\n`;
		state.applyOwn(ticked, ownEdit(3, text, ticked, 'change'));
		const added = planItemInsert(state.text, 3, { after: 4 }) as PlannedInsert;
		state.applyOwn(added.next, added.edit);
		state.open(added.line);
		state.focusTitle();
		typeEach((v) => state.typeTitle(v), ['m', 'mi', 'milk']);
		state.blurTitle();
		state.close();
		const milk = state.text;
		const hasEmptyItem = () => list(state.text).items.some((item) => isEmptyItem(splitLines(state.text), item));
		const step = (write: { next: string; edit: OwnEdit } | null) => {
			expect(write).not.toBeNull();
			state.applyOwn((write as { next: string }).next, (write as { edit: OwnEdit }).edit);
			expect(hasEmptyItem(), state.text).toBe(false);
		};
		step(state.history.undo(state.text));
		expect(state.text).toBe(ticked);
		step(state.history.undo(state.text));
		expect(state.text).toBe(text);
		step(state.history.redo(state.text));
		step(state.history.redo(state.text));
		expect(state.text).toBe(milk);
	});
});
