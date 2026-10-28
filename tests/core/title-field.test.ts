import { describe, expect, test } from 'vitest';
import { toggleLine } from '../../src/core/item-line';
import { joinLines, splitLines } from '../../src/core/lines';
import { joinTypedLines, oneLineTitle, startTitleField, syncTitleField, typeTitle, type TitleField } from '../../src/core/title-field';
import { list } from './edit-helpers';

// Types `final` one character at a time into the title of item n, as the field does: each keystroke
// edits the text the previous one wrote, re-parsed.
function typeChars(text: string, n: number, final: string) {
	const titleLine = list(text).item(n).titleLine;
	let field = startTitleField(splitLines(text)[titleLine]?.text ?? '');
	let current = text;
	for (let i = 1; i <= final.length; i++) {
		const { lines, items } = list(current);
		const item = items.find((candidate) => candidate.titleLine === titleLine);
		if (!item) throw new Error(`The item at line ${titleLine} is gone`);
		const typed = typeTitle(lines, item, field, final.slice(0, i));
		field = typed.field;
		current = joinLines(typed.lines);
	}
	return { text: current, line: splitLines(current)[titleLine]?.text, field };
}

describe('oneLineTitle', () => {
	test('replaces each line break with a space', () => {
		expect(oneLineTitle('a\nb\r\nc\rd')).toBe('a b c d');
		expect(oneLineTitle('plain')).toBe('plain');
	});
	test('replaces the Unicode line and paragraph separators with a space', () => {
		expect(oneLineTitle('a\u2028b\u2029c')).toBe('a b c');
	});
});

describe('joinTypedLines', () => {
	test.each([
		['a  \n\t b   c\n\nd', 'a b   c d'],
		['a\r\nb', 'a b'],
		['\n a', ' a'],
		['a   b\t', 'a   b\t'],
	])('%j', (typed, joined) => {
		expect(joinTypedLines(typed)).toBe(joined);
	});
	test('a long run of spaces joins in under 100 ms', () => {
		const typed = `x${' '.repeat(50_000)}y`;
		const start = performance.now();
		expect(joinTypedLines(typed)).toBe(typed);
		expect(performance.now() - start).toBeLessThan(100);
	});
});

describe('typeTitle across a typing session', () => {
	test('a typed #tag stays in the title once, instead of being read as the tail and copied', () => {
		expect(typeChars('- [ ] \n', 0, 'buy #milk2').line).toBe('- [ ] buy #milk2');
	});

	test('a typed date and block ID stay once too', () => {
		expect(typeChars('- [ ] \n', 0, 'call 📅 2026-10-30 ^abc').line).toBe('- [ ] call 📅 2026-10-30 ^abc');
	});

	test('the tail the line had when the field took focus is kept once, after the typed title', () => {
		const text = '- [ ] old #home 📅 2026-10-30 ^id1\n- [ ] b\n';
		expect(typeChars(text, 0, 'new #tag').line).toBe('- [ ] new #tag #home 📅 2026-10-30 ^id1');
	});

	test('a pasted line break becomes a space instead of throwing', () => {
		const { lines, item } = list('- [ ] a\n');
		const typed = typeTitle(lines, item(0), startTitleField('- [ ] a'), 'one\ntwo');
		expect(joinLines(typed.lines)).toBe('- [ ] one two\n');
	});

	test('a starred item keeps its star before its mark and fields', () => {
		const text = '- [x] milk ⭐ ✔ 2026-10-27 18:05 ⏳ 2026-10-30\n';
		expect(typeChars(text, 0, 'oat milk').line).toBe('- [x] oat milk ⭐ ✔ 2026-10-27 18:05 ⏳ 2026-10-30');
	});

	test('a done item keeps its mark after the typed title', () => {
		const text = '- [x] old ✔ 2026-10-20 09:00 #home\n';
		expect(typeChars(text, 0, 'new').line).toBe('- [x] new ✔ 2026-10-20 09:00 #home');
	});

	test('only the title line changes, with its ending', () => {
		const { text } = typeChars('- [ ] a\r\n- [ ] b\r\n', 1, 'bee');
		expect(text).toBe('- [ ] a\r\n- [ ] bee\r\n');
	});
});

describe('syncTitleField', () => {
	const field: TitleField = { saved: '- [ ] ', written: '- [ ] buy #milk2' };
	test('keeps the saved line while the line is the one the field wrote', () => {
		expect(syncTitleField(field, '- [ ] buy #milk2')).toBe(field);
	});
	// The typed tag reads as the tail of the ticked line, so re-seeding from it would make the next
	// keystroke copy the tag. The tick is made to the saved line instead.
	test("makes one of the view's own edits, such as a tick, to the saved line too", () => {
		const now = new Date(2026, 9, 21, 9, 0);
		const ticked = toggleLine(field.written, now);
		expect(ticked).toBe('- [x] buy ✔ 2026-10-21 09:00 #milk2');
		const synced = syncTitleField(field, ticked, (line) => toggleLine(line, now));
		expect(synced).toEqual({ saved: '- [x]  ✔ 2026-10-21 09:00', written: ticked });
		const { lines, item } = list(`${ticked}\n`);
		expect(joinLines(typeTitle(lines, item(0), synced, 'buy #milk23').lines)).toBe('- [x] buy #milk23 ✔ 2026-10-21 09:00\n');
	});

	test('takes the line as it now is when something else changed it without saying how', () => {
		const changed = '- [ ] something else';
		expect(syncTitleField(field, changed)).toEqual({ saved: changed, written: changed });
	});
});
