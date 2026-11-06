// Kickoff meeting in reading view: an ordinary note with the Website relaunch list embedded in it.
import { DESKTOP, RESTING_POINT, showWithFolders } from '../listing.mjs';
import { hover, sleep, still } from '../page.mjs';

const scene = {
	name: 'desktop-6-embedded',
	...DESKTOP,
	setup: (session) => showWithFolders(session, 'Work/Kickoff meeting.md', 'note'),
	async shoot(session, out) {
		await hover(session, RESTING_POINT.x, RESTING_POINT.y);
		await sleep(500);
		await still(session, scene, out);
	},
};
export default scene;
