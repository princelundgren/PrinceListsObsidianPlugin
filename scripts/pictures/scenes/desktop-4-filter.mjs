// To do filtered by "book" with archived items shown, so an archived match shows with its blue
// checkbox.
import { DESKTOP, RESTING_POINT, showWithFolders } from '../listing.mjs';
import { boundsOf, click, hover, middleOf, sleep, still, type } from '../page.mjs';

const scene = {
	name: 'desktop-4-filter',
	...DESKTOP,
	setup: (session) => showWithFolders(session, 'To do.md', 'list'),
	async shoot(session, out) {
		const icon = middleOf(await boundsOf(session, '.view-action[aria-label^="Filter list"]'));
		await click(session, icon.x, icon.y);
		await sleep(500);
		try {
			const toggle = middleOf(await boundsOf(session, '.princelists-archived-toggle'));
			await click(session, toggle.x, toggle.y);
			await sleep(300);
			await type(session, 'book');
			await hover(session, RESTING_POINT.x, RESTING_POINT.y);
			await sleep(500);
			await still(session, scene, out);
		} finally {
			// Closing the field clears it and hides archived items again.
			await click(session, icon.x, icon.y);
			await sleep(300);
		}
	},
};
export default scene;
