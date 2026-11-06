// On a phone, Groceries with its Bakery section collapsed.
import { PHONE, showGroceries, withTickedGroceries } from '../listing.mjs';
import { headingBounds, middleOf, sleep, still, tap } from '../page.mjs';

const scene = {
	name: 'phone-1-groceries',
	...PHONE,
	setup: showGroceries,
	async shoot(session, out) {
		await withTickedGroceries(session, tap, async () => {
			const { x, y } = middleOf(await headingBounds(session, 'Bakery', '.princelists-collapse'));
			await tap(session, x, y);
			await sleep(400);
			await still(session, scene, out);
		});
	},
};
export default scene;
