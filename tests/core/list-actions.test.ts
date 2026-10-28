import { describe, expect, test } from 'vitest';
import { UnsafeEditError } from '../../src/core/edit-check';
import { followLine, type OwnEdit } from '../../src/core/follow';
import { headingText } from '../../src/core/display';
import { EditHistory } from '../../src/core/history';
import {
	endOfSection,
	planHeadingDelete,
	planHeadingInsert,
	planItemDelete,
	planItemInsert,
	planItemLineEdit,
	planItemMove,
	sectionLastLine,
	type ItemPlace,
	type PlannedDelete,
} from '../../src/core/list-actions';
import { splitLines } from '../../src/core/lines';
import { contentStartOf, crlf, FIXTURES, JOINING_CASES, list, readFixture, REFUSED_CASES } from './edit-helpers';

const FRONTMATTER = '---\nprincelists: true\n---\n';
const start = (text: string) => contentStartOf(splitLines(text));

const ALL_CASES: Record<string, string> = {
	twoSections: `${FRONTMATTER}Note\n\n- [ ] a\n\n\tnotes\n- [x] b ✔ 2026-01-01 10:00\n## H\n- [ ] c\n\n## Empty\n\nText\n`,
	noFinalNewline: '## G\n- [ ] a',
	setextHeading: 'Kitchen\n===\n- [ ] a\n',
	...JOINING_CASES,
	...REFUSED_CASES,
	...Object.fromEntries(FIXTURES.map((name) => [name, readFixture(name)])),
};

// Every item title and heading line, as the view's rows, selection and tracked lines point at them.
function anchors(text: string): number[] {
	const { model } = list(text);
	return model.sections.flatMap((s) => [...(s.headingLine === null ? [] : [s.headingLine]), ...s.items.map((i) => i.titleLine)]);
}

// Each anchor of `before` but `gone`, followed through `edit`, holds the same text in `after`.
function expectFollowed(before: string, after: string, edit: OwnEdit, gone: number | null = null) {
	const old = splitLines(before);
	const now = splitLines(after);
	for (const line of anchors(before)) {
		const followed = followLine(line, edit);
		if (line === gone) {
			expect(followed, `line ${line}`).toBeNull();
			continue;
		}
		expect(followed, `line ${line}`).not.toBeNull();
		expect(now[followed as number]?.text, `line ${line}`).toBe(old[line]?.text);
	}
}

const refusedOrRun = <T>(edit: () => T): T | 'refused' => {
	try {
		return edit();
	} catch (error) {
		if (error instanceof UnsafeEditError) return 'refused';
		throw error;
	}
};

describe('planItemInsert', () => {
	test('first goes before the first item, and opens with an empty title', () => {
		const text = `${FRONTMATTER}Note\n\n- [ ] a\n## H\n- [ ] b\n`;
		const planned = planItemInsert(text, 3, 'first');
		expect(planned?.next).toBe(`${FRONTMATTER}Note\n\n- [ ] \n- [ ] a\n## H\n- [ ] b\n`);
		expect(planned?.line).toBe(5);
		expect(planned?.inserted).toEqual({ textBefore: text, textAfter: planned?.next });
		expect(planned?.edit).toEqual({ start: 5, delta: 1, kind: 'insert', history: 'new' });
	});
	test('first in a list without items goes before the first heading, or at the end', () => {
		expect(planItemInsert(`${FRONTMATTER}## H\n`, 3, 'first')?.next).toBe(`${FRONTMATTER}- [ ] \n## H\n`);
		expect(planItemInsert(FRONTMATTER, 3, 'first')?.next).toBe(`${FRONTMATTER}- [ ] \n`);
	});
	test('after an item goes right below its notes, before a hidden done item after it', () => {
		const text = '- [ ] a\n\n\tnotes\n- [x] b ✔ 2026-01-01 10:00\n';
		const planned = planItemInsert(text, 0, { after: 0 });
		expect(planned?.next).toBe('- [ ] a\n\n\tnotes\n- [ ] \n- [x] b ✔ 2026-01-01 10:00\n');
		expect(planned?.line).toBe(3);
	});
	test('first under a heading goes before its first item, or after its content when it has none', () => {
		expect(planItemInsert('## H\n- [ ] a\n', 0, { firstUnder: 0 })?.next).toBe('## H\n- [ ] \n- [ ] a\n');
		expect(planItemInsert('## H\n\nText\n\n## K\n', 0, { firstUnder: 0 })?.next).toBe('## H\n\nText\n- [ ] \n\n## K\n');
	});
	test('writes the file ending and keeps a missing final newline', () => {
		expect(planItemInsert(crlf('- [ ] a\n'), 0, { after: 0 })?.next).toBe(crlf('- [ ] a\n- [ ] \n'));
		expect(planItemInsert('- [ ] a', 0, { after: 0 })?.next).toBe('- [ ] a\n- [ ] ');
	});
	test('null when no item or heading is on the line any more', () => {
		expect(planItemInsert('Note\n\n- [ ] a\n', 0, { after: 0 })).toBeNull();
		expect(planItemInsert('Note\n\n- [ ] a\n', 0, { firstUnder: 2 })).toBeNull();
	});
	test('at every place, the new item is empty, the texts on either side are recorded and every line follows, or it is refused', () => {
		for (const [name, text] of Object.entries(ALL_CASES)) {
			const { model, items } = list(text);
			const places: ItemPlace[] = [
				'first',
				...items.map((item) => ({ after: item.titleLine })),
				...model.sections.flatMap((s) => (s.headingLine === null ? [] : [{ firstUnder: s.headingLine }])),
			];
			for (const place of places) {
				const planned = refusedOrRun(() => planItemInsert(text, start(text), place));
				if (planned === 'refused') continue;
				const where = `${name} ${JSON.stringify(place)}`;
				expect(planned, where).not.toBeNull();
				if (!planned) continue;
				expect(planned.inserted, where).toEqual({ textBefore: text, textAfter: planned.next });
				expect(splitLines(planned.next)[planned.line]?.text, where).toBe('- [ ] ');
				expect(list(planned.next).items.some((item) => item.titleLine === planned.line), where).toBe(true);
				expectFollowed(text, planned.next, planned.edit);
			}
		}
	});
	test('refuses a place where the new item would change how the rest reads', () => {
		expect(() => planItemInsert(REFUSED_CASES.divInEmptySection, 0, { firstUnder: 0 })).toThrow(UnsafeEditError);
	});
});

describe('planHeadingInsert', () => {
	test('after an item, an empty heading goes right below it and takes the items after it', () => {
		const text = '- [ ] a\n- [ ] b\n';
		const planned = planHeadingInsert(text, 0, { afterItem: 0 });
		expect(planned?.next).toBe('- [ ] a\n##\n- [ ] b\n');
		expect(planned?.line).toBe(1);
		expect(planned?.edit).toEqual({ start: 1, delta: 1, kind: 'insert', history: 'new' });
	});
	test("after a section, it goes after the section's hidden rows and content", () => {
		const text = '## G\n- [ ] a\n- [x] b ✔ 2026-01-01 10:00\n\nText\n\n## K\n';
		expect(planHeadingInsert(text, 0, { afterSection: 0 })?.next).toBe('## G\n- [ ] a\n- [x] b ✔ 2026-01-01 10:00\n\nText\n##\n\n## K\n');
	});
	test("at 'top', it goes after the part before the first heading, or at the end of a list without one", () => {
		expect(planHeadingInsert('- [ ] a\n## H\n- [ ] b\n', 0, 'top')?.next).toBe('- [ ] a\n##\n## H\n- [ ] b\n');
		expect(planHeadingInsert('- [ ] a\n- [ ] b\n', 0, 'top')?.next).toBe('- [ ] a\n- [ ] b\n##\n');
	});
	test('null when no item or heading is on the line any more', () => {
		expect(planHeadingInsert('Note\n\n- [ ] a\n', 0, { afterItem: 0 })).toBeNull();
		expect(planHeadingInsert('- [ ] a\n', 0, { afterSection: 0 })).toBeNull();
	});
	test('at every place, the new heading is empty and every line follows, or it is refused', () => {
		for (const [name, text] of Object.entries(ALL_CASES)) {
			const { model, items } = list(text);
			const places = [
				...items.map((item) => ({ afterItem: item.titleLine })),
				...model.sections.flatMap((s) => (s.headingLine === null ? [] : [{ afterSection: s.headingLine }])),
			];
			for (const place of places) {
				const planned = refusedOrRun(() => planHeadingInsert(text, start(text), place));
				if (planned === 'refused') continue;
				const where = `${name} ${JSON.stringify(place)}`;
				expect(planned, where).not.toBeNull();
				if (!planned) continue;
				expect(planned.inserted, where).toEqual({ textBefore: text, textAfter: planned.next });
				const after = splitLines(planned.next);
				expect(list(planned.next).model.sections.some((s) => s.headingLine === planned.line), where).toBe(true);
				expect(headingText(after, planned.line), where).toBe('');
				expectFollowed(text, planned.next, planned.edit);
			}
		}
	});
});

describe('endOfSection', () => {
	test('after the last item, first under a heading with none, or first in a top part with none', () => {
		const { section } = list('- [ ] a\n- [ ] b\n## H\n## K\n- [ ] c\n');
		expect(endOfSection(section(0))).toEqual({ after: 1 });
		expect(endOfSection(section(1))).toEqual({ firstUnder: 2 });
		expect(endOfSection(list('Note\n## H\n').section(0))).toBe('first');
	});
	test("with text after the section's last item, a new item goes after that item, before the text", () => {
		const text = '## H\n- [ ] a\n\nText\n';
		const place = endOfSection(list(text).section(1));
		expect(planItemInsert(text, 0, place)?.next).toBe('## H\n- [ ] a\n- [ ] \n\nText\n');
	});
});

describe('sectionLastLine', () => {
	test("is the section's last line that isn't empty, else its heading's line, else where the content starts", () => {
		const { lines, section } = list(`${FRONTMATTER}- [ ] a\n\n\n## H\n\n## K\n- [ ] b\n\tnotes\n\n`);
		expect(sectionLastLine(lines, section(0), 3)).toBe(3);
		expect(sectionLastLine(lines, section(1), 3)).toBe(6);
		expect(sectionLastLine(lines, section(2), 3)).toBe(10);
		expect(sectionLastLine(splitLines(FRONTMATTER), list(FRONTMATTER).section(0), 3)).toBe(3);
	});
});

describe('planItemDelete', () => {
	test('removes the item with its notes, and Undo writes the text from before back', () => {
		const text = '- [ ] a\n\n\tnotes\n- [ ] b\n';
		const planned = planItemDelete(text, 0, 0);
		expect(planned?.next).toBe('- [ ] b\n');
		expect(planned?.edit).toEqual({ start: 0, delta: -3, kind: 'delete' });
		expect(planned?.undo).toEqual({ next: text, expected: '- [ ] b\n', edit: { start: 0, delta: 3, kind: 'insert', history: 'undo' } });
	});
	test('its Undo is an undo, so the history can redo the delete', () => {
		const text = '- [ ] a\n- [ ] b\n';
		const planned = planItemDelete(text, 0, 0) as PlannedDelete;
		const history = new EditHistory();
		history.wrote(text, planned.next, planned.edit);
		history.wrote(planned.next, planned.undo.next, planned.undo.edit);
		expect(history.redo(text)?.next).toBe(planned.next);
	});
	test('null when no item is on the line any more', () => {
		expect(planItemDelete('## H\n- [ ] a\n', 0, 0)).toBeNull();
	});
	test('for every item, the other lines follow the delete, and its Undo restores the text byte for byte and follows back, or it is refused', () => {
		for (const [name, text] of Object.entries(ALL_CASES)) {
			for (const item of list(text).items) {
				const planned = refusedOrRun(() => planItemDelete(text, start(text), item.titleLine));
				if (planned === 'refused' || !planned) continue;
				expect(planned.undo.next, name).toBe(text);
				expect(planned.undo.expected, name).toBe(planned.next);
				expectFollowed(text, planned.next, planned.edit, item.titleLine);
				expectFollowed(planned.next, text, planned.undo.edit);
			}
		}
	});
});

describe('planHeadingDelete', () => {
	test("keeps the section's items, which join the section above, and Undo writes the text from before back", () => {
		const text = '- [ ] a\n## H\n- [ ] b\n';
		const planned = planHeadingDelete(text, 0, 1);
		expect(planned?.next).toBe('- [ ] a\n- [ ] b\n');
		expect(planned?.undo).toEqual({ next: text, expected: '- [ ] a\n- [ ] b\n', edit: { start: 1, delta: 1, kind: 'insert', history: 'undo' } });
	});
	test('null when no heading is on the line any more', () => {
		expect(planHeadingDelete('## H\n- [ ] a\n', 0, 1)).toBeNull();
	});
	test('for every heading, the other lines follow the delete, and its Undo restores the text byte for byte and follows back, or it is refused', () => {
		for (const [name, text] of Object.entries(ALL_CASES)) {
			for (const { headingLine } of list(text).model.sections) {
				if (headingLine === null) continue;
				const planned = refusedOrRun(() => planHeadingDelete(text, start(text), headingLine));
				if (planned === 'refused' || !planned) continue;
				expect(planned.undo.next, name).toBe(text);
				expect(list(planned.next).items.length, name).toBe(list(text).items.length);
				expectFollowed(text, planned.next, planned.edit, headingLine);
				expectFollowed(planned.next, text, planned.undo.edit);
			}
		}
	});
});

describe('planItemMove', () => {
	const text = '- [ ] a\n\n\tnotes\n- [ ] b\n## H\n- [ ] c\n';
	test('moves the item with its notes after an item, first under a heading, or first in the list', () => {
		expect(planItemMove(text, 0, 0, { after: 3 })?.next).toBe('- [ ] b\n- [ ] a\n\n\tnotes\n## H\n- [ ] c\n');
		expect(planItemMove(text, 0, 0, { firstUnder: 4 })?.next).toBe('- [ ] b\n## H\n- [ ] a\n\n\tnotes\n- [ ] c\n');
		expect(planItemMove(text, 0, 5, 'first')?.next).toBe('- [ ] c\n- [ ] a\n\n\tnotes\n- [ ] b\n## H\n');
	});
	test('its edit takes every line to where it went, and leaves the lines before the move', () => {
		const planned = planItemMove(text, 0, 5, { after: 0 });
		expect(planned?.next).toBe('- [ ] a\n\n\tnotes\n- [ ] c\n- [ ] b\n## H\n');
		expect(planned?.edit).toEqual({ start: 3, kind: 'move', moved: [0, 1, 2, 4, 5, 3] });
	});
	test('a drop past a hidden done item leaves it in its place among the other items', () => {
		const hidden = '- [ ] a\n- [x] h ✔ 2026-01-01 10:00\n- [ ] b\n';
		expect(planItemMove(hidden, 0, 0, { after: 2 })?.next).toBe('- [x] h ✔ 2026-01-01 10:00\n- [ ] b\n- [ ] a\n');
		expect(planItemMove(hidden, 0, 2, 'first')?.next).toBe('- [ ] b\n- [ ] a\n- [x] h ✔ 2026-01-01 10:00\n');
	});
	test('null when the item or the place is gone, or when the move changes nothing', () => {
		expect(planItemMove(text, 0, 4, { after: 0 })).toBeNull();
		expect(planItemMove(text, 0, 0, { after: 4 })).toBeNull();
		expect(planItemMove(text, 0, 0, { firstUnder: 3 })).toBeNull();
		expect(planItemMove(text, 0, 0, { after: 0 })).toBeNull();
		expect(planItemMove(text, 0, 3, { after: 0 })).toBeNull();
		expect(planItemMove(text, 0, 0, 'first')).toBeNull();
	});
	test('refuses a move that would change how the rest reads', () => {
		expect(() => planItemMove(REFUSED_CASES.widerColumnMove, 0, 1, { after: 3 })).toThrow(UnsafeEditError);
	});
	test('for every item and place, every line follows the move, or it is refused or changes nothing', () => {
		for (const [name, text] of Object.entries(ALL_CASES)) {
			const { model, items } = list(text);
			const places: ItemPlace[] = [
				'first',
				...items.map((item) => ({ after: item.titleLine })),
				...model.sections.flatMap((s) => (s.headingLine === null ? [] : [{ firstUnder: s.headingLine }])),
			];
			for (const item of items) {
				for (const place of places) {
					const planned = refusedOrRun(() => planItemMove(text, start(text), item.titleLine, place));
					if (planned === 'refused' || !planned) continue;
					expect(planned.next, `${name} ${item.titleLine} ${JSON.stringify(place)}`).not.toBe(text);
					expectFollowed(text, planned.next, planned.edit);
				}
			}
		}
	});
});

describe('planItemLineEdit', () => {
	const text = `${FRONTMATTER}## H\n- [ ] a\n`;

	test('changes the item line and marks the edit so a title field follows it', () => {
		const star = (line: string) => `${line} ⭐`;
		const planned = planItemLineEdit(text, start(text), 4, star);
		expect(planned?.next).toBe(`${FRONTMATTER}## H\n- [ ] a ⭐\n`);
		expect(planned?.edit).toEqual({ start: 4, delta: 0, kind: 'change', retitle: star });
	});

	test('is null on a heading and for a change that changes nothing', () => {
		expect(planItemLineEdit(text, start(text), 3, (line) => `${line} ⭐`)).toBeNull();
		expect(planItemLineEdit(text, start(text), 4, (line) => line)).toBeNull();
	});
});
