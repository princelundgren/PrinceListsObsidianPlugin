import { planComeBacks } from '../core/come-back';
import { contentStartLine, isListText } from '../obsidian/marker';
import type { PrinceListView } from './list-view';
import { enqueueAt, writeAction } from './write';

// The text each view's last comeback failed to write on: a failed write isn't tried again (step one's
// design, "Saving"), though the view reads the file again and redraws after it.
const failedOn = new WeakMap<PrinceListView, string>();

// Writes every due repeating item in the view's list back open, hidden ones included (spec,
// "Coming back"). It runs at each redraw, so it queues nothing while none is due, and nothing for a
// view out of sight, such as a background tab. Another view of the list that wrote first refuses it
// with no notice: the next redraw tries again.
export function bringBackInList(view: PrinceListView): void {
	if (!view.containerEl.isShown() || !comeBacks(view, view.text)) return;
	enqueueAt(view, null, async () => {
		const text = view.text;
		const planned = comeBacks(view, text);
		if (!planned) return;
		const result = await writeAction(view, planned.next, text, null);
		if (result === 'failed') failedOn.set(view, text);
		if (result !== 'written') return;
		// Nobody typed it, and a step recorded before it may no longer apply.
		view.editing.history.clear();
		view.render();
	});
}

function comeBacks(view: PrinceListView, text: string): { next: string } | null {
	if (!isListText(text) || failedOn.get(view) === text) return null;
	return planComeBacks(text, contentStartLine(text), new Date(), () => true);
}
