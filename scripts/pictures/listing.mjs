// What the community listing's scenes share: their page sizes, and the ticks every Groceries shot shows.
import { boundsOf, middleOf, setFolders, showAlone, sleep, undoingChanges } from './page.mjs';

export const DESKTOP = { phone: false, page: { width: 1200, height: 800 }, scale: 2, theme: 'dark' };
export const PHONE = { phone: true, page: { width: 450, height: 800 }, scale: 2, theme: 'dark' };

// Above the list's title, where nothing shows a hover state or a tooltip.
export const RESTING_POINT = { x: 1000, y: 90 };

const TICKED = ['bananas', 'tomatoes on the vine'];

/** Returns where the item titled `title` has its title, throwing when no item has it. */
export const titleOf = (session, title) => boundsOf(session, '.princelists-item-title', title);

async function checkboxOf(session, title) {
	const box = await session.evaluate(`(() => {
		const row = [...document.querySelectorAll('.princelists-item')]
			.find((item) => item.querySelector('.princelists-item-title')?.textContent.trim() === ${JSON.stringify(title)});
		if (!row) throw new Error(${JSON.stringify(`No item in the list is titled "${title}".`)});
		const { x, y, width, height } = row.querySelector('.princelists-checkbox').getBoundingClientRect();
		return { x, y, width, height };
	})()`);
	return middleOf(box);
}

/** Shows Groceries alone in the main area. */
export const showGroceries = (session) => showAlone(session, 'Groceries.md', 'list');

/** Shows Groceries alone beside the file explorer, its folders set as the desktop shots show them. */
export async function showGroceriesWithFolders(session) {
	await setFolders(session, ['Home', 'Media', 'Projects', 'Travel']);
	await showGroceries(session);
}

/**
 * Ticks two items in the open Groceries with `press` (`click` or `tap`), runs `act`, then puts the
 * note back as it was.
 */
export async function withTickedGroceries(session, press, act) {
	await undoingChanges(session, 'Groceries.md', 'Attachments', async () => {
		for (const title of TICKED) {
			const { x, y } = await checkboxOf(session, title);
			await press(session, x, y);
			await sleep(400);
		}
		await act();
	});
}
