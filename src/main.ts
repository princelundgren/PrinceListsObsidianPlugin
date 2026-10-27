import { MarkdownView, Notice, Plugin, TFile, TFolder } from 'obsidian';
import { RIBBON_ICON, SCHEDULE_ICON, VIEW_TYPE_LIST, VIEW_TYPE_SCHEDULE } from './constants';
import { createList } from './obsidian/create-list';
import { isListText } from './obsidian/marker';
import { openAsList, openAsMarkdown, registerAutoSwitch } from './obsidian/switch';
import { canTurnIntoList, turnIntoList } from './obsidian/turn-into-list';
import { openFilter } from './view/filter';
import { PrinceListView } from './view/list-view';
import { ScheduleView } from './view/schedule-view';

export default class PrinceListsPlugin extends Plugin {
	onload() {
		this.registerView(VIEW_TYPE_LIST, (leaf) => new PrinceListView(leaf));
		this.registerView(VIEW_TYPE_SCHEDULE, (leaf) => new ScheduleView(leaf));
		registerAutoSwitch(this);

		this.addCommand({
			id: 'new-list',
			name: 'New list',
			callback: () => void this.newListWhereNotesGo(),
		});
		this.addRibbonIcon(RIBBON_ICON, 'New list', () => void this.newListWhereNotesGo());
		this.addCommand({
			id: 'open-schedule',
			name: 'Open schedule',
			callback: () => void this.openSchedule(),
		});
		this.addRibbonIcon(SCHEDULE_ICON, 'Open schedule', () => void this.openSchedule());
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file instanceof TFolder) {
					menu.addItem((item) =>
						item
							.setTitle('New list')
							.setIcon(RIBBON_ICON)
							.onClick(() => void this.newList(file)),
					);
				} else if (file instanceof TFile && canTurnIntoList(this.app, file)) {
					menu.addItem((item) =>
						item
							.setTitle('Turn into list')
							.setIcon(RIBBON_ICON)
							.onClick(() => void turnIntoList(this, file)),
					);
				}
			}),
		);
		this.addCommand({
			id: 'turn-into-list',
			name: 'Turn into list',
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view?.file || !canTurnIntoList(this.app, view.file) || isListText(view.getViewData())) return false;
				if (!checking) void turnIntoList(this, view.file);
				return true;
			},
		});

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
		// On the iPhone, where Cmd+F needs a keyboard.
		this.addCommand({
			id: 'find-in-list',
			name: 'Find in list',
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(PrinceListView);
				if (!view?.file || !isListText(view.text)) return false;
				if (!checking) openFilter(view);
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

	private async openSchedule(): Promise<void> {
		const { workspace } = this.app;
		const open = workspace.getLeavesOfType(VIEW_TYPE_SCHEDULE)[0];
		if (open) workspace.setActiveLeaf(open, { focus: true });
		else await workspace.getLeaf('tab').setViewState({ type: VIEW_TYPE_SCHEDULE, active: true });
	}

	private newListWhereNotesGo(): Promise<void> {
		const active = this.app.workspace.getActiveFile();
		return this.newList(this.app.fileManager.getNewFileParent(active?.path ?? ''));
	}

	private async newList(folder: TFolder): Promise<void> {
		try {
			await createList(this.app, folder);
		} catch (error) {
			console.error('PrinceLists: could not create the list', error);
			new Notice("Couldn't create the list.");
		}
	}
}
