// Groceries with greek yogurt's notes open, beside the file explorer.
import { DESKTOP, RESTING_POINT, showGroceriesWithFolders, titleOf, withTickedGroceries } from '../listing.mjs';
import { click, hover, middleOf, pressEscape, sleep, still } from '../page.mjs';

const scene = {
	name: 'desktop-1-groceries',
	...DESKTOP,
	setup: showGroceriesWithFolders,
	async shoot(session, out) {
		await withTickedGroceries(session, click, async () => {
			const { x, y } = middleOf(await titleOf(session, 'greek yogurt'));
			await click(session, x, y);
			await sleep(800);
			await hover(session, RESTING_POINT.x, RESTING_POINT.y);
			await sleep(300);
			try {
				await still(session, scene, out);
			} finally {
				await pressEscape(session);
			}
		});
	},
};
export default scene;
