// In To do, a row is held until it is selected, two more are clicked to join it, dragging one takes all
// three under the Admin heading, Add star from the bar's Star stars them, and Done ends selecting.
import { titleOf } from '../listing.mjs';
import { boundsOf, drawnMouse, headingBounds, hover, middleOf, paneClip, showAlone, sleep, undoingChanges } from '../page.mjs';
import { pointer } from '../pointer.mjs';
import { recordGif } from '../record.mjs';

const REST = { x: 520, y: 120 };
// None starred yet, so Star changes all three.
const ROWS = ['call the plumber about the kitchen tap', 'return the library books', 'book a dentist appointment'];
// Longer than the hold time, so the row is selected while the button is still down.
const HOLD_MS = 900;

const scene = {
	name: 'select-several',
	phone: false,
	// With the left sidebar collapsed, this width makes the list's pane 600 wide, and this height
	// keeps the moved rows above the bar.
	page: { width: 644, height: 700 },
	clip: paneClip,
	scale: 1,
	theme: 'dark',
	async setup(session) {
		await showAlone(session, 'To do.md', 'list');
		await hover(session, REST.x, REST.y);
	},
	async shoot(session, out) {
		try {
			await session.evaluate('app.workspace.leftSplit.collapse()');
			await sleep(600);
			await undoingChanges(session, 'To do.md', 'Attachments', () => recordGif(session, scene, out, () => selectDragAndStar(session)));
		} finally {
			await session.evaluate('app.workspace.leftSplit.expand()');
		}
	},
};

async function selectDragAndStar(session) {
	const mouse = drawnMouse(session, REST.x, REST.y);
	const titleStart = async (title) => {
		const { x, y, height } = await titleOf(session, title);
		return { x: x + 40, y: y + height / 2 };
	};
	const clickOn = async (selector, ms, text) => {
		const { x, y } = middleOf(await boundsOf(session, selector, text));
		await mouse.glide(x, y, ms);
		await sleep(300);
		await mouse.click();
	};
	await pointer(session, REST.x, REST.y, 'move');
	await sleep(800);
	const first = await titleStart(ROWS[0]);
	await mouse.glide(first.x, first.y, 700);
	await sleep(250);
	await mouse.press();
	await sleep(HOLD_MS);
	await mouse.release();
	await sleep(700);
	for (const title of ROWS.slice(1)) {
		const row = await titleStart(title);
		await mouse.glide(row.x, row.y, 600);
		await sleep(250);
		await mouse.click();
		await sleep(600);
	}
	const admin = await headingBounds(session, 'Admin');
	await mouse.drag(mouse.at.x, admin.y + admin.height * 0.75, 1000);
	await sleep(1000);
	await clickOn('.princelists-selection-star', 800);
	await sleep(700);
	await clickOn('.menu-item', 400, 'Add star');
	await sleep(1100);
	await clickOn('.princelists-selection-done', 700);
	await sleep(700);
	await mouse.glide(REST.x, REST.y, 600);
	await sleep(2200);
}

export default scene;
