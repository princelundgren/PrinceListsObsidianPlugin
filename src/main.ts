import { MarkdownView, Plugin } from 'obsidian';
import { RIBBON_ICON, VIEW_TYPE_LIST } from './constants';
import { isListText } from './obsidian/marker';
import { openAsList, openAsMarkdown, registerAutoSwitch } from './obsidian/switch';
import { PrinceListView } from './view/list-view';

export default class PrinceListsPlugin extends Plugin {
	onload() {
		this.registerView(VIEW_TYPE_LIST, (leaf) => new PrinceListView(leaf));
		registerAutoSwitch(this);

		// "Open as list" reads getViewData, the editor's text, here and in `file-menu` below. Saves
		// wait 2 seconds, so the inherited `data` may still hold a frontmatter the user just deleted.
		this.addCommand({
			id: 'open-as-list',
			name: 'Open as list',
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view?.file || !isListText(view.getViewData())) return false;
				if (!checking) void openAsList(view.leaf, view.file);
				return true;
			},
		});
		this.addCommand({
			id: 'open-as-markdown',
			name: 'Open as Markdown',
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(PrinceListView);
				if (!view?.file) return false;
				if (!checking) void openAsMarkdown(view.leaf, view.file);
				return true;
			},
		});

		// The list view adds "Open as Markdown" in its own onPaneMenu. `file-menu` also fires for
		// links and the file explorer, so only the pane's own file counts.
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file, _source, leaf) => {
				const view = leaf?.view;
				if (!(view instanceof MarkdownView) || !view.file || view.file !== file) return;
				if (!isListText(view.getViewData())) return;
				const listFile = view.file;
				menu.addItem((item) =>
					item
						.setTitle('Open as list')
						.setIcon(RIBBON_ICON)
						.onClick(() => void openAsList(view.leaf, listFile)),
				);
			}),
		);
	}
}
