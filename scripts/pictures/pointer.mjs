// Draws a pointer (desktop) or a finger mark (phone) on the page, since CDP's screenshots and
// screencasts leave the system pointer out. It takes no events; shoot.mjs hides it when a scene ends.

const ID = 'princelists-picture-pointer';
const ARROW = '<svg width="22" height="30" viewBox="0 0 22 30"><path d="M1.5 1.5v24l6-6 4 9 4-2-4-8.5h8.5z" fill="black" stroke="white" stroke-width="1.6" stroke-linejoin="round"/></svg>';

/**
 * Moves the drawn pointer, or on a phone page the finger mark, to `x, y` in CSS pixels. `down`
 * darkens the finger mark while a touch lasts, `up` lightens it again, and `hide` removes it.
 */
export async function pointer(session, x, y, state) {
	await session.evaluate(`(() => {
		const state = ${JSON.stringify(state)};
		let mark = document.getElementById('${ID}');
		if (state === 'hide') return mark?.remove();
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
		if (phone) mark.style.background = state === 'down' ? 'rgb(128 128 128 / 0.6)' : 'rgb(128 128 128 / 0.35)';
	})()`);
}
