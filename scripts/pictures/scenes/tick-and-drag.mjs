// On a phone, in Groceries, bananas is ticked, then greek yogurt is held and dragged onto spinach in
// a different section.
import { boundsOf, fingerDown, fingerSlide, fingerUp, middleOf, showAlone, sleep, undoingChanges } from '../page.mjs';
import { recordGif } from '../record.mjs';

const scene = {
	name: 'tick-and-drag',
	phone: true,
	page: { width: 390, height: 844 },
	scale: 1,
	theme: 'light',
	async setup(session) {
		await showAlone(session, 'Groceries.md', 'list');
	},
	async shoot(session, out) {
		const box = middleOf(await boundsOf(session, '.princelists-item .princelists-checkbox'));
		const titleAt = async (text) => {
			const { x, y, height } = await boundsOf(session, '.princelists-item-title', text);
			return { x: x + 30, y: y + height / 2 };
		};
		const from = await titleAt('greek yogurt');
		const to = await titleAt('spinach');
		await undoingChanges(session, 'Groceries.md', 'Attachments', () => recordGif(session, scene, out, async () => {
			await sleep(800);
			await fingerDown(session, box.x, box.y);
			await sleep(230);
			await fingerUp(session, box.x, box.y);
			await sleep(1100);
			await fingerDown(session, from.x, from.y);
			await sleep(600);
			await fingerSlide(session, from, to, 900);
			await sleep(300);
			await fingerUp(session, to.x, to.y);
			await sleep(1500);
		}));
	},
};
export default scene;
