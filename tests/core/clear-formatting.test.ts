import { describe, expect, test } from 'vitest';
import { formatSelection } from '../../src/core/format';

// `‸` marks the selection's ends, or the caret when there is one: 'a ‸word‸ b' selects "word".
function clear(marked: string): string {
	const start = marked.indexOf('‸');
	const last = marked.lastIndexOf('‸');
	const end = last === start ? start : last - 1;
	const text = marked.replaceAll('‸', '');
	const edit = formatSelection(text, start, end, 'clearFormatting');
	const next = text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
	const marks = edit.selectionStart === edit.selectionEnd ? [edit.selectionStart] : [edit.selectionStart, edit.selectionEnd];
	return marks.reduceRight((out, at) => out.slice(0, at) + '‸' + out.slice(at), next);
}

describe('formatSelection: clear formatting', () => {
	test('removes bold, italic, strikethrough, underline, highlight and inline code in the selection', () => {
		expect(clear('‸**a** *b* ~~c~~ <u>d</u> ==e== `f`‸')).toBe('‸a b c d e f‸');
		expect(clear('‸_a_ __b__ ***c***‸')).toBe('‸a b c‸');
	});

	test('removes the marks around a selection inside a span, and the caret clears the span it is in', () => {
		expect(clear('a **‸word‸** b')).toBe('a ‸word‸ b');
		expect(clear('a **wo‸rd** b')).toBe('a wo‸rd b');
		expect(clear('a <U>wo‸rd</U> b')).toBe('a wo‸rd b');
	});

	test('leaves a span the caret is only beside', () => {
		expect(clear('a **word**‸ b')).toBe('a **word**‸ b');
		expect(clear('a ‸**word** b')).toBe('a ‸**word** b');
	});

	test('clears the spans on every line of the selection', () => {
		expect(clear('‸**a**\n*b*\n- ~~c~~‸')).toBe('‸a\nb\n- c‸');
	});

	test('pairs an underline only within its paragraph, task, heading or table cell', () => {
		expect(clear('<u>a\n\nb‸c</u> d')).toBe('<u>a\n\nb‸c</u> d');
		expect(clear('# <u>a\n\n## b‸c</u>')).toBe('# <u>a\n\n## b‸c</u>');
		expect(clear('| <u>a | b‸c</u> |\n| - | - |')).toBe('| <u>a | b‸c</u> |\n| - | - |');
		expect(clear('- [ ] <u>a\n- [ ] b‸c</u>')).toBe('- [ ] <u>a\n- [ ] b‸c</u>');
		expect(clear('<u>a\n- [ ] b‸c</u>')).toBe('<u>a\n- [ ] b‸c</u>');
	});

	test('clears a whole span when the selection takes in only part of it', () => {
		expect(clear('**big wo‸rd‸** after')).toBe('big wo‸rd‸ after');
	});

	test('leaves spans the selection does not touch', () => {
		expect(clear('**a** ‸b‸ **c**')).toBe('**a** ‸b‸ **c**');
		expect(clear('**a** ‸b')).toBe('**a** ‸b');
	});

	test('keeps links, list markers, escaped markers and underscores inside words', () => {
		expect(clear('- [ ] ‸**buy** ==larch== at [the **yard**](x)‸')).toBe('- [ ] ‸buy larch at [the yard](x)‸');
		expect(clear('‸\\*a\\* snake_case_name‸')).toBe('‸\\*a\\* snake_case_name‸');
	});

	test('keeps == with a space inside, which is no highlight', () => {
		expect(clear('‸a == b == c‸')).toBe('‸a == b == c‸');
	});

	test('keeps wikilinks and embeds whole, with any marks in them', () => {
		expect(clear('‸[[__init__]] ![[pic _1_.png]] [[note#_Heading_]] [[note|**x**]] **y**‸')).toBe('‸[[__init__]] ![[pic _1_.png]] [[note#_Heading_]] [[note|**x**]] y‸');
	});

	test('leaves inline code whose text would read as Markdown without its backticks', () => {
		expect(clear('‸`npm test` and `a**b**c` and `d`‸')).toBe('‸npm test and `a**b**c` and d‸');
		expect(clear('‸``d`e`` and f`‸')).toBe('‸``d`e`` and f`‸');
		expect(clear('‸`$5` `#tag` `&amp;` `<b>` `[x]`‸')).toBe('‸`$5` `#tag` `&amp;` `<b>` `[x]`‸');
		expect(clear('‸`https://a.b` `- item` `1. item` `> quote` `---`‸')).toBe('‸`https://a.b` `- item` `1. item` `> quote` `---`‸');
	});

	test('leaves inline code whose text would pair with the text around it without its backticks', () => {
		for (const kept of ['`*a` b*', '`_a` b_', '`~~a` b~~', '`==a` b==', '`$a` b$', '`a%%` b%%', '`<a` b>', '`&amp`;', '`[a` b](x)', '`a #`tag']) {
			expect(clear(`‸${kept}‸`)).toBe(`‸${kept}‸`);
		}
		expect(clear('‸`a\\`‸*b*')).toBe('‸`a\\`‸*b*');
	});

	test('leaves inline code that would read as Markdown with the rest of its word', () => {
		for (const kept of ['<`b`> x', '#`tag` x', '&`amp`; x', '`1`. x', '`http`://a.b', '`-` x']) {
			expect(clear(`‸${kept}‸`)).toBe(`‸${kept}‸`);
		}
		expect(clear('‸`a` b\n`c`‸')).toBe('‸a b\nc‸');
	});

	test('keeps tags whole, as Obsidian reads them', () => {
		expect(clear('‸#_tag_ #a_b_c #__b__ #a/_b_ #_é_ #1_2_ *x*‸')).toBe('‸#_tag_ #a_b_c #__b__ #a/_b_ #_é_ #1_2_ x‸');
		expect(clear('‸**#_t_** ~~#_u_~~ ==#_v_==‸')).toBe('‸#_t_ #_u_ #_v_‸');
		expect(clear('‸#_t_*a* #_u_.‸')).toBe('‸#_t_a #_u_.‸');
		const decomposed = '#é/_b_'.normalize('NFD');
		expect(clear(`‸#a-_b_ ${decomposed} *x*‸`)).toBe(`‸#a-_b_ ${decomposed} x‸`);
	});

	test('reads a # after a letter, a bracket or a backslash as no tag', () => {
		expect(clear('‸x#_v_ (#_w_) \\#_z_‸')).toBe('‸x#v (#w) \\#z‸');
	});

	test('keeps math and comments whole, inline and as blocks', () => {
		expect(clear('‸$a*b*c$ and $$x_1_$$ and %%a *b*%% **d**‸')).toBe('‸$a*b*c$ and $$x_1_$$ and %%a *b*%% d‸');
		expect(clear('‸$$\na*b*c\n$$\n%%\n*d*\n%%\n**e**‸')).toBe('‸$$\na*b*c\n$$\n%%\n*d*\n%%\ne‸');
		expect(clear('‸$5 and *b* $6‸')).toBe('‸$5 and b $6‸');
		expect(clear('‸$ a*b*c$‸')).toBe('‸$ abc$‸');
		expect(clear('‸$a\\$b*c*$ **d**‸')).toBe('‸$a\\$b*c*$ d‸');
		expect(clear('‸a\n$$\nx\n\ny*z*\n$$‸')).toBe('‸a\n$$\nx\n\ny*z*\n$$‸');
		expect(clear('‸$$\na*b*\n\nc*d*\n$$\n\n%%\n*e*\n\n*f*\n%%‸')).toBe('‸$$\na*b*\n\nc*d*\n$$\n\n%%\n*e*\n\n*f*\n%%‸');
	});

	test('keeps a math or comment block whole inside a list item or quote, blank lines and all', () => {
		expect(clear('‸- x\n  $$\n  a*b*c\n\n  d*e*f\n  $$\n- **y**‸')).toBe('‸- x\n  $$\n  a*b*c\n\n  d*e*f\n  $$\n- y‸');
		expect(clear('‸- x\n  %%\n  a*b*c\n\n  d*e*f\n  %%\n- **y**‸')).toBe('‸- x\n  %%\n  a*b*c\n\n  d*e*f\n  %%\n- y‸');
		expect(clear('‸> $$\n> a*b*\n>\n> c*d*\n> $$\n\n**e**‸')).toBe('‸> $$\n> a*b*\n>\n> c*d*\n> $$\n\ne‸');
		expect(clear('‸>$$\n> a*b*\n>c*d*\n>$$‸')).toBe('‸>$$\n> a*b*\n>c*d*\n>$$‸');
		expect(clear('‸> - x\n>   $$\n>   a*b*\n>\n>   c*d*\n>   $$‸')).toBe('‸> - x\n>   $$\n>   a*b*\n>\n>   c*d*\n>   $$‸');
	});

	test('ends an unclosed math block where its list item or quote ends', () => {
		expect(clear('‸> $$\n> a\n\n**c**‸')).toBe('‸> $$\n> a\n\nc‸');
		expect(clear('‸- $$\n  x\n\n**y**‸')).toBe('‸- $$\n  x\n\ny‸');
		expect(clear('‸> - $$\n>   x\n>\n> **y**‸')).toBe('‸> - $$\n>   x\n>\n> y‸');
		expect(clear('‸>$$\n>a\n\n**b**‸')).toBe('‸>$$\n>a\n\nb‸');
		expect(clear('‸> $$\n> a\n\n> **c**‸')).toBe('‸> $$\n> a\n\n> c‸');
	});

	test('takes a lazy line right after an unclosed math block into it, as Obsidian draws it', () => {
		expect(clear('‸> $$\n> x\n**y**‸')).toBe('‸> $$\n> x\n**y**‸');
		expect(clear('‸- $$\n  x\n**y**‸')).toBe('‸- $$\n  x\n**y**‸');
		expect(clear('‸> - $$\n>   x\n> **y**‸')).toBe('‸> - $$\n>   x\n> **y**‸');
	});

	test('changes nothing when there is nothing to clear, so it leaves no empty undo step', () => {
		expect(formatSelection('a plain b', 2, 7, 'clearFormatting')).toEqual({ from: 2, to: 2, insert: '', selectionStart: 2, selectionEnd: 7 });
	});

	test('reads each line in its block, so a fenced code block keeps its markers', () => {
		expect(clear('```\n‸**a**‸\n```')).toBe('```\n‸**a**‸\n```');
	});
});
