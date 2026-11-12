// On a phone, Groceries with its tag strip, and three Produce items selected, the bar at the bottom.
import { PHONE, showGroceries, titleOf } from '../listing.mjs';
import { boundsOf, fingerDown, fingerUp, middleOf, sleep, still, tap } from '../page.mjs';

const ROWS = ['bananas', 'lemons', 'fresh basil'];
// Longer than the hold time, so the first row is selected before the finger lifts.
const HOLD_MS = 800;
// Until the finger mark has faded.
const SETTLE_MS = 900;

const scene = {
	name: 'phone-2-select',
	...PHONE,
	setup: showGroceries,
	async shoot(session, out) {
		try {
			const first = middleOf(await titleOf(session, ROWS[0]));
			await fingerDown(session, first.x, first.y);
			await sleep(HOLD_MS);
			await fingerUp(session, first.x, first.y);
			for (const title of ROWS.slice(1)) {
				const { x, y } = middleOf(await titleOf(session, title));
				await tap(session, x, y);
				await sleep(300);
			}
			await sleep(SETTLE_MS);
			await still(session, scene, out);
		} finally {
			// No Done shows when the scene failed before selecting.
			const done = await boundsOf(session, '.princelists-selection-done').catch(() => undefined);
			if (done) {
				const { x, y } = middleOf(done);
				await tap(session, x, y);
				await sleep(300);
			}
		}
	},
};
export default scene;
