import { HtmlRenderer, Parser, type Node } from 'commonmark';
import { describe, expect, test } from 'vitest';
import { ListEditing } from '../../src/core/editing';
import { getItemNotes } from '../../src/core/edit-items';
import { splitLines } from '../../src/core/lines';
import { contentStartOf, list, notesEditor } from './edit-helpers';

// A visit keeps the indent the notes had when it opened. Re-parsed after a save, the notes indent takes
// in spaces typed at the start of the notes, and saving with it would turn a paragraph into code.
function typeNotes(text: string, n: number, typed: readonly string[]) {
	const state = new ListEditing((t) => contentStartOf(splitLines(t)));
	state.text = text;
	state.open(list(text).item(n).titleLine);
	const notes = notesEditor(state, 'item');
	return typed.map((markdown) => {
		notes.type(markdown);
		return { markdown, text: state.text };
	});
}

const render = (nodes: Node[]) => nodes.map((node) => new HtmlRenderer().render(node)).join('');

function children(node: Node | null): Node[] {
	const out: Node[] = [];
	for (let child = node?.firstChild ?? null; child; child = child.next) out.push(child);
	return out;
}

// The blocks of the first item's notes: everything in the item after its title paragraph.
const notesHtml = (text: string) => render(children(new Parser().parse(text).firstChild?.firstChild ?? null).slice(1));

describe("a card's notes across a typing session", () => {
	test.each([
		['- [ ] a\n- [ ] b\n', [' x', ' xy', ' xyz']],
		['- [ ] a\n- [ ] b\n', [' x', ' x\n', ' x\ny', ' x\ny\n z']],
		['- [ ] a\n\n\tnote\n- [ ] b\n', ['note', ' note', ' notes', 'notes']],
		['100. [ ] a\n- [ ] b\n', [' x', ' xy', '  xyz']],
	])('%j: every save of %j renders the blocks typed', (text, typed) => {
		for (const step of typeNotes(text, 0, typed)) {
			expect(notesHtml(step.text), JSON.stringify(step)).toBe(render(children(new Parser().parse(step.markdown))));
		}
	});
	test('the notes read back as typed, after the leading spaces that render alike', () => {
		const steps = typeNotes('- [ ] a\n- [ ] b\n', 0, [' x', ' xy', ' xyz']);
		expect(steps.map((step) => step.text)).toEqual([
			'- [ ] a\n\n\t x\n- [ ] b\n',
			'- [ ] a\n\n\t xy\n- [ ] b\n',
			'- [ ] a\n\n\t xyz\n- [ ] b\n',
		]);
		const { lines, item } = list(steps[2]?.text ?? '');
		expect(getItemNotes(lines, item(0)).trimStart()).toBe('xyz');
	});
});
