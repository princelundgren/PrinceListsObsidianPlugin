import { describe, expect, test } from 'vitest';
import { formatSelection, type Format } from '../../src/core/format';

// `‸` marks the selection's ends, or the caret when there is one: 'a ‸word‸ b' selects "word".
function format(marked: string, kind: Format): string {
	const start = marked.indexOf('‸');
	const last = marked.lastIndexOf('‸');
	const end = last === start ? start : last - 1;
	const text = marked.replaceAll('‸', '');
	const edit = formatSelection(text, start, end, kind);
	const next = text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
	const marks = edit.selectionStart === edit.selectionEnd ? [edit.selectionStart] : [edit.selectionStart, edit.selectionEnd];
	return marks.reduceRight((out, at) => out.slice(0, at) + '‸' + out.slice(at), next);
}

describe('formatSelection: bold and italic', () => {
	test('wraps the selection and keeps it selected', () => {
		expect(format('a ‸word‸ b', 'bold')).toBe('a **‸word‸** b');
		expect(format('a ‸word‸ b', 'italic')).toBe('a *‸word‸* b');
	});

	test('puts the caret between the markers when nothing is selected', () => {
		expect(format('a ‸b', 'bold')).toBe('a **‸**b');
		expect(format('‸', 'italic')).toBe('*‸*');
	});

	test('unwraps a selection that is already bold or italic', () => {
		expect(format('a **‸word‸** b', 'bold')).toBe('a ‸word‸ b');
		expect(format('a *‸word‸* b', 'italic')).toBe('a ‸word‸ b');
	});

	test('unwraps a selection that takes in its own markers, as a drag or a triple-click does', () => {
		expect(format('a ‸**word**‸ b', 'bold')).toBe('a ‸word‸ b');
		expect(format('a ‸*word*‸ b', 'italic')).toBe('a ‸word‸ b');
		expect(format('‸**word**‸', 'italic')).toBe('***‸word‸***');
	});

	test('wraps a selection holding two bold spans as a whole, rather than joining them', () => {
		expect(format('‸**a** and **b**‸', 'bold')).toBe('**‸**a** and **b**‸**');
	});

	test('leaves spaces at the selection ends outside the markers, where they would stop the formatting', () => {
		expect(format('a‸ word ‸b', 'bold')).toBe('a **‸word‸** b');
	});

	test('tells bold and italic apart in a run of stars', () => {
		expect(format('**‸word‸**', 'italic')).toBe('***‸word‸***');
		expect(format('*‸word‸*', 'bold')).toBe('***‸word‸***');
		expect(format('***‸word‸***', 'italic')).toBe('**‸word‸**');
		expect(format('***‸word‸***', 'bold')).toBe('*‸word‸*');
	});
});

describe('formatSelection: strikethrough and underline', () => {
	test('wraps the selection, keeps it selected, and unwraps it on a second press', () => {
		expect(format('a ‸b‸ c', 'strikethrough')).toBe('a ~~‸b‸~~ c');
		expect(format('a ‸b‸ c', 'underline')).toBe('a <u>‸b‸</u> c');
		expect(format('a ~~‸b‸~~ c', 'strikethrough')).toBe('a ‸b‸ c');
		expect(format('a <u>‸b‸</u> c', 'underline')).toBe('a ‸b‸ c');
	});

	test('unwraps a selection that takes in its own markers', () => {
		expect(format('‸~~b~~‸', 'strikethrough')).toBe('‸b‸');
		expect(format('‸<u>b</u>‸', 'underline')).toBe('‸b‸');
	});

	test('wraps a selection holding two underlined spans as a whole, rather than joining them', () => {
		expect(format('‸<u>a</u> and <u>b</u>‸', 'underline')).toBe('<u>‸<u>a</u> and <u>b</u>‸</u>');
	});

	test('keeps a space at the end of the selection outside the markers', () => {
		expect(format('‸b ‸', 'strikethrough')).toBe('~~‸b‸~~ ');
		expect(format('‸b ‸', 'underline')).toBe('<u>‸b‸</u> ');
	});

	test('puts the caret between the markers when nothing is selected', () => {
		expect(format('‸', 'strikethrough')).toBe('~~‸~~');
		expect(format('‸', 'underline')).toBe('<u>‸</u>');
	});
});

describe('formatSelection: link', () => {
	test('makes the selection the link text, with the caret where the address goes', () => {
		expect(format('see ‸docs‸', 'link')).toBe('see [docs](‸)');
	});

	test('puts the caret in the empty link text when nothing is selected', () => {
		expect(format('see ‸', 'link')).toBe('see [‸]()');
	});
});

describe('formatSelection: checklist', () => {
	test('turns the caret line into a checklist item', () => {
		expect(format('buy‸ milk', 'checklist')).toBe('- [ ] buy‸ milk');
		expect(format('‸', 'checklist')).toBe('- [ ] ‸');
	});

	test('adds a box to a list item, keeping its marker and indent', () => {
		expect(format('  - ‸milk', 'checklist')).toBe('  - [ ] ‸milk');
		expect(format('1. ‸milk', 'checklist')).toBe('1. [ ] ‸milk');
	});

	test('turns every selected line into an item and skips blank lines', () => {
		expect(format('‸one\n\ntwo‸', 'checklist')).toBe('- [ ] ‸one\n\n- [ ] two‸');
	});

	test('leaves out the line a selection ends at the start of', () => {
		expect(format('‸one\n‸two', 'checklist')).toBe('- [ ] ‸one\n‸two');
	});

	test('adds boxes only to the lines without one', () => {
		expect(format('‸- [x] one\ntwo‸', 'checklist')).toBe('‸- [x] one\n- [ ] two‸');
	});

	test('turns checklist items back into plain lines when every selected line is one', () => {
		expect(format('‸- [ ] one\n- [x] two‸', 'checklist')).toBe('‸one\ntwo‸');
		expect(format('- [ ] ‸milk', 'checklist')).toBe('‸milk');
	});

	test('edits only the selected lines', () => {
		expect(format('keep\n‸milk\nkeep', 'checklist')).toBe('keep\n- [ ] ‸milk\nkeep');
		expect(format('‸\nmilk', 'checklist')).toBe('- [ ] ‸\nmilk');
	});
});

describe('formatSelection: inline code', () => {
	test('wraps the selection in backticks, and unwraps it again', () => {
		expect(format('run ‸npm test‸ now', 'code')).toBe('run `‸npm test‸` now');
		expect(format('run `‸npm test‸` now', 'code')).toBe('run ‸npm test‸ now');
		expect(format('run ‸`npm test`‸ now', 'code')).toBe('run ‸npm test‸ now');
	});

	test('puts the caret between the backticks when nothing is selected', () => {
		expect(format('a ‸', 'code')).toBe('a `‸`');
	});
});

describe('formatSelection: bulleted and numbered lists', () => {
	test('turns each selected line into a list item', () => {
		expect(format('‸one\ntwo‸', 'bulleted')).toBe('- ‸one\n- two‸');
		expect(format('‸one\n\ntwo‸', 'numbered')).toBe('1. ‸one\n\n2. two‸');
	});

	test('turns list items back into plain lines when every selected line is one', () => {
		expect(format('‸- one\n- two‸', 'bulleted')).toBe('‸one\ntwo‸');
		expect(format('1. ‸one', 'numbered')).toBe('‸one');
		expect(format('1) ‸one', 'numbered')).toBe('‸one');
	});

	test('needs a space after a marker, so a line starting in bold is not an item', () => {
		expect(format('**Bold** ‸label', 'bulleted')).toBe('- **Bold** ‸label');
	});

	test('changes the kind of a list item, keeping its indent', () => {
		expect(format('  - ‸one', 'numbered')).toBe('  1. ‸one');
		expect(format('‸- [ ] one‸', 'bulleted')).toBe('‸- one‸');
	});
});

describe('formatSelection: code block', () => {
	test('puts the selected lines between fences', () => {
		expect(format('a\n‸one\ntwo‸\nb', 'codeBlock')).toBe('a\n```\n‸one\ntwo‸\n```\nb');
	});

	test('opens an empty block with the caret inside on a blank line', () => {
		expect(format('‸', 'codeBlock')).toBe('```\n‸\n```');
		expect(format('‸\n  ‸', 'codeBlock')).toBe('```\n‸\n```');
	});
});

describe('formatSelection: table', () => {
	const TABLE = '| ‸Column 1‸ | Column 2 |\n| --- | --- |\n|  |  |';

	test('replaces a blank line, selecting the first header', () => {
		expect(format('‸', 'table')).toBe(TABLE);
	});

	test('goes on new lines after a line with text, a blank line apart from the text around it', () => {
		expect(format('a‸b\nnext', 'table')).toBe(`ab\n\n${TABLE}\n\nnext`);
	});

	test('keeps a blank line from the text above a blank line it replaces', () => {
		expect(format('above\n‸', 'table')).toBe(`above\n\n${TABLE}`);
	});
});
