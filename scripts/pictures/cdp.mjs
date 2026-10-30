// A small client for the Chrome DevTools protocol, which Obsidian serves on the port it was started
// with (`--remote-debugging-port`), or which adb forwards from Android.
import { MARKER, THEMES } from './demo-vault.mjs';

const APP_PAGES = ['app://obsidian.md', 'http://localhost'];
// Longer than any wait in a scene, so only a page that has stopped answering reaches it.
const ANSWER_MS = 15000;

/**
 * Returns the WebSocket URL of the one `page` target that is Obsidian's app page. Throws, listing
 * every target's type and URL, when there is none or more than one.
 */
export function pickPage(targets) {
	const pages = targets.filter((t) => t.type === 'page' && APP_PAGES.some((start) => t.url.startsWith(start)));
	if (pages.length === 1) return pages[0].webSocketDebuggerUrl;
	const listed = targets.map((t) => `${t.type} ${t.url}`).join('\n') || '(none)';
	throw new Error(`Expected one Obsidian page among the DevTools targets, found ${pages.length}:\n${listed}`);
}

async function listTargets(port) {
	try {
		const response = await fetch(`http://127.0.0.1:${port}/json/list`);
		return await response.json();
	} catch (cause) {
		throw new Error(`Nothing answers on DevTools port ${port}. Quit Obsidian and start it with --remote-debugging-port=${port} (AGENTS.md).`, { cause });
	}
}

/**
 * Connects to Obsidian's app page on `port` of this machine. The session's `send` runs a CDP
 * method, `on` listens for a CDP event, `evaluate` runs an expression in the page, awaiting a
 * promise, and returns its value or throws the page's exception, and `close` ends the session.
 * A call the page doesn't answer within 15 seconds, or that the socket's closing cuts off, throws
 * naming its method.
 */
export async function connect(port) {
	const socket = new WebSocket(pickPage(await listTargets(port)));
	await new Promise((resolve, reject) => {
		socket.addEventListener('open', resolve, { once: true });
		socket.addEventListener('error', () => reject(new Error(`Couldn't open the DevTools socket on port ${port}`)), { once: true });
	});
	const waiting = new Map();
	const handlers = new Map();
	let lastId = 0;
	const settle = (id) => {
		const call = waiting.get(id);
		waiting.delete(id);
		clearTimeout(call.timer);
		return call;
	};
	socket.addEventListener('message', ({ data }) => {
		const message = JSON.parse(data);
		if (message.id === undefined) {
			for (const handler of handlers.get(message.method) ?? []) handler(message.params);
			return;
		}
		if (!waiting.has(message.id)) return;
		const { resolve, reject, method } = settle(message.id);
		if (message.error) reject(new Error(`${method}: ${message.error.message}`));
		else resolve(message.result);
	});
	socket.addEventListener('close', () => {
		for (const id of [...waiting.keys()]) {
			const { reject, method } = settle(id);
			reject(new Error(`The DevTools socket closed during ${method}.`));
		}
	});
	const send = (method, params = {}) => new Promise((resolve, reject) => {
		if (socket.readyState !== WebSocket.OPEN) return reject(new Error(`The DevTools socket is closed, so ${method} wasn't sent.`));
		const id = ++lastId;
		const timer = setTimeout(() => {
			settle(id);
			reject(new Error(`Obsidian didn't answer ${method} within ${ANSWER_MS / 1000} seconds. Is a dialog or a native menu open?`));
		}, ANSWER_MS);
		waiting.set(id, { resolve, reject, method, timer });
		socket.send(JSON.stringify({ id, method, params }));
	});
	return {
		send,
		on(event, handler) {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		},
		async evaluate(expression) {
			const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
			if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
			return result.value;
		},
		close() {
			socket.close();
		},
	};
}

/**
 * Returns why a vault, as the page describes it (`marker`: whether it holds the demo marker,
 * `name`, and its `appearance.json`), can't be used for a `theme` ('dark' or 'light') scene, or
 * null when it can.
 */
export function vaultProblem({ marker, name, appearance }, theme) {
	if (!marker) return `The vault "${name}" isn't a copy of the demo vault (it has no ${MARKER}), so nothing was done.`;
	// A native menu opens outside the page, where no screenshot sees it, and blocks the page until it closes.
	if (appearance.nativeMenus !== false) return `Native menus are on in "${name}". Turn off "Native menus" in Obsidian's settings, then run it again.`;
	if (appearance.theme !== THEMES[theme]) return `The vault "${name}" isn't the ${theme} copy this picture needs. Copy it again with --theme ${theme}.`;
	return null;
}

/** Throws why the open vault can't be used for a `theme` scene (see `vaultProblem`), if it can't. */
export async function checkDemoVault(session, theme) {
	const vault = await session.evaluate(`(async () => {
		const { adapter, configDir } = app.vault;
		const appearance = JSON.parse(await adapter.read(configDir + '/appearance.json').catch(() => '{}'));
		return { marker: await adapter.exists(${JSON.stringify(MARKER)}), name: app.vault.getName(), appearance };
	})()`);
	const problem = vaultProblem(vault, theme);
	if (problem) throw new Error(problem);
}
