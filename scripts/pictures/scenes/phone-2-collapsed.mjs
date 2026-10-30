// On a phone, Groceries with its Bakery and Dairy sections collapsed.
import { PHONE, showGroceries, withTickedGroceries } from '../listing.mjs';
import { middleOf, sleep, still, tap } from '../page.mjs';

const arrowOf = (session, name) => session.evaluate(`(() => {
	const heading = [...document.querySelectorAll('.princelists-heading')].find((el) => el.firstChild?.textContent.trim() === ${JSON.stringify(name)});
	if (!heading) throw new Error(${JSON.stringify(`No heading in the list is named "${name}".`)});
	const { x, y, width, height } = heading.querySelector('.princelists-collapse').getBoundingClientRect();
	return { x, y, width, height };
})()`);

const scene = {
	name: 'phone-2-collapsed',
	...PHONE,
	setup: showGroceries,
	async shoot(session, out) {
		await withTickedGroceries(session, tap, async () => {
			for (const heading of ['Bakery', 'Dairy']) {
				const { x, y } = middleOf(await arrowOf(session, heading));
				await tap(session, x, y);
				await sleep(400);
			}
			await still(session, scene, out);
		});
	},
};
export default scene;
