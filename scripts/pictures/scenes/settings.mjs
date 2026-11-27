// Over To do, the gear opens Obsidian's settings, PrinceLists' tab scrolls to Appearance, and the
// overdue, today, upcoming and star colors are picked, the preview taking each at once. Closing the
// settings shows the list in the new colors.
import { boundsOf, click, drawnMouse, glideOver, hover, middleOf, scroll, setFolders, showAlone, sleep, type } from '../page.mjs';
import { pointer } from '../pointer.mjs';
import { recordGif } from '../record.mjs';

// Each setting and the letter that picks its choice. A dropdown takes the first choice the letter
// starts, so p is Purple, which comes before Pink.
const CHOICES = [
	['Overdue color', 'r'],
	['Today color', 'b'],
	['Upcoming color', 'p'],
	['Star color', 'o'],
];
// Right of the list's description, clear of every row.
const REST = { x: 900, y: 140 };
const DATA = `app.vault.configDir + '/plugins/princelists/data.json'`;
const LIST = '.workspace-leaf.mod-active';
// PrinceLists' theme colors besides none, as `src/core/theme-color.ts` lists them. Its star is
// yellow and its dates none unless the settings say otherwise.
const COLORS = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'];

const scene = {
	name: 'settings',
	phone: false,
	// The whole window, so the settings and the list behind them show.
	page: { width: 1000, height: 800 },
	scale: 1,
	theme: 'dark',
	async setup(session) {
		await checkSettingsInWindow(session);
		await setFolders(session, ['Home', 'Media', 'Projects', 'Travel']);
		await showAlone(session, 'To do.md', 'list');
		await hover(session, REST.x, REST.y);
	},
	async shoot(session, out) {
		await restoringSettings(session, () => recordGif(session, scene, out, () => pickColors(session)));
	},
};

/** Throws unless Settings opens inside the main window, where the recording can see it. */
async function checkSettingsInWindow(session) {
	const app = await session.evaluate(`(async () => {
		const path = app.vault.configDir + '/app.json';
		if (!(await app.vault.adapter.exists(path))) return {};
		const text = await app.vault.adapter.read(path);
		try {
			return JSON.parse(text);
		} catch (error) {
			throw new Error(path + " isn't valid JSON: " + error.message);
		}
	})()`);
	if (app.settingsPopoutWindow !== false) {
		throw new Error('Settings opens in its own window in this vault. Copy the demo vault again, which turns "Open settings in window" off.');
	}
}

/**
 * Runs `act` from the default settings, then puts PrinceLists' saved settings back as they were.
 * PrinceLists reloads its settings when the file changes, as when Sync brings it, so the recording
 * starts from the defaults and the next scene sees the old colors. The settings are put back before
 * the settings close, so a close that fails can't leave the new colors saved, and the settings
 * close even if putting them back fails.
 */
async function restoringSettings(session, act) {
	const saved = await session.evaluate(`(async () => (await app.vault.adapter.exists(${DATA})) ? app.vault.adapter.read(${DATA}) : null)()`);
	try {
		await writeSettings(session, '{}');
		await act();
	} finally {
		try {
			await writeSettings(session, saved ?? '{}');
			if (saved === null) await session.evaluate(`app.vault.adapter.remove(${DATA})`);
		} finally {
			if (await session.evaluate(`!!document.querySelector('.modal.mod-settings')`)) {
				const close = middleOf(await boundsOf(session, '.modal.mod-settings .lucide-x'));
				await click(session, close.x, close.y);
			}
		}
	}
}

/**
 * Writes `text` as PrinceLists' saved settings and waits until To do shows the colors it names: its
 * star color, and no date color it doesn't name. Removed any sooner, the file could go before
 * PrinceLists reads it.
 */
async function writeSettings(session, text) {
	await session.evaluate(`app.vault.adapter.write(${DATA}, ${JSON.stringify(text)})`);
	const settings = JSON.parse(text);
	const named = (color, fallback) => (color === 'none' || COLORS.includes(color) ? color : fallback);
	const star = named(settings.starColor, 'yellow');
	const days = [settings.overdueColor, settings.todayColor, settings.upcomingColor].map((color) => named(color, 'none'));
	const unnamed = COLORS.filter((color) => !days.includes(color)).map((color) => `${LIST} .princelists-when-${color}`).join(', ');
	await until(
		session,
		`!!document.querySelector('${LIST} .princelists-star-color-${star}') && !document.querySelector('${unnamed}')`,
		10000,
		"To do didn't show the colors in PrinceLists' data.json within 10 seconds of writing it.",
	);
}

/** Waits until the page expression `condition` is true, throwing `message` after `ms`. */
async function until(session, condition, ms, message) {
	const end = Date.now() + ms;
	while (!(await session.evaluate(condition))) {
		if (Date.now() > end) throw new Error(message);
		await sleep(100);
	}
}

/** Returns the bounds of the dropdown in the setting row named `name`. */
function dropdownOf(session, name) {
	return session.evaluate(`(() => {
		const row = [...document.querySelectorAll('.setting-item')].find((el) => el.querySelector('.setting-item-name')?.textContent === ${JSON.stringify(name)});
		if (!row) throw new Error(${JSON.stringify(`No setting is named "${name}".`)});
		const select = row.querySelector('select');
		if (!select) throw new Error(${JSON.stringify(`The setting "${name}" has no dropdown.`)});
		const { x, y, width, height } = select.getBoundingClientRect();
		return { x, y, width, height };
	})()`);
}

/**
 * Scrolls with the wheel at `x, y` until `target`'s bounds are in `view`'s with room to spare, a
 * little at a time over `ms`, as a hand does. A wheel past the end scrolls no further.
 */
async function wheelInto(session, view, target, { x, y }, ms) {
	const distance = Math.max(0, Math.round(target.y + target.height - (view.y + view.height) + 100));
	let scrolled = 0;
	await glideOver(ms, async (done) => {
		const step = Math.round(distance * done) - scrolled;
		scrolled += step;
		if (step !== 0) await scroll(session, x, y, step);
	});
}

async function pickColors(session) {
	const mouse = drawnMouse(session, REST.x, REST.y);
	const clickOn = async ({ x, y }, ms = 700) => {
		await mouse.glide(x, y, ms);
		await sleep(250);
		await mouse.click();
	};
	await pointer(session, REST.x, REST.y, 'move');
	await sleep(900);
	await clickOn(middleOf(await boundsOf(session, '.workspace-sidedock-vault-profile .lucide-settings')), 900);
	await sleep(900);

	// PrinceLists' tab is under Community plugins, at the end of the tab list.
	const tabs = await boundsOf(session, '.vertical-tab-header');
	await mouse.glide(tabs.x + tabs.width / 2, tabs.y + tabs.height * 0.6, 600);
	const tab = await boundsOf(session, '.vertical-tab-nav-item', 'PrinceLists');
	await wheelInto(session, await boundsOf(session, '.vertical-tab-header-group-container'), tab, mouse.at, 500);
	await sleep(300);
	await clickOn(middleOf(await boundsOf(session, '.vertical-tab-nav-item', 'PrinceLists')), 500);
	await sleep(900);

	// Appearance is the tab's last section and Star color its last row. Scrolled to the end, no
	// dropdown is scrolled into view on focus.
	const content = await boundsOf(session, '.vertical-tab-content');
	await mouse.glide(content.x + content.width / 2, content.y + content.height / 2, 600);
	await wheelInto(session, content, await dropdownOf(session, 'Star color'), mouse.at, 900);
	await sleep(1000);

	for (const [name, letter] of CHOICES) {
		await clickOn(middleOf(await dropdownOf(session, name)), 600);
		await type(session, letter);
		await sleep(1000);
	}

	await clickOn(middleOf(await boundsOf(session, '.modal.mod-settings .lucide-x')), 800);
	await sleep(500);
	await mouse.glide(REST.x, REST.y, 700);
	await sleep(2500);
}

export default scene;
