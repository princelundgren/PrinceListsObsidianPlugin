// On a phone, the Schedule in the right sidebar, opened over Groceries.
import { PHONE, showGroceries } from '../listing.mjs';
import { closeSchedule, showScheduleInSidebar, still } from '../page.mjs';

const scene = {
	name: 'phone-3-schedule',
	...PHONE,
	setup: showGroceries,
	async shoot(session, out) {
		try {
			await showScheduleInSidebar(session);
			await still(session, scene, out);
		} finally {
			await closeSchedule(session);
		}
	},
};
export default scene;
