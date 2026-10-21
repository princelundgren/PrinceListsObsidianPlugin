import { describe, expect, test } from 'vitest';
import { UnsafeEditError } from '../../src/core/edit-check';
import { insertItem, setItemNotes, toggleItem } from '../../src/core/edit-items';
import { ListEditing } from '../../src/core/editing';
import { isEmptyItem, planRemoval } from '../../src/core/empty-item';
import { joinLines, splitLines } from '../../src/core/lines';
import { contentStartOf, list } from './edit-helpers';

const FRONTMATTER = '---\nprincelists: true\n---\n';

// Inserts an empty item as "+" does, and records the texts on either side of the insert.
function insertEmpty(text: string, after: number | null) {
	const { lines, model, item } = list(text);
	const inserted = insertItem(lines, model, after === null ? null : item(after), '');
	const textAfter = joinLines(inserted.lines);
	return { titleLine: inserted.titleLine, inserted: { textBefore: text, textAfter } };
}

const plan = (text: string, titleLine: number, inserted: { textBefore: string; textAfter: string }, restore = true) =>
	planRemoval(text, contentStartOf(splitLines(text)), titleLine, inserted, restore);

describe('isEmptyItem', () => {
	test.each([
		['- [ ] \n', true],
		['- [ ]  \n', true],
		['- [ ] a\n', false],
		// A typed tag or date reads as the tail, but it was typed, so the item isn't empty.
		['- [ ] #tag\n', false],
		['- [ ] 📅 2026-10-30\n', false],
		['- [ ] \n\n\tnote\n', false],
	])('%j: %s', (text, empty) => {
		const { lines, item } = list(text);
		expect(isEmptyItem(lines, item(0))).toBe(empty);
	});
});

describe('planRemoval', () => {
	test('restores the text from before the insert while nothing changed since, taking the empty line it wrote', () => {
		// Below a's notes, Text would join the new item as a lazy line, so the insert writes an empty line.
		const text = `${FRONTMATTER}- [ ] a\n\n\t\`\`\`\n\tx\n\t\`\`\`\nText\n`;
		const { titleLine, inserted } = insertEmpty(text, 0);
		expect(inserted.textAfter).toBe(`${FRONTMATTER}- [ ] a\n\n\t\`\`\`\n\tx\n\t\`\`\`\n- [ ] \n\nText\n`);
		const removal = plan(inserted.textAfter, titleLine, inserted);
		expect(removal?.next).toBe(text);
		expect(removal?.expected).toBe(inserted.textAfter);
		expect(removal?.edit).toEqual({ start: titleLine, delta: -2, kind: 'delete' });
	});

	test('deletes the item from the current text when something else changed since', () => {
		const text = `${FRONTMATTER}- [ ] a\n- [ ] b\n`;
		const { titleLine, inserted } = insertEmpty(text, null);
		const { lines, item } = list(inserted.textAfter);
		const ticked = joinLines(toggleItem(lines, item(2), new Date(2026, 9, 21, 9, 0)));
		const removal = plan(ticked, titleLine, inserted);
		expect(removal?.next).toBe(`${FRONTMATTER}- [ ] a\n- [x] b ✔ 2026-10-21 09:00\n`);
		expect(removal?.expected).toBe(ticked);
		expect(removal?.edit).toEqual({ start: titleLine, delta: -1, kind: 'delete' });
	});

	test('deletes rather than restores when told to, after the restore was refused', () => {
		const text = `${FRONTMATTER}- [ ] a\n`;
		const { titleLine, inserted } = insertEmpty(text, 0);
		expect(plan(inserted.textAfter, titleLine, inserted, false)?.next).toBe(text);
	});

	test('keeps an item whose title or notes were typed', () => {
		const text = `${FRONTMATTER}- [ ] a\n`;
		const { titleLine, inserted } = insertEmpty(text, 0);
		expect(plan(`${FRONTMATTER}- [ ] a\n- [ ] typed\n`, titleLine, inserted)).toBeNull();
		const { lines, model, item } = list(inserted.textAfter);
		const noted = joinLines(setItemNotes(lines, model, item(1), 'a note'));
		expect(plan(noted, titleLine, inserted)).toBeNull();
	});

	test('finds nothing to remove where no item is on that line', () => {
		const text = `${FRONTMATTER}- [ ] a\n`;
		const { inserted } = insertEmpty(text, 0);
		expect(plan(inserted.textAfter, 2, inserted)).toBeNull();
	});

	test('throws when deleting it would change how the rest reads', () => {
		// Text indented to the first item's content column would join it once the empty item goes.
		const text = `${FRONTMATTER}- [ ] z\n1. [ ] \n\n  Text\n`;
		const inserted = { textBefore: `${FRONTMATTER}- [ ] z\n\n  Text\n`, textAfter: 'changed since' };
		expect(() => plan(text, 4, inserted)).toThrow(UnsafeEditError);
	});
});

// The view's empty-item removal: typing that lands in the list note while the restore waits to
// write refuses it, and the fallback deletes the item from the text with the typing in it.
test('after typing refused the restore, the item is deleted from the typed text, at its followed line', () => {
	const text = `${FRONTMATTER}- [ ] a\n`;
	const { titleLine, inserted } = insertEmpty(text, 0);
	const state = new ListEditing((t) => contentStartOf(splitLines(t)));
	state.text = inserted.textAfter;
	const pending = state.track(titleLine);
	expect(plan(state.text, titleLine, inserted)?.next).toBe(text);
	state.openListNote();
	state.typeListNote('Typed');
	const fallback = plan(state.text, pending.line as number, inserted, false);
	expect(fallback?.next).toBe(`${FRONTMATTER}Typed\n\n- [ ] a\n`);
	expect(fallback?.expected).toBe(state.text);
});
