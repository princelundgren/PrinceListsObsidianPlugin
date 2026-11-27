import { dayOf } from './when';

/** A sample row in the settings' preview: its title, its When as `YYYY-MM-DD`, and whether it's starred. */
export interface PreviewRow {
	readonly title: string;
	readonly when: string;
	readonly starred: boolean;
}

/** The preview's sample rows for `now`: a starred one due the day before, so it's overdue, and one due today. */
export function previewRows(now: Date): readonly PreviewRow[] {
	const yesterday = dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
	return [
		{ title: 'Water the plants', when: yesterday, starred: true },
		{ title: 'Call the dentist', when: dayOf(now), starred: false },
	];
}
