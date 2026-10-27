import { expect, test } from 'vitest';
import { boxesMatchChecklist, checklistOf, planChecklistTick, toggleChecklistLine } from '../../src/core/checklist';
import { splitLines } from '../../src/core/lines';
import { parseList, type ItemBlock } from '../../src/core/parse';

const TRIP = '- [ ] trip\n\n\tPack:\n\t- [ ] passport\n\t- [x] charger\n\t\t- [ ] cable\n\t1. [?] tickets\n';

function checklist(text: string) {
	const lines = splitLines(text);
	const item = parseList(lines, 0).sections[0]?.items[0] as ItemBlock;
	return checklistOf(lines, item);
}

test('checklistOf finds every checkbox line in the notes, nested and numbered too', () => {
	expect(checklist(TRIP)).toEqual([
		{ line: 3, ticked: false },
		{ line: 4, ticked: true },
		{ line: 5, ticked: false },
		{ line: 6, ticked: true },
	]);
});

test('checklistOf leaves out fenced and quoted lines', () => {
	const text = TRIP + '\n\t```\n\t- [ ] x\n\t```\n\n\t> - [ ] y\n';
	expect(checklist(text)?.map((entry) => entry.line)).toEqual([3, 4, 5, 6]);
});

// Obsidian doesn't render a box inside `%%` or `$$`, and an embed's box could take its place.
test('checklistOf gives null when a %% comment or $$ math is in the notes', () => {
	expect(checklist(TRIP + '\n\t%%\n\t- [ ] hidden\n\t%%\n\n\t![[Other]]\n')).toBeNull();
	expect(checklist(TRIP + '\n\t$$\n\t- [ ] x\n\t$$\n')).toBeNull();
	expect(planChecklistTick(TRIP + '\n\t%% note %%\n', 0, 0, 0, '\t- [ ] passport')).toBeNull();
	expect(boxesMatchChecklist([], null)).toBe(false);
});

test('toggleChecklistLine flips only the box', () => {
	expect(toggleChecklistLine('\t- [ ] passport')).toBe('\t- [x] passport');
	expect(toggleChecklistLine('\t- [x] charger')).toBe('\t- [ ] charger');
	expect(toggleChecklistLine('\t1. [?] tickets')).toBe('\t1. [ ] tickets');
	expect(toggleChecklistLine('\t- [ ] a ✔ 2026-10-27 18:05')).toBe('\t- [x] a ✔ 2026-10-27 18:05');
});

test('planChecklistTick flips the line the box stands for, as the file holds it now', () => {
	expect(planChecklistTick(TRIP, 0, 0, 1, '\t- [x] charger')).toEqual({
		next: TRIP.replace('[x] charger', '[ ] charger'),
		edit: { start: 4, delta: 0, kind: 'change' },
	});
	const crlf = TRIP.replace(/\n/g, '\r\n');
	expect(planChecklistTick(crlf, 0, 0, 1, '\t- [x] charger')?.next).toBe(crlf.replace('[x] charger', '[ ] charger'));
});

test('planChecklistTick gives null when the box no longer matches the file', () => {
	const withHeading = '# Trip\n' + TRIP;
	expect(planChecklistTick(TRIP, 0, 0, 4, '\t- [ ] passport')).toBeNull();
	expect(planChecklistTick(withHeading, 0, 0, 0, '\t- [ ] passport')).toBeNull();
	expect(planChecklistTick(TRIP, 0, 0, 1, '\t- [ ] passport')).toBeNull();
	const added = TRIP.replace('\t- [x] charger', '\t- [ ] socks\n\t- [x] charger');
	expect(planChecklistTick(added, 0, 0, 1, '\t- [x] charger')).toBeNull();
});

test('boxesMatchChecklist needs the same number of boxes, each ticked as its line is', () => {
	const lines = checklist(TRIP);
	expect(boxesMatchChecklist([false, true, false, true], lines)).toBe(true);
	expect(boxesMatchChecklist([false, true, false], lines)).toBe(false);
	expect(boxesMatchChecklist([false, true, false, false], lines)).toBe(false);
	expect(boxesMatchChecklist([false, true, false, true, false], lines)).toBe(false);
});
