// Groceries beside the Schedule, with the file explorer closed.
import { DESKTOP, RESTING_POINT, showGroceries, withTickedGroceries } from '../listing.mjs';
import { click, hover, sleep, still } from '../page.mjs';

const scene = {
	name: 'desktop-2-schedule',
	...DESKTOP,
	setup: showGroceries,
	async shoot(session, out) {
		try {
			await session.evaluate(`(async () => {
				app.workspace.leftSplit.collapse();
				await app.workspace.getLeaf('split', 'vertical').setViewState({ type: 'princelists-schedule' });
			})()`);
			await sleep(800);
			await withTickedGroceries(session, click, async () => {
				await hover(session, RESTING_POINT.x, RESTING_POINT.y);
				await sleep(300);
				await still(session, scene, out);
			});
		} finally {
			await session.evaluate('app.workspace.leftSplit.expand()');
		}
	},
};
export default scene;
