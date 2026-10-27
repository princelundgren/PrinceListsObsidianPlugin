// The texts a list wrote that the metadata cache hasn't reported yet. It reports each write once and in
// order, sometimes only after a later write has landed, so a late report isn't an outside change.
export class WriteEchoes {
	private pending: string[] = [];

	wrote(text: string): void {
		this.pending.push(text);
	}

	isEcho(data: string): boolean {
		const at = this.pending.indexOf(data);
		this.pending = at === -1 ? [] : this.pending.slice(at + 1);
		return at !== -1;
	}
}
