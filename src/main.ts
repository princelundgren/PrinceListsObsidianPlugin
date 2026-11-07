import { FileView, MarkdownView, normalizePath, Notice, Plugin, TFile, TFolder } from 'obsidian';
import { RIBBON_ICON, SCHEDULE_ICON, VIEW_TYPE_LIST, VIEW_TYPE_SCHEDULE } from './constants';
import { archiveDelayHoursOf, archiveDelayMs } from './core/archive';
import { buttonPlatformsOf } from './core/button-platforms';
import { serialQueue } from './core/queue';
import { tagStripModeOf } from './core/tag-strip-mode';
import { ArchiveDelay } from './obsidian/archive-delay';
import { createList, openNewList } from './obsidian/create-list';
import { isListText } from './obsidian/marker';
import { addScheduleTab, openSchedule } from './obsidian/open-schedule';
import { DEFAULT_SETTINGS, type PrinceListsSettings, PrinceListsSettingTab } from './obsidian/settings';
import { openAsList, openAsMarkdown, registerAutoSwitch } from './obsidian/switch';
import { canTurnIntoList, turnIntoList } from './obsidian/turn-into-list';
import { canTurnIntoNote, turnIntoNote } from './obsidian/turn-into-note';
import { openFilter } from './view/filter';
import { ListBlock } from './view/list-block';
import { PrinceListView } from './view/list-view';
import { ScheduleView } from './view/schedule-view';
import { followTagStripMode } from './view/tag-strip';

export default class PrinceListsPlugin extends Plugin {
	settings: PrinceListsSettings = { ...DEFAULT_SETTINGS };
	private readonly archiveDelay = new ArchiveDelay(() => archiveDelayMs(this.settings.archiveDelayHours));
	private newListRequests = 0;
	private readonly enqueueNewList = serialQueue((error) => {
		console.error('PrinceLists: could not create the list', error);
		new Notice("Couldn't create the list.");
	});

	override async onload() {
		await this.loadSettings();
		this.addSettingTab(new PrinceListsSettingTab(this.app, this));
		this.registerView(VIEW_TYPE_LIST, (leaf) => new PrinceListView(leaf, this.archiveDelay, () => this.settings));
		this.registerView(VIEW_TYPE_SCHEDULE, (leaf) => new ScheduleView(leaf, this.archiveDelay, () => this.settings.tagStrip));
		this.registerMarkdownCodeBlockProcessor('princelists', (source, el, ctx) =>
			ctx.addChild(new ListBlock(this.app, el, source, ctx.sourcePath, this.archiveDelay)),
		);
		registerAutoSwitch(this);

		this.addCommand({
			id: 'new-list',
			name: 'Create new list',
			callback: () => void this.newList(() => this.folderForNewLists()),
		});
		this.addRibbonIcon(RIBBON_ICON, 'Create new list', () => void this.newList(() => this.folderForNewLists()));
		this.addCommand({
			id: 'open-schedule',
			name: 'Open schedule',
			callback: () => void openSchedule(this.app.workspace),
		});
		this.addRibbonIcon(SCHEDULE_ICON, 'Open schedule', () => void openSchedule(this.app.workspace));
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file instanceof TFolder) {
					menu.addItem((item) =>
						item
							.setTitle('New list')
							.setIcon(RIBBON_ICON)
							.setSection('action-primary')
							.onClick(() => void this.newList(() => file)),
					);
				} else if (file instanceof TFile && canTurnIntoList(this.app, file)) {
					menu.addItem((item) =>
						item
							.setTitle('Turn into list')
							.setIcon(RIBBON_ICON)
							.onClick(() => void turnIntoList(this, file)),
					);
				} else if (file instanceof TFile && canTurnIntoNote(this.app, file)) {
					menu.addItem((item) =>
						item
							.setTitle('Turn into note')
							.setIcon('file-text')
							.onClick(() => void turnIntoNote(this.app, file)),
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
		this.addCommand({
			id: 'turn-into-note',
			name: 'Turn into note',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveViewOfType(FileView)?.file;
				if (!file || !canTurnIntoNote(this.app, file)) return false;
				if (!checking) void turnIntoNote(this.app, file);
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
		// On mobile, where Cmd+F needs a keyboard. The Schedule's filter too, so one hotkey filters in both.
		this.addCommand({
			id: 'find-in-list',
			name: 'Filter list',
			checkCallback: (checking) => {
				const { workspace } = this.app;
				const list = workspace.getActiveViewOfType(PrinceListView);
				const view = workspace.getActiveViewOfType(ScheduleView) ?? (list?.file && isListText(list.text) ? list : null);
				if (!view) return false;
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

	override onUserEnable() {
		void addScheduleTab(this.app.workspace);
	}

	override async onExternalSettingsChange() {
		const before = this.archiveDelay.ms;
		const { floatingAddButton, headerAddButton, tagStrip } = this.settings;
		await this.loadSettings();
		if (this.archiveDelay.ms !== before) this.archiveDelay.changed();
		if (this.settings.floatingAddButton !== floatingAddButton || this.settings.headerAddButton !== headerAddButton) this.syncAddButtons();
		else this.syncListButtons();
		if (this.settings.tagStrip !== tagStrip) this.followTagStripModeInLists();
	}

	/** Called by the settings tab after it saves `key`. */
	settingChanged(key: keyof PrinceListsSettings): void {
		if (key === 'archiveDelayHours') this.archiveDelay.changed();
		if (key === 'showScheduleButton') this.syncListButtons();
		if (key === 'floatingAddButton' || key === 'headerAddButton') this.syncAddButtons();
		if (key === 'tagStrip') this.followTagStripModeInLists();
	}

	private listViews(): PrinceListView[] {
		return this.app.workspace.getLeavesOfType(VIEW_TYPE_LIST).flatMap((leaf) => (leaf.view instanceof PrinceListView ? [leaf.view] : []));
	}

	private syncListButtons(): void {
		for (const view of this.listViews()) view.syncButtons();
	}

	private syncAddButtons(): void {
		for (const view of this.listViews()) view.syncAddButtons();
	}

	private followTagStripModeInLists(): void {
		for (const view of this.listViews()) followTagStripMode(view);
	}

	private async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<PrinceListsSettings> | null;
		this.settings = {
			...DEFAULT_SETTINGS,
			...stored,
			archiveDelayHours: archiveDelayHoursOf(stored?.archiveDelayHours),
			floatingAddButton: buttonPlatformsOf(stored?.floatingAddButton, DEFAULT_SETTINGS.floatingAddButton),
			headerAddButton: buttonPlatformsOf(stored?.headerAddButton, DEFAULT_SETTINGS.headerAddButton),
			tagStrip: tagStripModeOf(stored?.tagStrip),
		};
	}

	private async folderForNewLists(): Promise<TFolder> {
		if (!this.settings.newListFolder.trim()) return this.app.fileManager.getNewFileParent(this.app.workspace.getActiveFile()?.path ?? '');
		const path = normalizePath(this.settings.newListFolder);
		return this.app.vault.getFolderByPath(path) ?? (await this.app.vault.createFolder(path));
	}

	// One at a time: overlapping runs pick the same name, and vault.create then returns the first run's file.
	private newList(folder: () => TFolder | Promise<TFolder>): Promise<void> {
		const request = ++this.newListRequests;
		return this.enqueueNewList(async () => {
			const file = await createList(this.app, await folder());
			if (request === this.newListRequests) await openNewList(this.app, file);
		});
	}
}
