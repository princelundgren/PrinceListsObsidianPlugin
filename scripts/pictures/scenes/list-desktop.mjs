// In To do, a new item gets a title, a day and a star, then notes with a link and a dropped picture,
// then it's dragged into place and another item is ticked.
import { fileURLToPath } from 'node:url';
import { boundsOf, drawnMouse, hover, middleOf, paneClip, pressEnter, pressEscape, pressKey, setFolders, showAlone, sleep, type, undoingChanges } from '../page.mjs';
import { pointer } from '../pointer.mjs';
import { recordGif } from '../record.mjs';

const PICTURE = fileURLToPath(new URL('../../../demo/vault/Attachments/raised-bed.jpg', import.meta.url));
const ITEM = 'build a raised bed';
const REST = { x: 446, y: 332 };

const scene = {
	name: 'list-desktop',
	phone: false,
	// The list's pane alone, about 600 wide beside the file explorer.
	page: { width: 840, height: 603 },
	clip: paneClip,
	scale: 1,
	theme: 'dark',
	async setup(session) {
		await setFolders(session, ['Attachments', 'Home', 'Media', 'Projects', 'Travel']);
		await showAlone(session, 'To do.md', 'list');
		await hover(session, REST.x, REST.y);
	},
	async shoot(session, out) {
		const mouse = drawnMouse(session, REST.x, REST.y);
		const glideTo = async (selector, text) => {
			const { x, y } = middleOf(await boundsOf(session, selector, text));
			await mouse.glide(x, y);
			await sleep(150);
		};
		await undoingChanges(session, 'To do.md', 'Attachments', () => recordGif(session, scene, out, async () => {
			await pointer(session, REST.x, REST.y, 'move');
			await sleep(700);
			await glideTo('.princelists-new-item');
			await mouse.click();
			await sleep(500);
			await type(session, ITEM);
			await sleep(300);
			// Set while the card is short enough to show its buttons, under the notes, and before the notes
			// have focus: they keep it through a press on the buttons, so the arrows would move their caret.
			await glideTo('.princelists-card .princelists-when-button');
			await mouse.click();
			await sleep(300);
			for (let i = 0; i < 2; i++) await pressKey(session, 'ArrowRight');
			await pressEnter(session);
			await sleep(800);
			await glideTo('.princelists-card .princelists-card-star');
			await mouse.click();
			await sleep(700);
			await glideTo('.princelists-card .princelists-card-notes');
			await mouse.click();
			await sleep(200);
			const { x: notesX, y: notesY, height } = await boundsOf(session, '.princelists-card .princelists-card-notes');
			// Off the format bar, whose buttons show tooltips.
			await mouse.glide(notesX + 60, notesY + height / 2 - 6, 300);
			await type(session, 'Larch lasts longest, about 40 for the planks.');
			await pressEnter(session);
			await type(session, 'Ideas: [the garden shop](https://example.com/garden)');
			await pressEnter(session);
			await sleep(300);
			const data = { items: [], files: [PICTURE], dragOperationsMask: 1 };
			const { x, y, width } = await boundsOf(session, '.princelists-card');
			await session.send('Input.dispatchDragEvent', { type: 'dragEnter', x: x + width / 2, y: y + 60, data });
			await session.send('Input.dispatchDragEvent', { type: 'dragOver', x: x + width / 2, y: y + 60, data });
			await session.send('Input.dispatchDragEvent', { type: 'drop', x: x + width / 2, y: y + 60, data });
			// Until the picture is saved and drawn in the notes, then long enough to see it.
			for (let waited = 0; !(await session.evaluate(`!!document.querySelector('.princelists-card img')`)); waited += 100) {
				if (waited > 10000) throw new Error('The dropped picture never showed in the notes.');
				await sleep(100);
			}
			await sleep(1500);
			await pressEscape(session);
			await sleep(900);

			const title = await boundsOf(session, '.princelists-item-title', ITEM);
			await mouse.glide(title.x + 40, title.y + title.height / 2);
			await sleep(200);
			const after = await boundsOf(session, '.princelists-item-title', 'return the library books');
			await mouse.drag(after.x + 60, after.y + after.height);
			await sleep(1000);

			await glideTo('.princelists-item .princelists-checkbox');
			await mouse.click();
			await sleep(900);
			await mouse.glide(REST.x, REST.y, 600);
			await sleep(1200);
		}));
	},
};
export default scene;
