// On a phone, Groceries with its Bakery and Dairy sections collapsed.
import { PHONE, showGroceries, withTickedGroceries } from '../listing.mjs';
import { headingBounds, middleOf, sleep, still, tap } from '../page.mjs';

const scene = {
	name: 'phone-2-collapsed',
	...PHONE,
	setup: showGroceries,
	async shoot(session, out) {
		await withTickedGroceries(session, tap, async () => {
			for (const heading of ['Bakery', 'Dairy']) {
				const { x, y } = middleOf(await headingBounds(session, heading, '.princelists-collapse'));
				await tap(session, x, y);
				await sleep(400);
			}
			await still(session, scene, out);
		});
	},
};
export default scene;
