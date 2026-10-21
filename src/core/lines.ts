export interface Line {
	text: string;
	eol: '' | '\n' | '\r\n' | '\r';
}

// \r\n is listed first so that a CRLF is one ending, not a lone \r followed by a lone \n.
const LINE_PATTERN = /([^\r\n]*)(\r\n|\n|\r|$)/y;

export function splitLines(text: string): Line[] {
	const lines: Line[] = [];
	LINE_PATTERN.lastIndex = 0;
	while (LINE_PATTERN.lastIndex < text.length) {
		const match = LINE_PATTERN.exec(text) as RegExpExecArray;
		lines.push({ text: match[1] as string, eol: match[2] as Line['eol'] });
	}
	return lines;
}

export function joinLines(lines: readonly Line[]): string {
	return lines.map((line) => line.text + line.eol).join('');
}

export function dominantEol(lines: readonly Line[]): '\n' | '\r\n' {
	let crlf = 0;
	let lf = 0;
	for (const { eol } of lines) {
		if (eol === '\r\n') crlf++;
		else if (eol === '\n') lf++;
	}
	return crlf > lf ? '\r\n' : '\n';
}

// Whether the file ends with a newline is the old last line's ending, so it passes to whichever line
// is last now. The old last line, if it moved off the end, takes dominantEol. Only LF and CRLF count
// there, so in a file that uses lone CRs it takes LF, as new lines do. Lines are found by identity,
// so an edit that moves lines must pass the same Line objects in `insert`.
// In a file without a final newline, empty lines the edit leaves at the end go (spec, "Editing never
// rebuilds the file"): the last of them would write nothing, so the line before it would end the file
// with a newline. They only separate blocks, so nothing parses differently.
export function spliceLines(lines: readonly Line[], start: number, deleteCount: number, insert: readonly Line[]): Line[] {
	const result = lines.slice();
	result.splice(start, deleteCount, ...insert);
	const oldLast = lines[lines.length - 1];
	if (!oldLast || result[result.length - 1] === oldLast) return result;
	if (oldLast.eol === '') while (result.length > 0 && (result[result.length - 1] as Line).text === '') result.pop();
	const newLast = result[result.length - 1];
	if (!newLast) return result;
	const moved = result.indexOf(oldLast);
	if (moved !== -1) result[moved] = { text: oldLast.text, eol: dominantEol(lines) };
	result[result.length - 1] = { text: newLast.text, eol: oldLast.eol };
	return result;
}

// An offset at the end of the text maps to lines.length, one past the last line.
export function lineIndexAt(text: string, offset: number): number {
	const lines = splitLines(text);
	let lineEnd = 0;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] as Line;
		lineEnd += line.text.length + line.eol.length;
		if (offset < lineEnd) return i;
	}
	return lines.length;
}
