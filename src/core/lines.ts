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
