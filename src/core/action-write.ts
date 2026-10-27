import { guardedApply } from './guard';

/** `typed`: typing landed in the view while the action waited to write, so it wrote nothing. */
export type WriteOutcome = 'written' | 'refused' | 'typed';

/** What a one-off action's write did, as the view reports it. `failed`: the write itself failed, and a notice said so. */
export type WriteResult = 'written' | 'refused' | 'failed';

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
	/** Reads the file into the view again, as an outside change arrives. */
	reread(): Promise<void>;
}

// A one-off action's guarded write (spec, "Saving, outside changes, sync conflicts, undo"). Pending
// typing is saved first, so the guard doesn't refuse over the view's own text. Typing that lands
// while the action waits makes it write nothing: `next` was computed without it, and taking `next`
// would drop it. The caller runs the action again on the new text, but not an undo or a redo. A
// write that fails throws, and a view still holding the `next` it took reads the file again. Typing
// since then stays, and its own save writes it, `next` included.
export async function guardedWrite(target: WriteTarget, next: string, expected: string): Promise<WriteOutcome> {
	const textAtStart = target.text;
	await target.save();
	let outcome: WriteOutcome = 'refused';
	let taken = false;
	try {
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
			if (same) {
				target.took(next);
				taken = true;
			}
			return result;
		});
	} catch (error) {
		if (taken && target.text === next) {
			try {
				await target.reread();
			} catch (readError) {
				throw new AggregateError([error, readError], 'The write failed, and so did reading the file again.');
			}
		}
		throw error;
	}
	return outcome;
}

/** The view as an action that works its write out on the view's text sees it. */
export interface PlanTarget<T> {
	/** The view's text now, typing included. */
	readonly text: string;
	/** Whether the view still shows the file it showed when the action started. */
	sameFile(): boolean;
	/** Writes what was planned, through guardedWrite. */
	write(planned: T, expected: string): Promise<WriteResult>;
}

// Works an action out on the view's text and writes it. Typing that lands while it writes refuses it,
// and it runs once more on the new text, as a tick does. Resolves to what was written, or null. Once
// the view shows another file, it is null even when the write landed: what the caller does with it,
// such as opening a card on its line, would act on that other file. A write that failed isn't run
// again: typing since may have kept its text in the view, which a second run would change again.
export async function planAndWrite<T>(target: PlanTarget<T>, plan: (text: string) => T | null): Promise<T | null> {
	for (let attempt = 0; attempt < 2; attempt++) {
		const text = target.text;
		const planned = plan(text);
		if (!planned) return null;
		const result = await target.write(planned, text);
		if (!target.sameFile()) return null;
		if (result === 'written') return planned;
		if (result === 'failed' || target.text === text) return null;
	}
	return null;
}
