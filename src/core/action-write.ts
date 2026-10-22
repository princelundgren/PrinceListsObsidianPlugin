import { guardedApply } from './guard';

/** `typed`: typing landed in the view while the action waited to write, so it wrote nothing. */
export type WriteOutcome = 'written' | 'refused' | 'typed';

/** The view and its file, as a one-off action's write sees them. */
export interface WriteTarget {
	/** The view's text now, typing included. */
	readonly text: string;
	/** Writes pending typing to the file. */
	save(): Promise<void>;
	/** Runs `fn` on the file's text and writes what it returns, as `vault.process` does. */
	process(fn: (current: string) => string): Promise<unknown>;
	/** Whether the view still shows the file being written. */
	sameFile(): boolean;
	/** The view takes the written text, before Obsidian's modify echo reaches it. */
	took(next: string): void;
}

// A one-off action's guarded write (spec, "Saving, outside changes, sync conflicts, undo"). Pending
// typing is saved first, so the guard doesn't refuse over the view's own text. Typing that lands
// while the action waits makes it write nothing: `next` was computed without it, and taking `next`
// would drop it. The caller runs the action again on the new text.
export async function guardedWrite(target: WriteTarget, next: string, expected: string): Promise<WriteOutcome> {
	const textAtStart = target.text;
	await target.save();
	let outcome: WriteOutcome = 'refused';
	await target.process((current) => {
		// The view moved to another file meanwhile: the write still lands, but the view's text isn't
		// this file's, so it neither stops the write nor takes it.
		const same = target.sameFile();
		if (same && target.text !== textAtStart) {
			outcome = 'typed';
			return current;
		}
		if (same && target.text !== expected) return current;
		const result = guardedApply(current, expected, next);
		if (result !== next) return result;
		outcome = 'written';
		if (same) target.took(next);
		return result;
	});
	return outcome;
}
