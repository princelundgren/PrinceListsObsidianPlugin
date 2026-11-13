import { expect, test } from 'vitest';
import { listStripTags, visibleSections } from '../../src/core/display';
import { ListEditing } from '../../src/core/editing';
import { needsMarkdown } from '../../src/core/inline';
import { splitLines } from '../../src/core/lines';
import { parseList } from '../../src/core/parse';
import { NO_LIT_TAGS } from '../../src/core/tags';
import { contentStartOf } from './edit-helpers';

// 500 items under 5 headings, every third with a note, every tenth title with Markdown and a tag in it,
// and every seventh with a tag in its tail.
let text = '---\nprincelists: true\n---\nA note\n\n';
for (let h = 0; h < 5; h++) {
	text += `## Section ${h}\n`;
	for (let i = 0; i < 100; i++) {
		const title = i % 10 === 0 ? `**item ${i}** [[Link ${i}]] #title` : `item ${i}`;
		const tag = i % 7 === 0 ? ' #tail' : '';
		text += `- [ ] ${title}${tag} 📅 2026-10-30\n` + (i % 3 === 0 ? '\n\tA note.\n' : '');
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

// The core's part of a redraw: one parse, the visible rows, the strip's tags, and which titles and
// headings need Obsidian's renderer. What the renderer itself costs can only be seen in Obsidian
// (manual check 11).
test("the core's part of a redraw of 500 items takes under 50 ms, and 50 of the 505 titles and headings need the renderer", () => {
	let rendered = 0;
	let strip: string[] = [];
	const ms = fastest(() => {
		const lines = splitLines(text);
		const model = parseList(lines, 3);
		const now = new Date(2026, 9, 21);
		const sections = visibleSections(lines, model, now, { showArchived: false, starredOnly: false, lit: NO_LIT_TAGS, archiveDelayMs: 86_400_000, find: null, keepLine: null, collapsed: new Set() });
		strip = listStripTags(lines, model, now, { showArchived: false, archiveDelayMs: 86_400_000 }, []);
		rendered = sections.flatMap((s) => [s.heading?.text ?? '', ...s.rows.map((r) => (r.kind === 'item' ? r.title : ''))]).filter(needsMarkdown).length;
	});
	expect(rendered).toBe(50);
	expect(strip).toEqual(['tail', 'title']);
	expect(ms).toBeLessThan(50);
});

test("a keystroke in a card's notes on a list of 500 items takes under 20 ms", () => {
	const state = new ListEditing((t) => contentStartOf(splitLines(t)));
	state.text = text;
	const titleLine = splitLines(text).findIndex((line) => line.text.startsWith('- [ ] item 51 '));
	state.open(titleLine);
	state.openNotes('item');
	let typed = '';
	const ms = fastest(() => {
		typed += 'x';
		state.saveNotes({ from: 0, to: 1, lines: [typed] });
	});
	expect(state.text).toContain(`\t${typed}\n`);
	expect(ms).toBeLessThan(20);
});
