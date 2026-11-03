import { indentLess, indentMore } from '@codemirror/commands';
import { insertNewlineContinueMarkupCommand, markdownLanguage } from '@codemirror/lang-markdown';
import { indentUnit } from '@codemirror/language';
import { EditorSelection, EditorState, type StateCommand, type Transaction } from '@codemirror/state';
import { HtmlRenderer, Parser, type Node } from 'commonmark';
import { describe, expect, test } from 'vitest';
import { ListEditing } from '../../src/core/editing';
import { splitLines } from '../../src/core/lines';
import { indentUnitFor } from '../../src/core/notes-visit';
import { contentStartOf, list, notesEditor } from './edit-helpers';

const render = (nodes: Node[]) => nodes.map((node) => new HtmlRenderer().render(node)).join('');

function children(node: Node | null): Node[] {
	const out: Node[] = [];
	for (let child = node?.firstChild ?? null; child; child = child.next) out.push(child);
	return out;
}

// The blocks of the first item's notes: everything in the item after its title paragraph.
const notesHtml = (text: string) => render(children(new Parser().parse(text).firstChild?.firstChild ?? null).slice(1));
const typedHtml = (markdown: string) => render(children(new Parser().parse(markdown)));

// The first item's notes in a CodeMirror state set up as the card's editor is, with the caret at
// the end of `typed`, which replaces what the notes held. The key commands run on that state, and
// each step is saved as the editor saves it.
function cardEditor(text: string, typed: string) {
	const editing = new ListEditing((t) => contentStartOf(splitLines(t)));
	editing.text = text;
	editing.open(list(text).item(0).titleLine);
	const notes = notesEditor(editing, 'item');
	const held = notes.text;
	let state = EditorState.create({
		doc: typed,
		selection: EditorSelection.cursor(typed.length),
		extensions: [markdownLanguage, indentUnit.of(editing.notesIndentUnit('item'))],
	});
	notes.type(typed);
	const press = (command: StateCommand) => {
		command({ state, dispatch: (tr: Transaction) => (state = tr.state) });
		notes.type(state.doc.toString());
	};
	return {
		held,
		unit: editing.notesIndentUnit('item'),
		press,
		get markdown() {
			return state.doc.toString();
		},
		get file() {
			return editing.text;
		},
	};
}

describe('the unit Tab indents notes by', () => {
	test.each([
		['', '\t'],
		['\t', '\t'],
		['  \t', '\t'],
		['  ', '    '],
		['   ', '    '],
		['    ', '    '],
		['     ', '    '],
	])('notes indented %j take %j', (indent, unit) => {
		expect(indentUnitFor(indent)).toBe(unit);
	});

	test.each([
		['- [ ] a\n- [ ] b\n', '    '],
		['1. [ ] a\n2. [ ] b\n', '    '],
		['- [ ] a\n\n\tnote\n- [ ] b\n', '\t'],
		['10. [ ] a\n', '\t'],
	])('%j: the card takes %j', (text, unit) => {
		const editing = new ListEditing((t) => contentStartOf(splitLines(t)));
		editing.text = text;
		editing.open(list(text).item(0).titleLine);
		expect(editing.notesIndentUnit('item')).toBe(unit);
		expect(editing.notesIndentUnit('listNote')).toBe('\t');
	});
});

describe('Tab and Shift+Tab in new notes', () => {
	const NEW_ITEMS = ['- [ ] a\n- [ ] b\n', '1. [ ] a\n2. [ ] b\n'];
	const nested = NEW_ITEMS.flatMap((text) => ['1. one\n- sub', '- one\n1. sub', '10. one\n- sub'].map((typed) => [text, typed]));

	test.each(nested)('%j: Tab on the second line of %j nests it in the note as on the card', (text, typed) => {
		const card = cardEditor(text, typed);
		card.press(indentMore);
		expect(typedHtml(card.markdown)).toMatch(/<\/li>\n<\/[ou]l>\n<\/li>/);
		expect(notesHtml(card.file)).toBe(typedHtml(card.markdown));
		expect(card.markdown).toBe(typed.replace(/\n/g, '\n    '));
	});

	test.each(NEW_ITEMS)('%j: Enter in a nested item continues it in spaces, still nested', (text) => {
		const card = cardEditor(text, '1. one\n- sub');
		card.press(indentMore);
		card.press(insertNewlineContinueMarkupCommand({ nonTightLists: false }));
		expect(card.markdown).toBe('1. one\n    - sub\n    - ');
		expect(notesHtml(card.file)).toBe(typedHtml(card.markdown));
	});

	test.each(NEW_ITEMS)('%j: Tab then Shift+Tab puts the note back as it was', (text) => {
		const card = cardEditor(text, '1. one\n- sub');
		const before = card.file;
		card.press(indentMore);
		card.press(indentLess);
		expect(card.markdown).toBe('1. one\n- sub');
		expect(card.file).toBe(before);
	});

	test.each([
		['- [ ] a\nlazy\n\n\tmore\n- [ ] b\n', 'lazy\n\nmore', '- [ ] a\nlazy\n\n\tmore\n\tnew\n- [ ] b\n'],
		['- [ ] a\n\n\t\tcode\n\n\tmore\n', '\tcode\n\nmore', '- [ ] a\n\n\t\tcode\n\n\tmore\n\tnew\n'],
	])('%j: a tab note opening with a lazy line or code keeps the tab, in its lines and its Tab', (text, held, saved) => {
		const card = cardEditor(text, `${held}\nnew`);
		expect(card.held).toBe(held);
		expect(card.unit).toBe('\t');
		expect(card.file).toBe(saved);
	});

	test('a tab-indented note still nests with a tab', () => {
		const card = cardEditor('- [ ] a\n\n\tnote\n- [ ] b\n', 'note\n\n1. one\n- sub');
		card.press(indentMore);
		expect(card.markdown).toBe('note\n\n1. one\n\t- sub');
		expect(card.file).toBe('- [ ] a\n\n\tnote\n\n\t1. one\n\t\t- sub\n- [ ] b\n');
		expect(notesHtml(card.file)).toBe(typedHtml(card.markdown));
	});
});
