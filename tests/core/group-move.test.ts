import { describe, expect, test } from 'vitest';
import { UnsafeEditError } from '../../src/core/edit-check';
import { ListEditing } from '../../src/core/editing';
import { groupCount, landingHeading, planGroupMove, type GroupPlace } from '../../src/core/group-actions';
import { splitLines } from '../../src/core/lines';
import { planItemMove, planSectionMove, type ItemPlace } from '../../src/core/list-actions';
import { RowSelection } from '../../src/core/selection';
import { FIXTURES, JOINING_CASES, REFUSED_CASES, contentStartOf, crlf, expectRestKept, list, readFixture } from './edit-helpers';

const FRONT = '---\nprincelists: true\n---\n';
const TEXT = FRONT + '- [ ] a\n## B\n- [ ] b\n## C\n- [ ] c\n';
const body = (t: string | undefined) => t?.slice(FRONT.length);

// The text a plan leaves, null for no plan, or 'refused' when it throws UnsafeEditError.
function outcome(plan: () => { next: string } | null): string | null {
	try {
		return plan()?.next ?? null;
	} catch (error) {
		if (error instanceof UnsafeEditError) return 'refused';
		throw error;
	}
}

function nextOf(text: string, rows: number[], place: GroupPlace): string {
	const plan = planGroupMove(text, contentStartOf(splitLines(text)), rows, place);
	if (!plan) throw new Error('expected the move to change the text');
	return plan.next;
}

const headingNames = (text: string) => {
	const { lines, model } = list(text);
	return model.sections.flatMap((s) => (s.headingLine === null ? [] : [lines[s.headingLine]?.text]));
};

const itemsUnder = (text: string, heading: string) => {
	const { lines, model } = list(text);
	const section = model.sections.find((s) => s.headingLine !== null && lines[s.headingLine]?.text === heading);
	return section?.items.map((it) => lines[it.titleLine]?.text);
};

describe('planGroupMove', () => {
	test('moves loose items together, in file order', () => {
		expect(body(planGroupMove(TEXT, 3, [7, 3], { firstUnder: 4 })?.next)).toBe('## B\n- [ ] a\n- [ ] c\n- [ ] b\n## C\n');
	});

	test('puts loose items before sections', () => {
		expect(body(planGroupMove(TEXT, 3, [3, 6], { beforeSection: 4 })?.next)).toBe('- [ ] a\n## C\n- [ ] c\n## B\n- [ ] b\n');
	});

	test("moves a selected heading's selected item once", () => {
		expect(planGroupMove(TEXT, 3, [6, 7], { beforeSection: 4 })?.next).toBe(planGroupMove(TEXT, 3, [6], { beforeSection: 4 })?.next);
	});

	test("an item place on a moving row resolves to the nearest place above that isn't moving", () => {
		expect(body(planGroupMove(TEXT, 3, [3, 5], { after: 5 })?.next)).toBe('## B\n- [ ] a\n- [ ] b\n## C\n- [ ] c\n');
	});

	test("a section place on a moving heading resolves to the next heading below that isn't moving", () => {
		const text = FRONT + '## B\n- [ ] b\n## C\n- [ ] c\n## D\n- [ ] d\n';
		expect(planGroupMove(text, 3, [5], { beforeSection: 5 })).toBeNull();
		expect(body(planGroupMove(text, 3, [3, 7], { beforeSection: 7 })?.next)).toBe('## C\n- [ ] c\n## B\n- [ ] b\n## D\n- [ ] d\n');
	});

	test("moves to the end of a heading's section", () => {
		expect(body(planGroupMove(TEXT, 3, [3], { endOf: 6 })?.next)).toBe('## B\n- [ ] b\n## C\n- [ ] c\n- [ ] a\n');
		expect(body(planGroupMove(TEXT, 3, [7], { endOf: null })?.next)).toBe('- [ ] a\n- [ ] c\n## B\n- [ ] b\n## C\n');
	});

	test('moves selected items already under the heading to its end too', () => {
		const text = FRONT + '- [ ] a\n## B\n- [ ] b\n- [ ] d\n## C\n- [ ] c\n';
		expect(body(planGroupMove(text, 3, [5, 3], { endOf: 4 })?.next)).toBe('## B\n- [ ] d\n- [ ] a\n- [ ] b\n## C\n- [ ] c\n');
	});

	test('returns null when nothing moves', () => {
		expect(planGroupMove(TEXT, 3, [5], { firstUnder: 4 })).toBeNull();
	});

	test('a group of one row is the single move', () => {
		const texts = [...Object.values(JOINING_CASES), ...FIXTURES.map(readFixture)];
		for (const text of [...texts, ...texts.map(crlf)]) {
			const contentStart = contentStartOf(splitLines(text));
			const { model, items } = list(text);
			const places: ItemPlace[] = [
				...items.map((it) => ({ after: it.titleLine })),
				...model.sections.map((s): ItemPlace => (s.headingLine === null ? 'first' : { firstUnder: s.headingLine })),
			];
			for (const it of items) {
				for (const place of places) {
					const single = outcome(() => planItemMove(text, contentStart, it.titleLine, place));
					const group = outcome(() => planGroupMove(text, contentStart, [it.titleLine], place));
					expect(group, JSON.stringify({ text, row: it.titleLine, place })).toBe(single);
				}
			}
			const headings = model.sections.flatMap((s) => (s.headingLine === null ? [] : [s.headingLine]));
			for (const [index, heading] of headings.entries()) {
				// The section's own place, which the heading drag never aims at: the group move writes nothing.
				const own = headings[index + 1] ?? null;
				for (const before of [...headings.filter((h) => h !== heading), null]) {
					const single = before === own ? null : outcome(() => planSectionMove(text, contentStart, heading, before));
					const group = outcome(() => planGroupMove(text, contentStart, [heading], { beforeSection: before }));
					expect(group, JSON.stringify({ text, row: heading, before })).toBe(single);
				}
			}
		}
	});

	test('refuses what a single move refuses', () => {
		const { widerColumnDelete, widerColumnMove } = REFUSED_CASES;
		expect(() => planGroupMove(widerColumnDelete, 0, [0], { after: 1 })).toThrow(UnsafeEditError);
		expect(() => planGroupMove(widerColumnDelete, 0, [1], 'first')).toThrow(UnsafeEditError);
		expect(() => planGroupMove(widerColumnMove, 0, [1], { after: 3 })).toThrow(UnsafeEditError);
	});

	test('moves several blocks across a setext heading, byte for byte', () => {
		const text = JOINING_CASES.setextHeadingTop2;
		const copies = [text, crlf(text), text.slice(0, -1)];
		for (const copy of copies) {
			const sections = nextOf(copy, [9, 7], { beforeSection: 5 });
			expect(headingNames(sections)).toEqual(['Hall', 'Kitchen']);
			const items = nextOf(copy, [7, 11], { endOf: 9 });
			expect(itemsUnder(items, 'Hall')).toEqual(['- [ ] a', '- [ ] b']);
			for (const next of [sections, items]) {
				expectRestKept(copy, next);
				if (copy.includes('\r\n')) expect(splitLines(next).every((line) => line.eol === '\r\n')).toBe(true);
				if (!copy.endsWith('\n')) expect(next.endsWith('\n')).toBe(false);
			}
		}
	});

	test('adds an empty line only where the final arrangement needs one', () => {
		const text = 'Set\n===\n- [ ] s\n## H\n- [ ] h\n## K\n- [ ] i\n';
		expect(planGroupMove(text, 0, [3, 6], { beforeSection: 0 })?.next).toBe('- [ ] i\n## H\n- [ ] h\n\nSet\n===\n- [ ] s\n## K\n');
	});

	test("leaves a section the drop puts where it already is, its empty lines included", () => {
		const text = FRONT + '- [ ] Loose one\n- [ ] Loose two\n\n## Alpha\n- [ ] A1\n  a note line\n- [ ] A2\n- [ ] A3\n\n## Beta\n- [ ] B1\n- [ ] B2\n\n## Gamma\n- [ ] G1\n- [ ] G2\n';
		expect(planGroupMove(text, 3, [12], { beforeSection: 16 })).toBeNull();
		expect(planGroupMove(text, 3, [4, 12], { beforeSection: 16 })?.next).toBe(planItemMove(text, 3, 4, { after: 10 })?.next);
	});

	test('leaves sections that already end the run before the place in order, and moves the rest', () => {
		const text = FRONT + '## B\n- [ ] b\n## C\n- [ ] c\n## D\n- [ ] d\n';
		expect(planGroupMove(text, 3, [3, 5], { beforeSection: 7 })).toBeNull();
		expect(planGroupMove(text, 3, [5, 7], { beforeSection: null })).toBeNull();
		expect(body(planGroupMove(text, 3, [3, 7], { beforeSection: null })?.next)).toBe('## C\n- [ ] c\n## B\n- [ ] b\n## D\n- [ ] d\n');
	});

	test('maps each line', () => {
		const editing = new ListEditing((t) => contentStartOf(splitLines(t)));
		editing.text = TEXT;
		const selection = new RowSelection(editing);
		selection.toggle(3);
		selection.toggle(7);
		const plan = planGroupMove(TEXT, 3, [7, 3], { firstUnder: 4 });
		if (!plan) throw new Error('expected the move to change the text');
		editing.applyOwn(plan.next, plan.edit);
		expect(selection.lines()).toEqual([4, 5]);
	});
});

describe('groupCount', () => {
	test("counts the selected headings, and the selected items outside their sections", () => {
		expect(groupCount(TEXT, 3, [7, 3, 4, 5])).toEqual({ items: 2, headings: 1 });
	});

	test('counts a row that is neither an item nor a heading for nothing', () => {
		expect(groupCount(TEXT, 3, [3, 99])).toEqual({ items: 1, headings: 0 });
	});
});

describe('landingHeading', () => {
	test('names the heading of the section the loose items land in', () => {
		expect(landingHeading(TEXT, 3, [3], { firstUnder: 6 })).toBe(6);
		expect(landingHeading(TEXT, 3, [3], { endOf: 4 })).toBe(4);
	});

	test("names the section above the drop for a selection with a heading", () => {
		expect(landingHeading(TEXT, 3, [3, 4], { beforeSection: null })).toBe(6);
	});

	test('is null when the items land before the first heading', () => {
		expect(landingHeading(TEXT, 3, [7], { endOf: null })).toBeNull();
	});

	test('is null with no loose items, or when a row is gone', () => {
		expect(landingHeading(TEXT, 3, [4], { beforeSection: null })).toBeNull();
		expect(landingHeading(TEXT, 3, [3, 99], { endOf: 4 })).toBeNull();
	});
});
