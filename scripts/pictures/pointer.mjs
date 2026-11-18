// Draws a pointer (desktop) or a finger mark (phone) on the page, since CDP's screenshots and
// screencasts leave the system pointer out, and the picture a mouse drag carries, which they leave
// out too. It takes no events; shoot.mjs hides it when a scene ends.

const ID = 'princelists-picture-pointer';
const CARRIED_ID = 'princelists-picture-carried';
const ARROW = '<svg width="22" height="30" viewBox="0 0 22 30"><path d="M1.5 1.5v24l6-6 4 9 4-2-4-8.5h8.5z" fill="black" stroke="white" stroke-width="1.6" stroke-linejoin="round"/></svg>';
// See-through, so the rows the picture passes over still show.
const CARRIED_OPACITY = 0.75;

/**
 * Moves the drawn pointer, or on a phone page the finger mark, to `x, y` in CSS pixels, and with it
 * any picture `carry` drew. `down` darkens the finger mark while a touch lasts, `up` lightens it
 * again, and `hide` removes both.
 */
export async function pointer(session, x, y, state) {
	await session.evaluate(`(() => {
		const state = ${JSON.stringify(state)};
		let mark = document.getElementById('${ID}');
		const carried = document.getElementById('${CARRIED_ID}');
		if (state === 'hide') {
			carried?.remove();
			return mark?.remove();
		}
		const phone = matchMedia('(pointer: coarse)').matches;
		if (!mark) {
			mark = document.body.appendChild(document.createElement('div'));
			mark.id = '${ID}';
			mark.style.cssText = 'position: fixed; z-index: 2147483647; pointer-events: none;';
			if (phone) mark.style.cssText += 'width: 36px; height: 36px; margin: -18px 0 0 -18px; border-radius: 50%; background: rgb(128 128 128 / 0.35); border: 2px solid rgb(255 255 255 / 0.8);';
			else mark.innerHTML = ${JSON.stringify(ARROW)};
		}
		mark.style.left = '${x}px';
		mark.style.top = '${y}px';
		if (carried) {
			carried.style.left = (${x} - carried.dataset.grabX) + 'px';
			carried.style.top = (${y} - carried.dataset.grabY) + 'px';
		}
		if (phone) mark.style.background = state === 'down' ? 'rgb(128 128 128 / 0.6)' : 'rgb(128 128 128 / 0.35)';
	})()`);
}

/**
 * A picture of what the page shows in `bounds` (CSS pixels), for `carry`, `round` for a round
 * button. Taken where the drawn pointer is, it holds the pointer too, which `carry` draws over
 * exactly, since it keeps the picture at the point the pointer took it by.
 */
export async function pictureOf(session, { x, y, width, height }, round = false) {
	const { data } = await session.send('Page.captureScreenshot', { format: 'png', clip: { x, y, width, height, scale: 1 } });
	return { src: `data:image/png;base64,${data}`, x, y, width, height, round };
}

/**
 * Draws `picture` from `pictureOf` where it was taken, then under the drawn pointer, held at `x, y`,
 * where the pointer took it, until `letGo`: a mouse drag's own picture is drawn outside the page.
 */
export async function carry(session, picture, x, y) {
	await session.evaluate(`(() => {
		const img = document.body.appendChild(document.createElement('img'));
		img.id = '${CARRIED_ID}';
		img.src = ${JSON.stringify(picture.src)};
		img.dataset.grabX = ${x - picture.x};
		img.dataset.grabY = ${y - picture.y};
		img.style.cssText = 'position: fixed; z-index: 2147483646; pointer-events: none; opacity: ${CARRIED_OPACITY};'
			+ 'width: ${picture.width}px; height: ${picture.height}px; left: ${picture.x}px; top: ${picture.y}px;'
			+ '${picture.round ? 'border-radius: 50%;' : ''}';
	})()`);
}

/** Removes the picture `carry` drew. */
export async function letGo(session) {
	await session.evaluate(`document.getElementById('${CARRIED_ID}')?.remove()`);
}
