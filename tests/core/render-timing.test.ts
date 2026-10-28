import { expect, test } from 'vitest';
import { visibleSections } from '../../src/core/display';
import { ListEditing } from '../../src/core/editing';
import { needsMarkdown } from '../../src/core/inline';
import { splitLines } from '../../src/core/lines';
import { parseList } from '../../src/core/parse';
import { contentStartOf } from './edit-helpers';

// 500 items under 5 headings, every third with a note, and every tenth title with Markdown in it.
let text = '---\nprincelists: true\n---\nA note\n\n';
for (let h = 0; h < 5; h++) {
	text += `## Section ${h}\n`;
	for (let i = 0; i < 100; i++) {
		const title = i % 10 === 0 ? `**item ${i}** [[Link ${i}]]` : `item ${i}`;
		text += `- [ ] ${title} 📅 2026-10-30\n` + (i % 3 === 0 ? '\n\tA note.\n' : '');
	}
}

// The fastest of several runs counts, as in edit-timing.test.ts.
function fastest(run: () => void): number {
	run();
	let ms = Infinity;
	for (let i = 0; i < 5; i++) {
		const started = performance.now();
		run();
		ms = Math.min(ms, performance.now() - started);
	}
	return ms;
}

// The core's part of a redraw: one parse, the visible rows, and which titles and headings need
// Obsidian's renderer. What the renderer itself costs can only be seen in Obsidian (manual check 11).
test("the core's part of a redraw of 500 items takes under 50 ms, and 50 of the 505 titles and headings need the renderer", () => {
	let rendered = 0;
	const ms = fastest(() => {
		const lines = splitLines(text);
		const sections = visibleSections(lines, parseList(lines, 3), new Date(2026, 9, 21), { showArchived: false, query: '', keepLine: null, collapsed: new Set() });
		rendered = sections.flatMap((s) => [s.heading?.text ?? '', ...s.rows.map((r) => (r.kind === 'item' ? r.title : ''))]).filter(needsMarkdown).length;
	});
	expect(rendered).toBe(50);
	expect(ms).toBeLessThan(50);
});

test("a keystroke in a card's notes on a list of 500 items takes under 20 ms", () => {
	const state = new ListEditing((t) => contentStartOf(splitLines(t)));
	state.text = text;
	const titleLine = splitLines(text).findIndex((line) => line.text.startsWith('- [ ] item 51 '));
	state.open(titleLine);
	state.openNotesPiece({ start: titleLine + 1, end: titleLine + 1 }, true);
	let typed = '';
	const ms = fastest(() => {
		typed += 'x';
		state.typeNotesPiece(typed);
	});
	expect(ms).toBeLessThan(20);
});
