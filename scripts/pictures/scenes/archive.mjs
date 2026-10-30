// In To do, an item is ticked and grays out, then Show archived brings back three items ticked days
// ago and hides them again.
import { boundsOf, drawnMouse, hover, middleOf, setFolders, showAlone, sleep, undoingChanges } from '../page.mjs';
import { pointer } from '../pointer.mjs';
import { recordGif } from '../record.mjs';

const REST = { x: 446, y: 332 };

const scene = {
	name: 'archive',
	phone: false,
	page: { width: 720, height: 603 },
	scale: 1,
	theme: 'dark',
	async setup(session) {
		await setFolders(session, ['Home', 'Media', 'Projects', 'Travel']);
		await showAlone(session, 'To do.md', 'list');
		await hover(session, REST.x, REST.y);
	},
	async shoot(session, out) {
		const mouse = drawnMouse(session, REST.x, REST.y);
		const box = middleOf(await boundsOf(session, '.princelists-item:nth-child(4) .princelists-checkbox'));
		const toggle = middleOf(await boundsOf(session, '.view-action[aria-label="Show archived"]'));
		await undoingChanges(session, 'To do.md', 'Attachments', () => recordGif(session, scene, out, async () => {
			await pointer(session, REST.x, REST.y, 'move');
			await sleep(900);
			await mouse.glide(box.x, box.y, 700);
			await sleep(300);
			await mouse.click();
			await sleep(1300);
			await mouse.glide(toggle.x, toggle.y, 800);
			await sleep(300);
			await mouse.click();
			await sleep(600);
			await mouse.glide(REST.x, REST.y + 40, 600);
			await sleep(1800);
			await mouse.glide(toggle.x, toggle.y, 600);
			await sleep(300);
			await mouse.click();
			await sleep(600);
			await mouse.glide(REST.x, REST.y, 600);
			await sleep(500);
		}));
	},
};
export default scene;
