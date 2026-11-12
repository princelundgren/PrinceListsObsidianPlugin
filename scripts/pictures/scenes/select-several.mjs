// In To do, a row is held until it is selected, two more are clicked to join it, and the bar's Move to
// puts all three under the Admin heading, where they stay selected.
import { titleOf } from '../listing.mjs';
import { boundsOf, drawnMouse, hover, middleOf, paneClip, showAlone, sleep, undoingChanges } from '../page.mjs';
import { pointer } from '../pointer.mjs';
import { recordGif } from '../record.mjs';

const REST = { x: 520, y: 120 };
const ROWS = ['renew the car insurance', 'call the plumber about the kitchen tap', 'book a dentist appointment'];
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
			await undoingChanges(session, 'To do.md', 'Attachments', () => recordGif(session, scene, out, () => selectAndMove(session)));
		} finally {
			await session.evaluate('app.workspace.leftSplit.expand()');
		}
	},
};

async function selectAndMove(session) {
	const mouse = drawnMouse(session, REST.x, REST.y);
	const titleStart = async (title) => {
		const { x, y, height } = await titleOf(session, title);
		return { x: x + 40, y: y + height / 2 };
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
	const move = middleOf(await boundsOf(session, '.princelists-selection-move'));
	await mouse.glide(move.x, move.y, 700);
	await sleep(300);
	await mouse.click();
	await sleep(900);
	const admin = middleOf(await boundsOf(session, '.prompt .suggestion-item', 'Admin'));
	await mouse.glide(admin.x, admin.y, 600);
	await sleep(300);
	await mouse.click();
	await sleep(900);
	await mouse.glide(REST.x, REST.y, 600);
	await sleep(2200);
}

export default scene;
