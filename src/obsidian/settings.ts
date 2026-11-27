import { type App, PluginSettingTab, type Plugin, type SettingDefinitionItem } from 'obsidian';
import { type ArchiveDelayHours, DEFAULT_ARCHIVE_DELAY_HOURS } from '../core/archive';
import type { ButtonPlatforms } from '../core/button-platforms';
import { DEFAULT_OVERDUE_COLOR, DEFAULT_TODAY_COLOR } from '../core/day-color';
import { DEFAULT_OVERDUE_LABEL, type OverdueLabel } from '../core/overdue';
import { DEFAULT_GROUP_BY_LIST } from '../core/schedule';
import { DEFAULT_TAG_STRIP_MODE, type TagStripMode } from '../core/tag-strip-mode';
import type { ThemeColor } from '../core/theme-color';
import { openSchedule } from './open-schedule';

export interface PrinceListsSettings {
	/** The folder "Create new list" puts a list in; empty means where Obsidian puts new notes. */
	newListFolder: string;
	/** How long after its tick a done item is archived, in hours, as the dropdown stores it. */
	archiveDelayHours: ArchiveDelayHours;
	/** What an overdue item's day says. */
	overdueLabel: OverdueLabel;
	/** The theme color of an overdue item's day. */
	overdueColor: ThemeColor;
	/** The theme color of the day of an open item due today. */
	todayColor: ThemeColor;
	/** Whether a list's header shows the "Open schedule" button. */
	showScheduleButton: boolean;
	/** Where a list shows the round "+" at its bottom right. */
	floatingAddButton: ButtonPlatforms;
	/** Whether a list and the Schedule show their tag strip always, or only while the filter field is open. */
	tagStrip: TagStripMode;
	/** Whether the Schedule splits each day by list, as its title row's button last left it. */
	groupScheduleByList: boolean;
}

export const DEFAULT_SETTINGS: PrinceListsSettings = {
	newListFolder: '',
	archiveDelayHours: DEFAULT_ARCHIVE_DELAY_HOURS,
	overdueLabel: DEFAULT_OVERDUE_LABEL,
	overdueColor: DEFAULT_OVERDUE_COLOR,
	todayColor: DEFAULT_TODAY_COLOR,
	showScheduleButton: false,
	floatingAddButton: 'both',
	tagStrip: DEFAULT_TAG_STRIP_MODE,
	groupScheduleByList: DEFAULT_GROUP_BY_LIST,
};

const ARCHIVE_DELAY_NAMES: Record<ArchiveDelayHours, string> = {
	'0': 'At once',
	'1': '1 hour',
	'12': '12 hours',
	'24': '1 day',
	'48': '2 days',
	'168': '1 week',
};

const OVERDUE_LABEL_NAMES: Record<OverdueLabel, string> = {
	'yesterday-or-date': 'Yesterday or the date',
	overdue: 'Overdue',
	today: 'Today',
};

const THEME_COLOR_NAMES: Record<ThemeColor, string> = {
	none: 'None',
	red: 'Red',
	orange: 'Orange',
	yellow: 'Yellow',
	green: 'Green',
	cyan: 'Cyan',
	blue: 'Blue',
	purple: 'Purple',
	pink: 'Pink',
};

const BUTTON_PLATFORM_NAMES: Record<ButtonPlatforms, string> = {
	both: 'Desktop and mobile',
	desktop: 'Desktop only',
	mobile: 'Mobile only',
	off: 'Off',
};

const TAG_STRIP_NAMES: Record<TagStripMode, string> = {
	always: 'Always',
	filtering: 'While filtering',
};

type SettingsHost = Plugin & { settings: PrinceListsSettings; settingChanged(key: keyof PrinceListsSettings): void };

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
		this.host.settingChanged(key as keyof PrinceListsSettings);
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
				name: 'Hide ticked items after',
				desc: 'How long a ticked item stays in its list before Show archived items is needed to see it. An item ticked on a date with no time counts from the end of that day.',
				control: {
					type: 'dropdown',
					key: 'archiveDelayHours',
					defaultValue: DEFAULT_SETTINGS.archiveDelayHours,
					options: ARCHIVE_DELAY_NAMES,
				},
			},
			{
				name: 'Overdue dates show',
				desc: "What an item's day says once it has passed and the item isn't ticked.",
				control: {
					type: 'dropdown',
					key: 'overdueLabel',
					defaultValue: DEFAULT_SETTINGS.overdueLabel,
					options: OVERDUE_LABEL_NAMES,
				},
			},
			{
				name: 'Overdue date color',
				desc: "The color of an overdue item's day, from your theme's colors.",
				control: {
					type: 'dropdown',
					key: 'overdueColor',
					defaultValue: DEFAULT_SETTINGS.overdueColor,
					options: THEME_COLOR_NAMES,
				},
			},
			{
				name: 'Today date color',
				desc: "The color of the day of an item due today, from your theme's colors.",
				control: {
					type: 'dropdown',
					key: 'todayColor',
					defaultValue: DEFAULT_SETTINGS.todayColor,
					options: THEME_COLOR_NAMES,
				},
			},
			{
				name: 'Tag strip',
				desc: "Where a list and the Schedule show their items' tags, to filter by: always, or only while the filter field is open.",
				control: {
					type: 'dropdown',
					key: 'tagStrip',
					defaultValue: DEFAULT_SETTINGS.tagStrip,
					options: TAG_STRIP_NAMES,
				},
			},
			{
				name: 'Floating add button',
				desc: 'Where a list shows the round "+" at its bottom right, which adds an item.',
				control: {
					type: 'dropdown',
					key: 'floatingAddButton',
					defaultValue: DEFAULT_SETTINGS.floatingAddButton,
					options: BUTTON_PLATFORM_NAMES,
				},
			},
			{
				name: 'Show Schedule button',
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
