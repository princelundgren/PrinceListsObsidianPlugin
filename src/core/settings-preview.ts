import { dayOf } from './when';

/** A sample row in the settings' preview: its title, its When as `YYYY-MM-DD`, and whether it's starred. */
export interface PreviewRow {
	readonly title: string;
	readonly when: string;
	readonly starred: boolean;
}

/**
 * The preview's sample rows for `now`, in date order: two overdue, due a week before and the day
 * before (that one starred), one due today, and one due in three days.
 */
export function previewRows(now: Date): readonly PreviewRow[] {
	const day = (offset: number) => dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
	return [
		{ title: 'Return the library books', when: day(-7), starred: false },
		{ title: 'Water the plants', when: day(-1), starred: true },
		{ title: 'Call the dentist', when: day(0), starred: false },
		{ title: 'Pick up the parcel', when: day(3), starred: false },
	];
}
