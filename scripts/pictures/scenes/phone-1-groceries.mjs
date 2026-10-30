// On a phone, Groceries with lemons' notes open.
import { PHONE, showGroceries, titleOf, withTickedGroceries } from '../listing.mjs';
import { sleep, still, tap } from '../page.mjs';

const scene = {
	name: 'phone-1-groceries',
	...PHONE,
	setup: showGroceries,
	async shoot(session, out) {
		await withTickedGroceries(session, tap, async () => {
			const title = await titleOf(session, 'lemons');
			await tap(session, title.x + 40, title.y + title.height / 2);
			await sleep(1000);
			await still(session, scene, out);
		});
	},
};
export default scene;
