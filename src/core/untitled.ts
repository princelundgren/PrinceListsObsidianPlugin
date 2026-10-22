const BASE = 'Untitled list';

// Compared case-insensitively: macOS and iOS volumes are, so `untitled list.md` blocks the name.
export function nextUntitledName(existing: ReadonlySet<string>): string {
	const taken = new Set([...existing].map((name) => name.toLowerCase()));
	let name = BASE;
	for (let n = 1; taken.has(`${name}.md`.toLowerCase()); n++) name = `${BASE} ${n}`;
	return name;
}
