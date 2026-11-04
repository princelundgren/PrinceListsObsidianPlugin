import { type App, PluginSettingTab, type Plugin, type SettingDefinitionItem } from 'obsidian';
import { openSchedule } from './open-schedule';

export interface PrinceListsSettings {
	/** The folder "Create new list" puts a list in; empty means where Obsidian puts new notes. */
	newListFolder: string;
	/** Whether a list's header shows the "Open schedule" button. */
	showScheduleButton: boolean;
}

export const DEFAULT_SETTINGS: PrinceListsSettings = {
	newListFolder: '',
	showScheduleButton: true,
};

type SettingsHost = Plugin & { settings: PrinceListsSettings; settingChanged(key: string): void };

/** PrinceLists' page in Obsidian's settings. Obsidian saves a control's value to `data.json` itself. */
export class PrinceListsSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly host: SettingsHost,
	) {
		super(app, host);
	}

	override async setControlValue(key: string, value: unknown): Promise<void> {
		await super.setControlValue(key, value);
		this.host.settingChanged(key);
	}

	override getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Folder for new lists',
				desc: 'Where "Create new list" puts a list, making the folder if it isn\'t there. Leave it empty to use the "Default location for new notes" in Files and links.',
				control: {
					type: 'folder',
					key: 'newListFolder',
					defaultValue: DEFAULT_SETTINGS.newListFolder,
				},
			},
			{
				name: 'Schedule button',
				desc: "Shows a button in a list's header that opens the Schedule.",
				control: {
					type: 'toggle',
					key: 'showScheduleButton',
					defaultValue: DEFAULT_SETTINGS.showScheduleButton,
				},
			},
			{
				name: 'Schedule tab',
				desc: "Puts the Schedule back in the right sidebar if you've closed its tab.",
				render: (setting) => {
					setting.addButton((button) => button.setButtonText('Add to sidebar').onClick(() => void openSchedule(this.app.workspace)));
				},
			},
		];
	}
}
