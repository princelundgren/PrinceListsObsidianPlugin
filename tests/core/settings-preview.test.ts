import { expect, test } from 'vitest';
import { previewRows } from '../../src/core/settings-preview';

test('the first sample row is starred and due the day before now', () => {
	expect(previewRows(new Date(2026, 10, 27, 9))[0]).toEqual({ title: 'Water the plants', when: '2026-11-26', starred: true });
});

test('the second sample row is due today and not starred', () => {
	expect(previewRows(new Date(2026, 10, 27, 9))[1]).toEqual({ title: 'Call the dentist', when: '2026-11-27', starred: false });
});

test('the day before the first of a month is the last day of the month before', () => {
	expect(previewRows(new Date(2026, 2, 1, 0, 30))[0]?.when).toBe('2026-02-28');
});
