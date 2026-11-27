import { Platform } from 'obsidian';
import { registerFieldEvents } from './events';
import type { PrinceListView } from './list-view';
import { registerMenuPress } from './menu-press';
import { registerFileRedraws } from './notes-drawing';
import { registerPopoverPress } from './popover-press';
import { showStarColor } from './row-marks';
import { focusListWhenActive } from './select';
import { onWindowReturn } from './window-return';

/** Registers what makes the view follow settings, focus, the window, the pointer and the vault's files, and sets its device classes. Call it once, from onOpen, after `super.onOpen()`. */
export function registerListEvents(view: PrinceListView): void {
	view.registerEvent(view.archiveDelay.onChange(() => view.render()));
	showStarColor(view.contentEl, view.overdueLook.style.starColor);
	view.registerEvent(view.overdueLook.onChange(() => {
		showStarColor(view.contentEl, view.overdueLook.style.starColor);
		view.render();
	}));
	view.registerEvent(view.app.workspace.on('active-leaf-change', (leaf) => {
		if (leaf === view.leaf) view.returned();
	}));
	onWindowReturn(view, view.containerEl, () => view.returned());
	registerFieldEvents(view);
	registerMenuPress(view);
	registerPopoverPress(view);
	focusListWhenActive(view);
	registerFileRedraws(view);
	view.contentEl.toggleClass('princelists-is-phone', Platform.isPhone);
	// The collapse arrows always show where there's no hover.
	view.contentEl.toggleClass('princelists-is-mobile', Platform.isMobile);
}
