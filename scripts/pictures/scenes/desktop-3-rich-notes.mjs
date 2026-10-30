// Fresh basil's notes in the editor: formatted text, a link and a checklist, with the caret on the
// last line of the checklist, which draws its box.
import { DESKTOP, RESTING_POINT, showGroceriesWithFolders, titleOf, withTickedGroceries } from '../listing.mjs';
import { click, hover, pressEscape, sleep, still } from '../page.mjs';

const scene = {
	name: 'desktop-3-rich-notes',
	...DESKTOP,
	setup: showGroceriesWithFolders,
	async shoot(session, out) {
		await withTickedGroceries(session, click, async () => {
			const title = await titleOf(session, 'fresh basil');
			await click(session, title.x + 40, title.y + title.height / 2);
			await sleep(800);
			const end = await session.evaluate(`(() => {
				const { right, y, height } = [...document.querySelectorAll('.princelists-card .cm-line')].at(-1).getBoundingClientRect();
				return { x: right - 4, y: y + height / 2 };
			})()`);
			await click(session, end.x, end.y);
			await hover(session, RESTING_POINT.x, RESTING_POINT.y);
			// Soon after the click, while the caret hasn't blinked off.
			await sleep(150);
			try {
				await still(session, scene, out);
			} finally {
				await pressEscape(session);
				await pressEscape(session);
			}
		});
	},
};
export default scene;
