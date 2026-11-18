// In To do, two items are ticked and one is dragged up, then the floating + is dragged into the list,
// and the item it adds there gets a title, a day, a star and notes with a short list.
import { checkboxOf, rowOf, titleOf } from '../listing.mjs';
import { boundsOf, drawnMouse, hover, middleOf, paneClip, pressEnter, pressEscape, pressKey, setFolders, showAlone, sleep, type, undoingChanges } from '../page.mjs';
import { pictureOf, pointer } from '../pointer.mjs';
import { recordGif } from '../record.mjs';

const TICKED = ['renew the car insurance', 'return the library books'];
const MOVED = 'renew passport';
const MOVED_BELOW = 'call the plumber about the kitchen tap';
const ADDED_BELOW = 'book a dentist appointment';
const ITEM = 'build a raised bed';
// Right of the list's description, clear of every row.
const REST = { x: 760, y: 118 };

const scene = {
	name: 'list-desktop',
	phone: false,
	// The list's pane alone, about 600 wide beside the file explorer.
	page: { width: 840, height: 603 },
	clip: paneClip,
	scale: 1,
	theme: 'dark',
	async setup(session) {
		await setFolders(session, ['Home', 'Media', 'Projects', 'Travel']);
		await showAlone(session, 'To do.md', 'list');
		await hover(session, REST.x, REST.y);
	},
	async shoot(session, out) {
		await undoingChanges(session, 'To do.md', 'Attachments', () => recordGif(session, scene, out, () => tickMoveAndAdd(session)));
	},
};

async function tickMoveAndAdd(session) {
	const mouse = drawnMouse(session, REST.x, REST.y);
	const glideTo = async (selector, text) => {
		const { x, y } = middleOf(await boundsOf(session, selector, text));
		await mouse.glide(x, y);
		await sleep(150);
	};
	await pointer(session, REST.x, REST.y, 'move');
	await sleep(700);

	for (const title of TICKED) {
		const box = await checkboxOf(session, title);
		await mouse.glide(box.x, box.y);
		await sleep(150);
		await mouse.click();
		await sleep(700);
	}

	// The row's picture stops short of the floating + where the + lies over its end.
	const plusOnRow = await boundsOf(session, '.princelists-new-item');
	const movedRow = await rowOf(session, MOVED);
	const overlaps = plusOnRow.y < movedRow.y + movedRow.height && plusOnRow.y + plusOnRow.height > movedRow.y;
	const movedBounds = overlaps ? { ...movedRow, width: plusOnRow.x - movedRow.x - 8 } : movedRow;
	const movedTitle = await titleOf(session, MOVED);
	await mouse.glide(movedTitle.x + 40, movedTitle.y + movedTitle.height / 2);
	await sleep(200);
	const below = await rowOf(session, MOVED_BELOW);
	await mouse.drag(movedTitle.x + 40, below.y + below.height * 0.75, { ms: 1000, pictureBounds: movedBounds });
	await sleep(1000);

	// Taken before the drag, whose start hides the +, while the pointer is elsewhere.
	const plusPicture = await pictureOf(session, await boundsOf(session, '.princelists-new-item'), true);
	await glideTo('.princelists-new-item');
	await sleep(200);
	const target = await rowOf(session, ADDED_BELOW);
	await mouse.drag(target.x + target.width / 2, target.y + target.height * 0.75, { ms: 1100, picture: plusPicture });
	await sleep(600);
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
	const notes = await boundsOf(session, '.princelists-card .princelists-card-notes');
	// Off the format bar, whose buttons show tooltips, and right of the text typed.
	await mouse.glide(notes.x + notes.width * 0.75, notes.y + notes.height / 2 - 6, 300);
	await type(session, 'Larch lasts longest. To buy:');
	await pressEnter(session);
	await type(session, '- 4 planks, 240 cm');
	await pressEnter(session);
	await type(session, '8 corner brackets');
	await sleep(1200);
	await pressEscape(session);
	await sleep(900);
	await mouse.glide(REST.x, REST.y, 600);
	await sleep(1800);
}

export default scene;
