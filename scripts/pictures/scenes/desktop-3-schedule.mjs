// Groceries with the Schedule in the right sidebar, and the file explorer closed.
import { DESKTOP, RESTING_POINT, showGroceries, withTickedGroceries } from '../listing.mjs';
import { click, closeSchedule, hover, showScheduleInSidebar, sleep, still } from '../page.mjs';

const scene = {
	name: 'desktop-3-schedule',
	...DESKTOP,
	setup: showGroceries,
	async shoot(session, out) {
		try {
			await session.evaluate('app.workspace.leftSplit.collapse()');
			await showScheduleInSidebar(session);
			await withTickedGroceries(session, click, async () => {
				await hover(session, RESTING_POINT.x, RESTING_POINT.y);
				await sleep(300);
				await still(session, scene, out);
			});
		} finally {
			await closeSchedule(session);
			await session.evaluate('app.workspace.leftSplit.expand()');
		}
	},
};
export default scene;
