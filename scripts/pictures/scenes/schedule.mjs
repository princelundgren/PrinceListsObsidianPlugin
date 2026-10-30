// The Schedule opens from the ribbon and scrolls through dated items from several lists, under
// Today, Tomorrow, Next 7 days and the start of Later.
import { boundsOf, drawnMouse, hover, middleOf, scroll, setFolders, showAlone, sleep } from '../page.mjs';
import { pointer } from '../pointer.mjs';
import { recordGif } from '../record.mjs';

const REST = { x: 446, y: 332 };
const SCROLL_STEP = 24;
const SCROLL_STEP_MS = 50;

const scene = {
	name: 'schedule',
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
		const ribbon = middleOf(await boundsOf(session, '.side-dock-ribbon-action[aria-label="Open schedule"]'));
		const scrollBy = async (distance) => {
			for (let moved = 0; moved < distance; moved += SCROLL_STEP) {
				await scroll(session, mouse.at.x, mouse.at.y, SCROLL_STEP);
				await sleep(SCROLL_STEP_MS);
			}
		};
		await recordGif(session, scene, out, async () => {
			await pointer(session, REST.x, REST.y, 'move');
			await sleep(800);
			await mouse.glide(ribbon.x, ribbon.y, 700);
			await sleep(250);
			await mouse.click();
			await sleep(1300);
			await mouse.glide(REST.x, REST.y + 30, 600);
			await sleep(300);
			await scrollBy(320);
			await sleep(900);
			await scrollBy(320);
			await sleep(1400);
		});
	},
};
export default scene;
