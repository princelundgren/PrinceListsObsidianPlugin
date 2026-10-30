// On a phone, Groceries with lemons' notes open.
import { PHONE, showGroceries, titleOf, withTickedGroceries } from '../listing.mjs';
import { middleOf, sleep, still, tap } from '../page.mjs';

const scene = {
	name: 'phone-1-groceries',
	...PHONE,
	setup: showGroceries,
	async shoot(session, out) {
		await withTickedGroceries(session, tap, async () => {
			const { x, y } = middleOf(await titleOf(session, 'lemons'));
			await tap(session, x, y);
			await sleep(1000);
			await still(session, scene, out);
		});
	},
};
export default scene;
