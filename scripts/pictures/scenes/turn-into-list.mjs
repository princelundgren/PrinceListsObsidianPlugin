// A note's right-click menu in the file explorer, with Turn into list highlighted.
import { boundsOf, openMenuOn, pressEscape, setFolders, showAlone, still } from '../page.mjs';

const ITEM = 'Turn into list';

const scene = {
	name: 'turn-into-list',
	phone: false,
	page: { width: 720, height: 603 },
	scale: 2,
	theme: 'dark',
	async setup(session) {
		// The folders above Travel, open, push its note low enough that the menu opens upward,
		// so the picture shows the note the menu belongs to.
		await setFolders(session, ['Home', 'Projects', 'Recipes', 'Travel']);
		await showAlone(session, 'Travel/Camping gear.md', 'note');
	},
	// The menu item, the file explorer to its left and the right-clicked note below it.
	async clip(session) {
		const entry = await boundsOf(session, '.menu .menu-item', ITEM);
		return { x: Math.max(0, entry.x - 66), y: Math.max(0, entry.y + entry.height / 2 - 55), width: 220, height: 170 };
	},
	async shoot(session, out) {
		try {
			await openMenuOn(session, '.nav-file-title[data-path="Travel/Camping gear.md"]', ITEM);
			await still(session, scene, out);
		} finally {
			await pressEscape(session);
		}
	},
};
export default scene;
