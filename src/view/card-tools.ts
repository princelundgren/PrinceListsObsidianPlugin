import type { PrinceListView } from './list-view';

/** The open card's row of buttons under its notes: tag, date, repeat and ⋯. */
export const CARD_TOOLS_CLASS = 'princelists-card-tools';
const POPOVER_BELOW_CLASS = 'princelists-card-popover-below';

/** Scrolls the open card's buttons into view, as far as needed, then runs `then`, with or without a card. */
export function revealCardTools(view: PrinceListView, then: () => void): void {
	afterNotesLayout(view, () => toolsOf(view)?.scrollIntoView({ block: 'nearest' }), then);
}

/**
 * Places `popover`, which hangs from the open card's buttons: above them, or below them where above
 * would reach past the top of the list, which can't be scrolled to. Then scrolls it into view, with the
 * buttons.
 */
export function placeCardPopover(view: PrinceListView, popover: HTMLElement): void {
	afterNotesLayout(
		view,
		() => {
			toolsOf(view)?.scrollIntoView({ block: 'nearest' });
			const scroller = view.listScrollEl;
			return popover.getBoundingClientRect().top < scroller.getBoundingClientRect().top - scroller.scrollTop;
		},
		(below) => {
			popover.toggleClass(POPOVER_BELOW_CLASS, below);
			inReadPhase(view, () => popover.scrollIntoView({ block: 'nearest' }));
		},
	);
}

/**
 * Runs `read`, which may scroll but not change the page, once the notes editor has laid out its lines,
 * which can still move the buttons of a card just opened; then `write` with its result. The editor
 * runs a measure request's read before writing its new heights, so the second request reads after them.
 */
function afterNotesLayout<T>(view: PrinceListView, read: () => T, write: (value: T) => void): void {
	const editor = view.card?.editor;
	if (!editor) {
		write(read());
		return;
	}
	editor.requestMeasure({ read: () => null, write: () => editor.requestMeasure({ read, write }) });
}

function inReadPhase(view: PrinceListView, read: () => void): void {
	const editor = view.card?.editor;
	if (editor) editor.requestMeasure({ read });
	else read();
}

function toolsOf(view: PrinceListView): HTMLElement | null {
	return view.card?.el.querySelector<HTMLElement>(`.${CARD_TOOLS_CLASS}`) ?? null;
}
