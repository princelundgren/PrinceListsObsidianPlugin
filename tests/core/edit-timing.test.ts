import { expect, test } from 'vitest';
import { setHeadingText } from '../../src/core/edit-headings';
import { moveItem, setItemNotes } from '../../src/core/edit-items';
import { setListNotePiece } from '../../src/core/edit-list-note';
import { joinLines, splitLines } from '../../src/core/lines';
import type { ItemBlock, Section } from '../../src/core/parse';
import { list } from './edit-helpers';

// About 3,000 lines: 1,500 items under 10 headings, every other one with a note, then a section
// where moving d below g needs two passes of empty lines.
const CASCADE = '## Z\n2. [ ] d\n- [ ] a\n\n\t```\n\tx\n\t```\nText\n- [ ] g\n\n\tnote\n';
let text = '';
for (let h = 0; h < 10; h++) {
	text += `## Section ${h}\n`;
	for (let i = 0; i < 150; i++) text += `- [ ] item ${i} 📅 2026-10-30\n` + (i % 2 === 0 ? '\n\tA note.\n' : '');
}
text += CASCADE;

// Each edit parses the whole file at least twice, so these catch a regression in that cost. The
// bounds leave room for a slow CI machine. The fastest of several runs counts: on a busy machine
// one run can be paused for longer than a bound, while a real regression slows every run.
function timed<T>(edit: () => T): { result: T; ms: number } {
	let result = edit();
	let ms = Infinity;
	for (let run = 0; run < 5; run++) {
		const started = performance.now();
		result = edit();
		ms = Math.min(ms, performance.now() - started);
	}
	return { result, ms };
}

test('setItemNotes, which runs on every keystroke, takes under 100 ms on a list of 3,000 lines', () => {
	const { lines, model, items } = list(text);
	expect(lines.length).toBeGreaterThan(3000);
	const { ms } = timed(() => setItemNotes(lines, model, items[760] as ItemBlock, 'Typed\n- a bullet'));
	expect(ms).toBeLessThan(100);
});

test('setListNotePiece, which runs on every keystroke, takes under 100 ms on a list of 3,000 lines', () => {
	const { lines, model } = list(text);
	const { result, ms } = timed(() => setListNotePiece(lines, model, { range: model.listNote, indent: '', separator: false, blankAfter: false }, 'Typed\n- a bullet'));
	expect(joinLines(result.lines).startsWith('Typed\n- a bullet\n\n## Section 0\n')).toBe(true);
	expect(ms).toBeLessThan(100);
});

test('setHeadingText takes under 100 ms on a list of 3,000 lines', () => {
	const { lines, model } = list(text);
	const { result, ms } = timed(() => setHeadingText(lines, model, model.sections[5] as Section, 'Renamed'));
	expect(result?.[(model.sections[5] as Section).headingLine as number]?.text).toBe('## Renamed');
	expect(ms).toBeLessThan(100);
});

test('moveItem, when it needs passes of empty lines, takes under 500 ms on a list of 3,000 lines', () => {
	const { lines, model, items } = list(text);
	const d = items[items.length - 3] as ItemBlock;
	const g = items[items.length - 1] as ItemBlock;
	const { result, ms } = timed(() => moveItem(lines, model, d, { after: g }));
	expect(joinLines(result).endsWith('- [ ] g\n\n\tnote\n\nText\n\n2. [ ] d\n')).toBe(true);
	expect(splitLines(joinLines(result)).length).toBe(lines.length + 2);
	expect(ms).toBeLessThan(500);
});
