// On a phone, the Schedule alone.
import { PHONE } from '../listing.mjs';
import { showScheduleAlone, still } from '../page.mjs';

const scene = {
	name: 'phone-3-schedule',
	...PHONE,
	setup: showScheduleAlone,
	shoot: (session, out) => still(session, scene, out),
};
export default scene;
