// The pointer on the ribbon's list icon, with its tooltip, Create new list.
import { boundsOf, hover, setFolders, showAlone, sleep, still } from '../page.mjs';

const ICON = '.side-dock-ribbon-action[aria-label="Create new list"]';

const scene = {
	name: 'new-list-ribbon',
	phone: false,
	page: { width: 720, height: 603 },
	scale: 2,
	theme: 'dark',
	async setup(session) {
		await setFolders(session, []);
		await showAlone(session, 'To do.md', 'list');
	},
	async clip(session) {
		const icon = await boundsOf(session, ICON);
		return { x: 0, y: Math.max(0, icon.y + icon.height / 2 - 50), width: 220, height: 170 };
	},
	async shoot(session, out) {
		const icon = await boundsOf(session, ICON);
		await hover(session, icon.x + icon.width / 2 + 4, icon.y + icon.height / 2 + 2, { drawn: true });
		await sleep(1500);
		await still(session, scene, out);
	},
};
export default scene;
