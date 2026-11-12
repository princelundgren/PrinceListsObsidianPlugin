import type { ListEditing, TrackedLine } from './editing';

/**
 * The rows the view has selected: rows chosen one at a time, plus the current range, the shown rows
 * from the anchor to the range's far end. Every row is a tracked line, so the selection follows the
 * view's own edits and outside changes. Never written or saved.
 */
export class RowSelection {
	private readonly chosen = new Set<TrackedLine>();
	private range: TrackedLine[] = [];
	private anchorRow: TrackedLine | null = null;
	private farEnd: TrackedLine | null = null;

	constructor(private readonly editing: ListEditing) {}

	get size(): number {
		return this.lines().length;
	}

	/** The line the next range grows from, or null. */
	get anchor(): number | null {
		return this.anchorRow?.line ?? null;
	}

	has(line: number): boolean {
		return this.lines().includes(line);
	}

	/** The selected lines, ascending. A row whose line went is dropped. */
	lines(): number[] {
		const lines = new Set<number>();
		for (const tracked of [...this.chosen, ...this.range]) {
			if (tracked.line === null) this.dropGone(tracked);
			else lines.add(tracked.line);
		}
		return [...lines].sort((a, b) => a - b);
	}

	/** The selected lines, ascending, while `line` is selected, alone or with others; otherwise null. */
	linesWith(line: number): number[] | null {
		const lines = this.lines();
		return lines.includes(line) ? lines : null;
	}

	/** Makes `line` the anchor and ends the range; its rows stay selected. */
	setAnchor(line: number | null): void {
		this.endRange();
		this.replaceAnchor(line === null ? null : this.editing.track(line));
	}

	/** Keeps the range's rows, adds `line` or removes it if selected, and makes it the anchor. */
	toggle(line: number): void {
		this.endRange();
		const found = [...this.chosen].find((tracked) => tracked.line === line);
		if (found) this.drop(found);
		else this.chosen.add(this.editing.track(line));
		this.replaceAnchor(this.editing.track(line));
	}

	/** Replaces the range with the shown rows from the anchor to `to`; with no shown anchor, toggles `to`. */
	selectRange(to: number, shown: readonly number[]): void {
		const anchor = this.anchor;
		if (anchor === null || !shown.includes(anchor)) this.toggle(to);
		else this.setRange(anchor, to, shown);
	}

	/** Starts over with `line` selected, and `also` too unless null, and makes `line` the anchor. */
	startWith(line: number, also: number | null): void {
		this.clear();
		if (also !== null && also !== line) this.toggle(also);
		this.toggle(line);
	}

	/**
	 * Replaces the range with the shown rows from the anchor to `to`, as selectRange does; with no shown
	 * anchor, adds `to` if it isn't selected and makes it the anchor. It never removes `to`.
	 */
	addRangeTo(to: number, shown: readonly number[]): void {
		const anchor = this.anchor;
		if (anchor !== null && shown.includes(anchor)) this.setRange(anchor, to, shown);
		else if (this.has(to)) this.setAnchor(to);
		else this.toggle(to);
	}

	/** Moves the range's far end one shown row up or down from where it is; does nothing with no shown anchor. */
	extend(step: 1 | -1, shown: readonly number[]): void {
		const anchor = this.anchor;
		if (anchor === null || !shown.includes(anchor)) return;
		const far = this.farEnd?.line ?? anchor;
		const from = shown.indexOf(shown.includes(far) ? far : anchor);
		const to = shown[Math.min(shown.length - 1, Math.max(0, from + step))];
		if (to !== undefined) this.setRange(anchor, to, shown);
	}

	/** Drops the rows and the anchor not in `shown`; a range that loses its anchor or far end ends. */
	keepOnly(shown: ReadonlySet<number>): void {
		for (const tracked of [...this.chosen, ...this.range]) {
			if (tracked.line === null || !shown.has(tracked.line)) this.dropGone(tracked);
		}
		const farGone = this.farEnd !== null && !this.isKept(this.farEnd, shown);
		if (this.anchorRow !== null && !this.isKept(this.anchorRow, shown)) {
			this.replaceAnchor(null);
			this.endRange();
		} else if (farGone) this.endRange();
	}

	clear(): void {
		for (const tracked of [...this.chosen, ...this.range]) this.editing.untrack(tracked);
		this.chosen.clear();
		this.range = [];
		this.replaceAnchor(null);
		this.replaceFarEnd(null);
	}

	private setRange(anchor: number, to: number, shown: readonly number[]): void {
		const a = shown.indexOf(anchor);
		const b = shown.indexOf(to);
		if (b === -1) return;
		for (const tracked of this.range) this.editing.untrack(tracked);
		this.range = shown.slice(Math.min(a, b), Math.max(a, b) + 1).map((line) => this.editing.track(line));
		this.replaceFarEnd(this.editing.track(to));
	}

	private endRange(): void {
		const chosenLines = new Set([...this.chosen].map((tracked) => tracked.line));
		for (const tracked of this.range) {
			if (chosenLines.has(tracked.line)) this.editing.untrack(tracked);
			else this.chosen.add(tracked);
		}
		this.range = [];
		this.replaceFarEnd(null);
	}

	private isKept(tracked: TrackedLine, shown: ReadonlySet<number>): boolean {
		return tracked.line !== null && shown.has(tracked.line);
	}

	private replaceAnchor(next: TrackedLine | null): void {
		if (this.anchorRow) this.editing.untrack(this.anchorRow);
		this.anchorRow = next;
	}

	private replaceFarEnd(next: TrackedLine | null): void {
		if (this.farEnd) this.editing.untrack(this.farEnd);
		this.farEnd = next;
	}

	private drop(tracked: TrackedLine): void {
		this.editing.untrack(tracked);
		this.chosen.delete(tracked);
	}

	private dropGone(tracked: TrackedLine): void {
		this.drop(tracked);
		this.range = this.range.filter((row) => row !== tracked);
	}
}
