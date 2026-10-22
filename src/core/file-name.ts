// Whether another file in the folder has `name`, compared case-insensitively, as macOS and iOS volumes
// are. The file's own name doesn't count, so a rename that only changes its case goes ahead.
export function nameTaken(names: readonly string[], own: string, name: string): boolean {
	const wanted = name.toLowerCase();
	return names.some((other) => other !== own && other.toLowerCase() === wanted);
}
