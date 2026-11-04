export type StartStep = 'make-list' | 'turn-into-list' | 'open-schedule';

export const START_STEPS: readonly StartStep[] = ['make-list', 'turn-into-list', 'open-schedule'];

export interface StepText {
	title: string;
	how: string;
}

/**
 * Tells, from the vault's events while the Getting started tab is open, which step a note that
 * becomes a list shows the user did. A note made as a list was created and never written to before
 * it was read as a list, as "Create new list" does; any other note that becomes a list was turned
 * into one, since "Turn into list" writes to it.
 */
export class NewListTracker {
	private readonly lists: Set<string>;
	private readonly madeAsList = new Set<string>();

	/** `lists`: the paths of the notes that are lists when the tab starts watching. */
	constructor(lists: Iterable<string>) {
		this.lists = new Set(lists);
	}

	created(path: string): void {
		this.madeAsList.add(path);
	}

	modified(path: string): void {
		this.madeAsList.delete(path);
	}

	renamed(oldPath: string, path: string): void {
		if (this.madeAsList.delete(oldPath)) this.madeAsList.add(path);
		if (this.lists.delete(oldPath)) this.lists.add(path);
	}

	deleted(path: string): void {
		this.madeAsList.delete(path);
		this.lists.delete(path);
	}

	/** Records that a note was read as a list or not, and returns the step that shows, if any. */
	indexed(path: string, isList: boolean): StartStep | null {
		const made = this.madeAsList.delete(path);
		if (!isList) {
			this.lists.delete(path);
			return null;
		}
		if (this.lists.has(path)) return null;
		this.lists.add(path);
		return made ? 'make-list' : 'turn-into-list';
	}
}

/** Each step's wording. Mobile has no right-click: a long-press opens the same menu. */
export function stepTexts(isMobile: boolean): Record<StartStep, StepText> {
	const press = isMobile ? 'Long-press' : 'Right-click';
	const select = isMobile ? 'Tap' : 'Click';
	return {
		'make-list': {
			title: 'Make a list',
			how: `${select} the list icon in the ribbon, or ${press.toLowerCase()} a folder and choose New list.`,
		},
		'turn-into-list': {
			title: 'Turn a note into a list',
			how: `${press} a note and choose Turn into list. Its checkboxes become items, and Turn into note takes it back.`,
		},
		'open-schedule': {
			title: "See what's coming up",
			how: 'The Schedule shows the dated items from all your lists.',
		},
	};
}
