/** A text field's text and selection. */
export interface FieldState {
	value: string;
	start: number;
	end: number;
}

// The kinds of change that join the step before them while they go on where it stopped, as typing
// does in a note.
const RUNS = new Set(['insertText', 'insertCompositionText', 'deleteContentBackward', 'deleteContentForward']);

// One field's own undo and redo. A field changed by a script loses the browser's undo, so a card's
// fields keep theirs here. `kind` is the input event's inputType, or 'script' for a change the view
// made.
export class FieldHistory {
	private readonly undoSteps: FieldState[] = [];
	private readonly redoSteps: FieldState[] = [];
	private last: { kind: string; after: FieldState } | null = null;
	private pending: { before: FieldState; kind: string } | null = null;

	/** A change is about to happen, as beforeinput says; `didChange` gives the state after it. */
	willChange(before: FieldState, kind: string): void {
		this.pending = { before, kind };
	}

	didChange(after: FieldState): void {
		const pending = this.pending;
		this.pending = null;
		if (pending) this.changed(pending.before, after, pending.kind);
	}

	changed(before: FieldState, after: FieldState, kind: string): void {
		if (before.value === after.value) return;
		this.redoSteps.length = 0;
		const joins = this.last !== null && this.last.kind === kind && RUNS.has(kind) && sameState(this.last.after, before);
		if (!joins) this.undoSteps.push(before);
		this.last = { kind, after };
	}

	/** The state to restore, or null when there is nothing to undo. */
	undo(current: FieldState): FieldState | null {
		return this.step(this.undoSteps, this.redoSteps, current);
	}

	redo(current: FieldState): FieldState | null {
		return this.step(this.redoSteps, this.undoSteps, current);
	}

	private step(from: FieldState[], to: FieldState[], current: FieldState): FieldState | null {
		// A change announced but never made, such as a Backspace at the start, mustn't pair with this step.
		this.pending = null;
		const state = from.pop();
		if (!state) return null;
		to.push(current);
		this.last = null;
		return state;
	}
}

function sameState(a: FieldState, b: FieldState): boolean {
	return a.value === b.value && a.start === b.start && a.end === b.end;
}
