// Runs a JavaScript file in the Obsidian page a DevTools port serves, for a check by hand in a copy
// of the demo vault. Usage is in AGENTS.md, under Commands.
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { connect } from './cdp.mjs';

/**
 * Returns an expression that runs `body` as the body of an async function whose parameter `ARG` is
 * `argument` (undefined when none was given), and that evaluates to what the body returns.
 */
export function pageExpression(body, argument) {
	return `(async (ARG) => {\n${body}\n})(${JSON.stringify(argument)})`;
}

/** Returns how a value from the page prints: a string as it is, anything else as indented JSON. */
export function printable(value) {
	return typeof value === 'string' ? value : JSON.stringify(value, null, '\t');
}

async function main() {
	const { values, positionals } = parseArgs({ allowPositionals: true, options: { port: { type: 'string' } } });
	if (!values.port || positionals.length < 1 || positionals.length > 2) {
		throw new Error('Usage: node scripts/pictures/run-in-obsidian.mjs --port <port> <file.js> [<argument>]');
	}
	const [file, argument] = positionals;
	const session = await connect(Number(values.port));
	try {
		const value = await session.evaluate(pageExpression(readFileSync(file, 'utf8'), argument));
		if (value !== undefined) console.log(printable(value));
	} finally {
		session.close();
	}
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(error.message);
		process.exit(1);
	});
}
