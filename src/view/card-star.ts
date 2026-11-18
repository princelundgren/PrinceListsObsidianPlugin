import { isStarred, setStar } from '../core/star';
import { queueLineEdit } from './line-edit';
import type { PrinceListView } from './list-view';

// The open card's star button. It reads the line when the edit runs, so two quick taps star and
// unstar.
export function toggleCardStar(view: PrinceListView): void {
	const line = view.editing.selected;
	if (line !== null) queueLineEdit(view, line, (text) => setStar(text, !isStarred(text)));
}
