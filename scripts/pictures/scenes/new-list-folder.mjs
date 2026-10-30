// A folder's right-click menu in the file explorer, with New list highlighted.
import { boundsOf, openMenuOn, pressEscape, setFolders, showAlone, still } from '../page.mjs';

const ITEM = 'New list';

const scene = {
	name: 'new-list-folder',
	phone: false,
	page: { width: 720, height: 603 },
	scale: 2,
	theme: 'dark',
	async setup(session) {
		await setFolders(session, ['Travel']);
		await showAlone(session, 'To do.md', 'list');
	},
	// The menu item, the file explorer to its left and the row below it.
	async clip(session) {
		const entry = await boundsOf(session, '.menu .menu-item', ITEM);
		return { x: Math.max(0, entry.x - 66), y: Math.max(0, entry.y + entry.height / 2 - 40), width: 220, height: 170 };
	},
	async shoot(session, out) {
		try {
			await openMenuOn(session, '.nav-folder-title[data-path="Travel"]', ITEM);
			await still(session, scene, out);
		} finally {
			await pressEscape(session);
		}
	},
};
export default scene;
