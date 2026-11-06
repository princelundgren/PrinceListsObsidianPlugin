// Chores with the Schedule in the right sidebar, and the file explorer closed.
import { DESKTOP, RESTING_POINT } from '../listing.mjs';
import { closeSchedule, hover, showAlone, showScheduleInSidebar, sleep, still } from '../page.mjs';

const scene = {
	name: 'desktop-3-schedule',
	...DESKTOP,
	setup: (session) => showAlone(session, 'Home/Chores.md', 'list'),
	async shoot(session, out) {
		try {
			await session.evaluate('app.workspace.leftSplit.collapse()');
			await showScheduleInSidebar(session);
			await hover(session, RESTING_POINT.x, RESTING_POINT.y);
			await sleep(300);
			await still(session, scene, out);
		} finally {
			await closeSchedule(session);
			await session.evaluate('app.workspace.leftSplit.expand()');
		}
	},
};
export default scene;
