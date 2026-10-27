import { planItemLineEdit } from '../core/list-actions';
import { contentStartLine } from '../obsidian/marker';
import type { PrinceListView } from './list-view';
import { enqueueAt, writePlanned } from './write';

// A change to one item's title line, such as a star, on the view's write queue.
export function queueLineEdit(view: PrinceListView, titleLine: number, change: (line: string) => string): void {
	enqueueAt(view, titleLine, async (pending) => {
		const written = await writePlanned(view, (text) =>
			pending?.line == null ? null : planItemLineEdit(text, contentStartLine(text), pending.line, change),
		);
		// Obsidian's echo of the write returns early in setViewData, so the view draws the change.
		if (written) view.render();
	});
}
