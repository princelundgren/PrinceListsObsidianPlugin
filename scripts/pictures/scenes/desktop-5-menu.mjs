// An item's right-click menu in Groceries.
import { DESKTOP, showGroceriesWithFolders, titleOf, withTickedGroceries } from '../listing.mjs';
import { click, pressEscape, sleep, still } from '../page.mjs';

const scene = {
	name: 'desktop-5-menu',
	...DESKTOP,
	setup: showGroceriesWithFolders,
	async shoot(session, out) {
		await withTickedGroceries(session, click, async () => {
			const title = await titleOf(session, 'spinach');
			await click(session, title.x + 180, title.y + title.height / 2, 'right');
			await sleep(800);
			try {
				await still(session, scene, out);
			} finally {
				await pressEscape(session);
			}
		});
	},
};
export default scene;
