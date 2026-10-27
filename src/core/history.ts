import { moveEdit, type MoveEdit, type OwnEdit, type RunEdit } from './follow';
import { splitLines } from './lines';

export const HISTORY_LIMIT = 100;

/** A write that takes the list from one text to another, as Cmd+Z or Cmd+Shift+Z makes it. */
export interface HistoryWrite {
	next: string;
	edit: OwnEdit;
}

// `move`: a drag's map, which its undo turns around. `session`: the typing session whose keystrokes
// make this step, or null. `joinLine`: the line of the empty item or heading this step added, until
// the first edit of that line joins the step.
interface Step {
	before: string;
	after: string;
	move: MoveEdit | null;
	session: object | null;
	joinLine: number | null;
}

// An edit of one run of lines from the first line where the texts differ. A line whose ending is all
// that changed, such as the last line once a line goes after it, keeps its place.
export function textEdit(from: string, to: string): RunEdit {
	const old = splitLines(from);
	const now = splitLines(to);
	let start = 0;
	while (start < old.length && start < now.length && old[start]?.text === now[start]?.text) start++;
	const delta = now.length - old.length;
	return { start, delta, kind: delta > 0 ? 'insert' : delta < 0 ? 'delete' : 'change' };
}

// The view's own edits, for Cmd+Z and Cmd+Shift+Z (spec, "Saving, outside changes, sync conflicts,
// undo"). The steps form a chain, each one's `before` the `after` of the step below it, so an undo
// is a guarded write of a text the list held.
export class EditHistory {
	private readonly undoSteps: Step[] = [];
	private readonly redoSteps: Step[] = [];

	wrote(before: string, after: string, edit: OwnEdit): void {
		this.keepChain(before);
		const top = this.top();
		const redo = this.redoSteps[this.redoSteps.length - 1];
		// Neither an undo nor a redo may bring back an empty item or heading with nothing left to close
		// it, so an insert nothing joined can't be redone, and a cancel leaves no step.
		if (edit.history === 'undo' && top?.before === after) {
			const undone = this.pop();
			if (undone.joinLine === null) this.redoSteps.push(undone);
		} else if (edit.history === 'redo' && redo?.before === before && redo.after === after) {
			this.undoSteps.push(this.redoSteps.pop() as Step);
		} else if (edit.history === 'cancel') {
			if (top?.before === after) this.pop();
			else this.clear();
		} else if (top && edit.history === undefined && joins(top, edit)) {
			this.redoSteps.length = 0;
			top.after = after;
			top.joinLine = null;
		} else {
			const joinLine = edit.history === 'new' ? edit.start : null;
			this.push({ before, after, move: edit.kind === 'move' ? edit : null, session: null, joinLine });
		}
	}

	typed(session: object, before: string, after: string, edit: OwnEdit): void {
		this.keepChain(before);
		if (after !== before) this.redoSteps.length = 0;
		const top = this.top();
		if (top && joins(top, edit)) {
			top.session = session;
			top.joinLine = null;
		}
		if (top?.session !== session) {
			if (after !== before) this.push({ before, after, move: null, session, joinLine: null });
			return;
		}
		top.after = after;
		if (top.after === top.before) this.undoSteps.pop();
	}

	undo(text: string): HistoryWrite | null {
		const step = this.top();
		if (step?.after !== text) return null;
		const edit = step.move ? moveEdit(movedBack(step.move, step.after)) : textEdit(step.after, step.before);
		return { next: step.before, edit: { ...edit, history: 'undo' } };
	}

	redo(text: string): HistoryWrite | null {
		const step = this.redoSteps[this.redoSteps.length - 1];
		if (step?.before !== text) return null;
		const edit = step.move ?? textEdit(step.before, step.after);
		return { next: step.after, edit: { ...edit, history: 'redo' } };
	}

	clear(): void {
		this.undoSteps.length = 0;
		this.redoSteps.length = 0;
	}

	private top(): Step | undefined {
		return this.undoSteps[this.undoSteps.length - 1];
	}

	// A field that stays focused through the pop starts a new step.
	private pop(): Step {
		const step = this.undoSteps.pop() as Step;
		const exposed = this.top();
		if (exposed) exposed.session = null;
		return step;
	}

	// An undo never jumps over a change the history doesn't know.
	private keepChain(before: string): void {
		const top = this.top();
		if (top && top.after !== before) this.clear();
	}

	// A new action: what was undone can't be redone over it.
	private push(step: Step): void {
		this.redoSteps.length = 0;
		this.undoSteps.push(step);
		if (this.undoSteps.length > HISTORY_LIMIT) this.undoSteps.shift();
	}
}

// The first edit of a new empty item's or heading's line, such as its title or name.
function joins(step: Step, edit: OwnEdit): boolean {
	return step.joinLine !== null && edit.kind === 'change' && edit.start === step.joinLine;
}

// For each line after the move, the line it came from; null for a line the move added.
function movedBack(move: MoveEdit, after: string): (number | null)[] {
	const back: (number | null)[] = splitLines(after).map(() => null);
	move.moved.forEach((to, from) => {
		if (to !== null) back[to] = from;
	});
	return back;
}
