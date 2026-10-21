import { HtmlRenderer, Parser, type Node } from 'commonmark';
import { describe, expect, test } from 'vitest';
import { getItemNotes, setItemNotes } from '../../src/core/edit-items';
import { joinLines } from '../../src/core/lines';
import { list } from './edit-helpers';

// Task 9 saves an item's notes on every keystroke. Each save re-parses the view's text, finds the
// item by its title line, and passes the notes indent the field captured when it took focus.
function typeNotes(text: string, n: number, typed: readonly string[]) {
	const start = list(text);
	const titleLine = start.item(n).titleLine;
	const indent = start.item(n).notesIndent;
	let current = text;
	return typed.map((markdown) => {
		const { lines, model, items } = list(current);
		const item = items.find((i) => i.titleLine === titleLine);
		if (!item) throw new Error(`The item at line ${titleLine} is gone`);
		current = joinLines(setItemNotes(lines, model, item, markdown, indent));
		return { markdown, text: current };
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

describe('setItemNotes across a typing session', () => {
	test.each([
		// Re-parsed, a first notes line that starts with a space gives a wider notes indent, and the
		// next save would indent every line by it: ` xy` would become code.
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
