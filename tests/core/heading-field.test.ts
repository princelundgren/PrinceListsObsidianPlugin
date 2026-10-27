import { describe, expect, test } from 'vitest';
import { headingText } from '../../src/core/display';
import { UnsafeEditError } from '../../src/core/edit-check';
import { ListEditing } from '../../src/core/editing';
import { planHeadingRemoval, saveHeadingName } from '../../src/core/heading-field';
import { ownEdit, type OwnEdit } from '../../src/core/follow';
import { EditHistory } from '../../src/core/history';
import { planHeadingInsert, type PlannedInsert } from '../../src/core/list-actions';
import { splitLines } from '../../src/core/lines';
import { contentStartOf, crlf, FIXTURES, JOINING_CASES, list, readFixture } from './edit-helpers';

const start = (text: string) => contentStartOf(splitLines(text));

// The field as it opens on the heading at `line` of `text`, its line followed through `changes` from
// outside, one at a time, as the view follows it.
const fieldOn = (text: string, line: number, ...changes: string[]) => {
	const editing = new ListEditing(start);
	editing.text = text;
	const heading = editing.track(line);
	for (const change of changes) editing.outsideChange(change);
	return { heading, before: headingText(splitLines(text), line) };
};

const save = (text: string, field: ReturnType<typeof fieldOn>, typed: string) => saveHeadingName(text, start(text), field, typed);

describe('saveHeadingName', () => {
	test('writes the trimmed name and keeps the level', () => {
		const text = '- [ ] a\n### Old\n- [ ] b\n';
		expect(save(text, fieldOn(text, 1), '  New  ')).toEqual({
			kind: 'write',
			next: '- [ ] a\n### New\n- [ ] b\n',
			line: 1,
			edit: { start: 1, delta: 0, kind: 'change' },
		});
	});
	test('names an empty new heading `## <name>`, with the file ending', () => {
		const text = crlf('- [ ] a\n##\n- [ ] b\n');
		const saved = save(text, fieldOn(text, 1), 'Kitchen');
		expect(saved.kind === 'write' && saved.next).toBe(crlf('- [ ] a\n## Kitchen\n- [ ] b\n'));
	});
	test('an empty or unchanged name writes nothing', () => {
		const text = '## Old\n- [ ] a\n';
		for (const typed of ['', '   ', 'Old', ' Old ']) expect(save(text, fieldOn(text, 0), typed)).toEqual({ kind: 'none' });
	});
	test("refuses a name that wouldn't come back as this heading, at its level and with exactly that text", () => {
		const setext = 'Old\n===\n- [ ] a\n';
		expect(save(setext, fieldOn(setext, 0), '- [ ] New')).toEqual({ kind: 'refused' });
		const atx = '- [ ] a\n##\n';
		expect(save(atx, fieldOn(atx, 1), 'C #')).toEqual({ kind: 'refused' });
	});
	test("refuses a name the heading wouldn't read back as, such as an underline on a setext heading", () => {
		for (const underline of ['===', '---']) {
			const text = `Old\n${underline}\n- [ ] a\n`;
			for (const typed of ['===', '---']) expect(save(text, fieldOn(text, 0), typed), `${typed} on ${underline}`).toEqual({ kind: 'refused' });
			const saved = save(text, fieldOn(text, 0), 'New');
			expect(saved.kind === 'write' && saved.next).toBe(`New\n${underline}\n- [ ] a\n`);
		}
	});
	test("a setext heading's content lines become the one name, and the lines after follow", () => {
		const text = 'Old\nline two\n===\n- [ ] a\n';
		const field = fieldOn(text, 0);
		expect(field.before).toBe('Old line two');
		expect(save(text, field, 'New')).toEqual({
			kind: 'write',
			next: 'New\n===\n- [ ] a\n',
			line: 0,
			edit: { start: 0, delta: -1, kind: 'change' },
		});
	});
	test('finds the heading after an outside change elsewhere moved it', () => {
		const text = '## G\n- [ ] a\n## H\n- [ ] b\n';
		const now = '## G\n- [ ] new\n- [ ] a\n## H\n- [ ] b\n';
		const saved = save(now, fieldOn(text, 2, now), 'Hall');
		expect(saved.kind === 'write' && saved.next).toBe('## G\n- [ ] new\n- [ ] a\n## Hall\n- [ ] b\n');
	});
	test('finds the heading after two outside changes, one above it and one below it', () => {
		const text = '- [ ] a\n- [ ] b\n## Old\n- [ ] c\n- [ ] d\n';
		const above = text.replace('- [ ] a', '- [ ] a2');
		const below = above.replace('- [ ] d', '- [ ] d2');
		const saved = save(below, fieldOn(text, 2, above, below), 'New');
		expect(saved.kind === 'write' && saved.next).toBe('- [ ] a2\n- [ ] b\n## New\n- [ ] c\n- [ ] d2\n');
	});
	test("is lost when an outside change took the heading's line, or left no heading on it", () => {
		const text = '## G\n- [ ] a\n## H\n- [ ] b\n';
		const renamed = '## G\n- [ ] a\n## Hall\n- [ ] b\n';
		expect(save(renamed, fieldOn(text, 2, renamed), 'Kitchen')).toEqual({ kind: 'lost' });
		// The fence turns the rest into code, so the line maps but holds no heading.
		const fenced = '```\n## G\n- [ ] a\n## H\n- [ ] b\n';
		expect(save(fenced, fieldOn(text, 2, fenced), 'Kitchen')).toEqual({ kind: 'lost' });
	});
});

describe('planHeadingRemoval', () => {
	test('removes the empty heading, leaving the file as it was before the insert, at every place New heading below can add one', () => {
		const cases: Record<string, string> = {
			gapsAround: '- [ ] a\n\n## H\n\n- [ ] b\n',
			noFinalNewline: '## G\n- [ ] a',
			...JOINING_CASES,
			...Object.fromEntries(FIXTURES.map((name) => [name, readFixture(name)])),
		};
		for (const variant of [(t: string) => t, crlf]) {
			for (const [name, original] of Object.entries(cases)) {
				const text = variant(original);
				const { model, items } = list(text);
				const places = [
					...items.map((item) => ({ afterItem: item.titleLine })),
					...model.sections.flatMap((s) => (s.headingLine === null ? [] : [{ afterSection: s.headingLine }])),
				];
				for (const place of places) {
					let inserted;
					try {
						inserted = planHeadingInsert(text, start(text), place);
					} catch (error) {
						if (error instanceof UnsafeEditError) continue;
						throw error;
					}
					if (!inserted) continue;
					const removal = planHeadingRemoval(inserted.next, start(text), fieldOn(inserted.next, inserted.line));
					expect(removal?.next, `${name} ${JSON.stringify(place)}`).toBe(text);
					expect(removal?.edit, `${name} ${JSON.stringify(place)}`).toEqual({ start: inserted.line, delta: -1, kind: 'delete', history: 'cancel' });
				}
			}
		}
	});
	test('a cancel: after an item or after a section, it takes the insert back exactly, so it leaves no step', () => {
		const text = '- [ ] a\n## H\n- [ ] b\n';
		for (const place of [{ afterItem: 0 }, { afterSection: 1 }]) {
			const inserted = planHeadingInsert(text, 0, place) as PlannedInsert;
			const history = new EditHistory();
			history.wrote('- [ ] a\n## H\n', text, ownEdit(2, '- [ ] a\n## H\n', text, 'insert'));
			history.wrote(text, inserted.next, inserted.edit);
			const removal = planHeadingRemoval(inserted.next, 0, fieldOn(inserted.next, inserted.line));
			expect(removal?.next, JSON.stringify(place)).toBe(text);
			expect(removal?.edit.history, JSON.stringify(place)).toBe('cancel');
			history.wrote(inserted.next, text, (removal as { edit: OwnEdit }).edit);
			expect(history.undo(text)?.next, JSON.stringify(place)).toBe('- [ ] a\n## H\n');
		}
	});
	test('undo and redo never leave an empty new heading without its field, once it is named', () => {
		const text = '- [ ] a\n## H\n- [ ] b\n';
		const state = new ListEditing(start);
		state.text = '- [ ] a\n## H\n';
		state.applyOwn(text, ownEdit(2, state.text, text, 'insert'));
		const inserted = planHeadingInsert(state.text, 0, { afterItem: 0 }) as PlannedInsert;
		state.applyOwn(inserted.next, inserted.edit);
		const field = { heading: state.track(inserted.line), before: '' };
		const saved = saveHeadingName(state.text, 0, field, 'Kitchen');
		if (saved.kind !== 'write') throw new Error(`expected a write, got ${saved.kind}`);
		state.applyOwn(saved.next, saved.edit);
		const named = state.text;
		const hasEmptyHeading = () => {
			const { lines, model } = list(state.text);
			return model.sections.some((s) => s.headingLine !== null && headingText(lines, s.headingLine) === '');
		};
		const step = (write: { next: string; edit: OwnEdit } | null) => {
			expect(write).not.toBeNull();
			state.applyOwn((write as { next: string }).next, (write as { edit: OwnEdit }).edit);
			expect(hasEmptyHeading(), state.text).toBe(false);
		};
		step(state.history.undo(state.text));
		expect(state.text).toBe(text);
		step(state.history.undo(state.text));
		step(state.history.redo(state.text));
		step(state.history.redo(state.text));
		expect(state.text).toBe(named);
	});
	test('removes it from the current text after an outside change elsewhere', () => {
		const text = '- [ ] a\n##\n- [ ] b\n';
		const now = '- [ ] new\n- [ ] a\n##\n- [ ] b\n';
		expect(planHeadingRemoval(now, 0, fieldOn(text, 1, now))?.next).toBe('- [ ] new\n- [ ] a\n- [ ] b\n');
	});
	test('removes it after two outside changes, one above it and one below it', () => {
		const text = '- [ ] a\n##\n- [ ] c\n';
		const above = text.replace('- [ ] a', '- [ ] a2');
		const below = above.replace('- [ ] c', '- [ ] c2');
		expect(planHeadingRemoval(below, 0, fieldOn(text, 1, above, below))?.next).toBe('- [ ] a2\n- [ ] c2\n');
	});
	test('null when the heading has a name now, or its line is gone', () => {
		const text = '- [ ] a\n##\n- [ ] b\n';
		const named = '- [ ] a\n## Named\n- [ ] b\n';
		expect(planHeadingRemoval(named, 0, fieldOn(text, 1, named))).toBeNull();
		const gone = '- [ ] a\n- [ ] b\n';
		expect(planHeadingRemoval(gone, 0, fieldOn(text, 1, gone))).toBeNull();
		// The heading is on the line, but it holds a name: a field opened on a named heading never removes it.
		const withName = '- [ ] a\n## H\n- [ ] b\n';
		expect(planHeadingRemoval(withName, 0, fieldOn(withName, 1))).toBeNull();
	});
});
