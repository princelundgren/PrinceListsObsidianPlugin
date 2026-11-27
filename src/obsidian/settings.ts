import { type App, PluginSettingTab, type Plugin, type SettingDefinitionItem } from 'obsidian';
import { type ArchiveDelayHours, DEFAULT_ARCHIVE_DELAY_HOURS } from '../core/archive';
import type { ButtonPlatforms } from '../core/button-platforms';
import { DEFAULT_OVERDUE_COLOR, DEFAULT_TODAY_COLOR, DEFAULT_UPCOMING_COLOR } from '../core/day-color';
import { DEFAULT_OVERDUE_LABEL, type OverdueLabel } from '../core/overdue';
import { DEFAULT_GROUP_BY_LIST } from '../core/schedule';
import { DEFAULT_STAR_COLOR } from '../core/star';
import { DEFAULT_TAG_STRIP_MODE, type TagStripMode } from '../core/tag-strip-mode';
import type { ThemeColor } from '../core/theme-color';
import { drawSettingsPreview } from '../view/settings-preview';
import { openSchedule } from './open-schedule';
import type { OverdueLook } from './overdue-look';

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
	upcomingColor: ThemeColor;
	/** The theme color of an item's star. */
	starColor: ThemeColor;
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
	upcomingColor: DEFAULT_UPCOMING_COLOR,
	starColor: DEFAULT_STAR_COLOR,
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
		private readonly overdueLook: OverdueLook,
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
				type: 'group',
				heading: 'Lists',
				items: [
					{
						name: 'Folder for new lists',
						desc: 'Where "Create new list" puts a list. Leave empty to use Obsidian\'s location for new notes.',
						control: { type: 'folder', key: 'newListFolder', defaultValue: DEFAULT_SETTINGS.newListFolder },
					},
					{
						name: 'Hide ticked items after',
						desc: 'How long a ticked item stays in its list. One ticked on a day with no time counts from the end of that day.',
						control: { type: 'dropdown', key: 'archiveDelayHours', defaultValue: DEFAULT_SETTINGS.archiveDelayHours, options: ARCHIVE_DELAY_NAMES },
					},
					{
						name: 'Add button',
						desc: "The round + at a list's bottom right.",
						aliases: ['Floating add button'],
						control: { type: 'dropdown', key: 'floatingAddButton', defaultValue: DEFAULT_SETTINGS.floatingAddButton, options: BUTTON_PLATFORM_NAMES },
					},
					{
						name: 'Tag strip',
						desc: 'The row of tags to filter by, in lists and the Schedule.',
						control: { type: 'dropdown', key: 'tagStrip', defaultValue: DEFAULT_SETTINGS.tagStrip, options: TAG_STRIP_NAMES },
					},
				],
			},
			{
				type: 'group',
				heading: 'Schedule',
				items: [
					{
						name: 'Schedule button in lists',
						desc: "A button in each list's header that opens the Schedule.",
						aliases: ['Show Schedule button'],
						control: { type: 'toggle', key: 'showScheduleButton', defaultValue: DEFAULT_SETTINGS.showScheduleButton },
					},
					{
						name: 'Schedule in sidebar',
						desc: 'Puts the Schedule back in the right sidebar if you closed it.',
						aliases: ['Schedule tab'],
						render: (setting) => {
							setting.addButton((button) => button.setButtonText('Add to sidebar').onClick(() => void openSchedule(this.app.workspace)));
						},
					},
				],
			},
			{
				type: 'group',
				heading: 'Appearance',
				items: [
					{
						name: 'Preview',
						desc: 'Colors come from your theme.',
						searchable: false,
						render: (setting) => {
							setting.settingEl.addClass('princelists-settings-preview');
							const previewEl = setting.settingEl.createDiv({ cls: 'princelists-settings-preview-rows' });
							const draw = () => drawSettingsPreview(previewEl, this.overdueLook.style, new Date());
							draw();
							const ref = this.overdueLook.onChange(draw);
							return () => {
								this.overdueLook.offref(ref);
								previewEl.remove();
							};
						},
					},
					{
						name: 'Overdue label',
						desc: 'What the date says once an unticked item is past due.',
						aliases: ['Overdue dates show'],
						control: { type: 'dropdown', key: 'overdueLabel', defaultValue: DEFAULT_SETTINGS.overdueLabel, options: OVERDUE_LABEL_NAMES },
					},
					{
						name: 'Overdue color',
						desc: "The date of an item that's past due.",
						aliases: ['Overdue date color'],
						control: { type: 'dropdown', key: 'overdueColor', defaultValue: DEFAULT_SETTINGS.overdueColor, options: THEME_COLOR_NAMES },
					},
					{
						name: 'Today color',
						desc: 'The date of an item due today.',
						aliases: ['Today date color'],
						control: { type: 'dropdown', key: 'todayColor', defaultValue: DEFAULT_SETTINGS.todayColor, options: THEME_COLOR_NAMES },
					},
					{
						name: 'Upcoming color',
						desc: 'The date of an item due after today.',
						control: { type: 'dropdown', key: 'upcomingColor', defaultValue: DEFAULT_SETTINGS.upcomingColor, options: THEME_COLOR_NAMES },
					},
					{
						name: 'Star color',
						desc: "A starred item's star.",
						control: { type: 'dropdown', key: 'starColor', defaultValue: DEFAULT_SETTINGS.starColor, options: THEME_COLOR_NAMES },
					},
				],
			},
		];
	}
}
