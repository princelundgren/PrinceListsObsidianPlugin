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
	test.each(
		['- [ ] a\n- [ ] b\n', '1. [ ] a\n2. [ ] b\n'].flatMap((text) =>
			['  x', '   x', '    code', 'para\n\n  indented para'].map((typed) => [text, typed]),
		),
	)('%j: new notes %j render as typed', (text, typed) => {
		const [step] = typeNotes(text, 0, [typed]);
		expect(notesHtml(step?.text ?? '')).toBe(render(children(new Parser().parse(typed))));
	});
	test.each([
		['- [ ] a\n- [ ] b\n', 'para\n- sub\n\n  more', '- [ ] a\n\n  para\n  - sub\n\n    more\n- [ ] b\n'],
		['1. [ ] a\n2. [ ] b\n', 'para\n- sub', '1. [ ] a\n\n   para\n   - sub\n2. [ ] b\n'],
	])('%j: space-indented notes %j stay the item\'s notes, a bullet in them too', (text, typed, saved) => {
		const [step] = typeNotes(text, 0, [typed]);
		expect(step?.text).toBe(saved);
		const { lines, items, item } = list(saved);
		expect(items).toHaveLength(2);
		expect(getItemNotes(lines, item(0))).toBe(typed);
	});
	test.each([
		['100. [ ] a\n- [ ] b\n', 'x\ny', '100. [ ] a\n\n     x\n     y\n- [ ] b\n'],
		['- [ ] a\n\n\tnote\n- [ ] b\n', 'note\nmore', '- [ ] a\n\n\tnote\n\tmore\n- [ ] b\n'],
	])('%j keeps its indent when %j is typed', (text, typed, saved) => {
		expect(typeNotes(text, 0, [typed])[0]?.text).toBe(saved);
	});
	test('the notes read back as typed, after the leading spaces that render alike', () => {
		const steps = typeNotes('- [ ] a\n- [ ] b\n', 0, [' x', ' xy', ' xyz']);
		expect(steps.map((step) => step.text)).toEqual([
			'- [ ] a\n\n   x\n- [ ] b\n',
			'- [ ] a\n\n   xy\n- [ ] b\n',
			'- [ ] a\n\n   xyz\n- [ ] b\n',
		]);
		const { lines, item } = list(steps[2]?.text ?? '');
		expect(getItemNotes(lines, item(0)).trimStart()).toBe('xyz');
	});
});
