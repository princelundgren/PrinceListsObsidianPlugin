import { expect, test } from 'vitest';
import { checklistStatusAt, planNotesLineTick, toggleChecklistLine } from '../../src/core/checklist';

const TRIP = '- [ ] trip\n\n\tPack:\n\t- [ ] passport\n\t- [x] charger\n\t\t- [ ] cable\n\t1. [?] tickets\n';

test('toggleChecklistLine flips only the box', () => {
	expect(toggleChecklistLine('\t- [ ] passport')).toBe('\t- [x] passport');
	expect(toggleChecklistLine('\t- [x] charger')).toBe('\t- [ ] charger');
	expect(toggleChecklistLine('\t1. [?] tickets')).toBe('\t1. [ ] tickets');
	expect(toggleChecklistLine('\t- [ ] a ✔ 2026-10-27 18:05')).toBe('\t- [x] a ✔ 2026-10-27 18:05');
});

const PACKING = '---\nprincelists: true\n---\nPack:\n\n- bag\n  - [ ] passport\n  - [x] charger\n\n- [ ] trip\n';

test('planNotesLineTick ticks a checklist line in the notes and back, as the file holds it', () => {
	expect(planNotesLineTick(TRIP, 0, 0, 3, '\t- [ ] passport')).toEqual({
		next: TRIP.replace('[ ] passport', '[x] passport'),
		edit: { start: 3, delta: 0, kind: 'change' },
	});
	expect(planNotesLineTick(TRIP, 0, 0, 4, '\t- [x] charger')?.next).toBe(TRIP.replace('[x] charger', '[ ] charger'));
	expect(planNotesLineTick(TRIP, 0, 0, 5, '\t\t- [ ] cable')?.next).toBe(TRIP.replace('[ ] cable', '[x] cable'));
	const crlf = TRIP.replace(/\n/g, '\r\n');
	expect(planNotesLineTick(crlf, 0, 0, 3, '\t- [ ] passport')?.next).toBe(crlf.replace('[ ] passport', '[x] passport'));
});

// The editor knows which line drew the box, so nothing needs counting.
test('planNotesLineTick ticks a line in notes that hold a %% comment or $$ math', () => {
	const commented = TRIP + '\n\t%% later %%\n\t$$x$$\n';
	expect(planNotesLineTick(commented, 0, 0, 3, '\t- [ ] passport')?.next).toBe(commented.replace('[ ] passport', '[x] passport'));
});

test('planNotesLineTick gives null for a line that changed, or that is no checklist line in those notes', () => {
	const two = TRIP + '- [ ] home\n\t- [ ] keys\n';
	expect(planNotesLineTick(TRIP, 0, 0, 3, '\t- [x] passport')).toBeNull();
	expect(planNotesLineTick(two, 0, 0, 8, '\t- [ ] keys')).toBeNull();
	expect(planNotesLineTick(two, 0, 0, 0, '- [ ] trip')).toBeNull();
	expect(planNotesLineTick(TRIP, 0, 0, 2, '\tPack:')).toBeNull();
	expect(planNotesLineTick(TRIP, 0, 2, 3, '\t- [ ] passport')).toBeNull();
});

test("planNotesLineTick ticks the list note's nested box, and none of the items'", () => {
	expect(planNotesLineTick(PACKING, 3, 'listNote', 6, '  - [ ] passport')).toEqual({
		next: PACKING.replace('[ ] passport', '[x] passport'),
		edit: { start: 6, delta: 0, kind: 'change' },
	});
	expect(planNotesLineTick(PACKING, 3, 'listNote', 9, '- [ ] trip')).toBeNull();
});

test('checklistStatusAt gives the column of a checklist line\'s status, and null for any other line', () => {
	expect(checklistStatusAt('- [ ] a')).toBe(3);
	expect(checklistStatusAt('\t1. [x] b')).toBe(5);
	expect(checklistStatusAt('> - [ ] quoted')).toBeNull();
	expect(checklistStatusAt('Pack:')).toBeNull();
});
