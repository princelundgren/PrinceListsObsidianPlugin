import { expect, test } from 'vitest';
import { previewRows } from '../../src/core/settings-preview';

const now = new Date(2026, 10, 27, 9);

test('the first sample row is due a week before now and not starred', () => {
	expect(previewRows(now)[0]).toEqual({ title: 'Return the library books', when: '2026-11-20', starred: false });
});

test('the second sample row is starred and due the day before now', () => {
	expect(previewRows(now)[1]).toEqual({ title: 'Water the plants', when: '2026-11-26', starred: true });
});

test('the third sample row is due today and not starred', () => {
	expect(previewRows(now)[2]).toEqual({ title: 'Call the dentist', when: '2026-11-27', starred: false });
});

test('the fourth sample row is due three days after now and not starred', () => {
	expect(previewRows(now)[3]).toEqual({ title: 'Pick up the parcel', when: '2026-11-30', starred: false });
});

test('the day before the first of a month is the last day of the month before', () => {
	expect(previewRows(new Date(2026, 2, 1, 0, 30))[1]?.when).toBe('2026-02-28');
});

test('three days after a day near a month end falls in the next month', () => {
	expect(previewRows(new Date(2026, 10, 29, 9))[3]?.when).toBe('2026-12-02');
});
