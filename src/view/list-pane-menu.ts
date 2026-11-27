import type { Menu } from 'obsidian';
import { SCHEDULE_ICON } from '../constants';
import { isListText } from '../obsidian/marker';
import { openSchedule } from '../obsidian/open-schedule';
import { openAsMarkdown } from '../obsidian/switch';
import { addStarredOnlyItem, toggleStarredOnly } from './filter';
import { openListTags } from './list-tags';
import type { PrinceListView } from './list-view';

/** Adds the list's items to its pane menu, after Obsidian's own. */
export function addListPaneItems(view: PrinceListView, menu: Menu): void {
	if (isListText(view.text)) {
		menu.addItem((item) => item.setTitle('Tag list…').setIcon('tag').onClick(() => openListTags(view)));
		menu.addItem((item) =>
			item
				.setTitle('Show archived items')
				.setIcon('archive')
				.setChecked(view.showArchived)
				.onClick(() => view.toggleArchived()),
		);
		addStarredOnlyItem(menu, view.starredOnly, () => toggleStarredOnly(view));
	}
	menu.addItem((item) =>
		item
			.setTitle('Open schedule')
			.setIcon(SCHEDULE_ICON)
			.onClick(() => void openSchedule(view.app.workspace)),
	);
	menu.addItem((item) =>
		item
			.setTitle('Open as Markdown')
			.setIcon('file-text')
			.onClick(() => {
				if (view.file) void openAsMarkdown(view.leaf, view.file);
			}),
	);
}
