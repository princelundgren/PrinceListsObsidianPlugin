import { describe, expect, test, vi } from 'vitest';
import { headingText } from '../../src/core/display';
import { ListEditing } from '../../src/core/editing';
import { saveHeadingName } from '../../src/core/heading-field';
import { splitLines } from '../../src/core/lines';
import { contentStartOf } from './edit-helpers';

// Every text commonmark parses in this file's tests.
const parsed = vi.hoisted((): string[] => []);
vi.mock('commonmark', async (importOriginal) => {
	const commonmark = await importOriginal<typeof import('commonmark')>();
	function Parser(...args: ConstructorParameters<typeof commonmark.Parser>) {
		const parser = new commonmark.Parser(...args);
		const parse = parser.parse.bind(parser);
		parser.parse = (text) => {
			parsed.push(text);
			return parse(text);
		};
		return parser;
	}
	return { ...commonmark, Parser };
});

const TEXT = '---\nprincelists: true\n---\nThe list note.\n\n## Kitchen\n- [ ] a\n\n\tA note.\n- [ ] b\n## Hall\n- [ ] last item\n';

// Parses of the whole file, which reach its last item. The checks of a note's own text don't.
function wholeFileParses(edit: () => void): number {
	parsed.length = 0;
	edit();
	return parsed.filter((text) => text.includes('last item')).length;
}

function editing(): ListEditing {
	const state = new ListEditing((t) => contentStartOf(splitLines(t)));
	state.text = TEXT;
	return state;
}

// The design checks every edit by parsing the file before and after it ("Edits leave it parsing as
// it did"), so two parses per save is the floor.
describe('one letter typed parses the whole file twice, as it is and as edited', () => {
	test("in an item's notes", () => {
		const state = editing();
		state.open(6);
		state.openNotesPiece({ start: 8, end: 9 }, false);
		expect(wholeFileParses(() => state.typeNotesPiece('A note!'))).toBe(2);
		expect(state.text).toContain('\tA note!\n');
	});

	test('in the list note', () => {
		const state = editing();
		state.openListNote({ start: 3, end: 4 }, false);
		expect(wholeFileParses(() => state.typeListNote('The list note!'))).toBe(2);
		expect(state.text).toContain('\nThe list note!\n');
	});
});

test("saving a heading's name parses the whole file twice", () => {
	const field = { heading: { line: 10 }, before: 'Hall' };
	let next = '';
	expect(
		wholeFileParses(() => {
			const save = saveHeadingName(TEXT, 3, field, 'Hallway');
			if (save.kind === 'write') next = save.next;
		}),
	).toBe(2);
	expect(headingText(splitLines(next), 10)).toBe('Hallway');
});
