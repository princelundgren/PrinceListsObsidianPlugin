import type { ListEditing, TrackedLine } from './editing';
import type { ListModel } from './parse';

// The view's collapsed headings, each a tracked line, so it follows the view's own edits and outside
// changes as the open card does. Never written or saved: a list opens with every heading open.
export class CollapsedHeadings {
	private readonly headings = new Set<TrackedLine>();

	constructor(private readonly editing: ListEditing) {}

	toggle(headingLine: number): void {
		const found = this.find(headingLine);
		if (found) this.drop(found);
		else this.headings.add(this.editing.track(headingLine));
	}

	expand(headingLine: number): void {
		const found = this.find(headingLine);
		if (found) this.drop(found);
	}

	clear(): void {
		for (const tracked of this.headings) this.editing.untrack(tracked);
		this.headings.clear();
	}

	/** The collapsed headings' lines now. A heading that went is dropped. */
	lines(): ReadonlySet<number> {
		const lines = new Set<number>();
		for (const tracked of this.headings) {
			if (tracked.line === null) this.drop(tracked);
			else lines.add(tracked.line);
		}
		return lines;
	}

	private find(headingLine: number): TrackedLine | undefined {
		return [...this.headings].find((tracked) => tracked.line === headingLine);
	}

	private drop(tracked: TrackedLine): void {
		this.editing.untrack(tracked);
		this.headings.delete(tracked);
	}
}

export function sectionHeadingOf(model: ListModel, line: number): number | null {
	let heading: number | null = null;
	for (const { headingLine } of model.sections) if (headingLine !== null && headingLine <= line) heading = headingLine;
	return heading;
}
