import { type App, PluginSettingTab, type Plugin, type SettingDefinitionItem } from 'obsidian';
import { openGettingStarted } from './open-getting-started';
import { openSchedule } from './open-schedule';

export interface PrinceListsSettings {
	/** The folder "Create new list" puts a list in; empty means where Obsidian puts new notes. */
	newListFolder: string;
}

export const DEFAULT_SETTINGS: PrinceListsSettings = {
	newListFolder: '',
};

/** PrinceLists' page in Obsidian's settings. Obsidian saves a control's value to `data.json` itself. */
export class PrinceListsSettingTab extends PluginSettingTab {
	constructor(app: App, plugin: Plugin & { settings: PrinceListsSettings }) {
		super(app, plugin);
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
				name: 'Schedule tab',
				desc: "Puts the Schedule back in the right sidebar if you've closed its tab.",
				render: (setting) => {
					setting.addButton((button) => button.setButtonText('Add to sidebar').onClick(() => void openSchedule(this.app.workspace)));
				},
			},
			{
				name: 'Getting started',
				desc: 'Shows how to make a list, turn a note into one and open the Schedule.',
				render: (setting) => {
					setting.addButton((button) => button.setButtonText('Show getting started').onClick(() => void openGettingStarted(this.app.workspace)));
				},
			},
		];
	}
}
