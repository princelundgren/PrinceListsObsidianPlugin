// Weeknight dinners as a list, with its Markdown beside it, opened from an item's Edit in Markdown.
import { DESKTOP, RESTING_POINT, titleOf } from '../listing.mjs';
import { boundsOf, click, hover, middleOf, showAlone, sleep, still } from '../page.mjs';

const scene = {
	name: 'desktop-5-markdown',
	...DESKTOP,
	setup: (session) => showAlone(session, 'Recipes/Weeknight dinners.md', 'list'),
	async shoot(session, out) {
		try {
			await session.evaluate('app.workspace.leftSplit.collapse()');
			await sleep(400);
			const title = await titleOf(session, 'chickpea curry');
			await click(session, title.x + 180, title.y + title.height / 2, 'right');
			await sleep(600);
			const entry = middleOf(await boundsOf(session, '.menu .menu-item', 'Edit in Markdown'));
			await click(session, entry.x, entry.y);
			await sleep(1000);
			await hover(session, RESTING_POINT.x, RESTING_POINT.y);
			await sleep(300);
			await still(session, scene, out);
		} finally {
			await session.evaluate(`(() => { for (const leaf of app.workspace.getLeavesOfType('markdown')) leaf.detach(); })()`);
			await session.evaluate('app.workspace.leftSplit.expand()');
		}
	},
};
export default scene;
