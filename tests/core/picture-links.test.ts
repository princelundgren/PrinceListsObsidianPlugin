import { describe, expect, test } from 'vitest';
import { pictureLinks, planPictureRemove, type PictureLinkAt } from '../../src/core/picture-links';
import { splitLines } from '../../src/core/lines';
import { contentStartOf } from './edit-helpers';

const FM = '---\nprincelists: true\n---\n';

// The link at `line` of `text`, as the menu finds it.
function linkAt(text: string, line: number, index = 0): PictureLinkAt {
	const lineText = splitLines(text)[line]?.text ?? '';
	const link = pictureLinks([lineText])[index];
	if (!link) throw new Error(`No picture link on line ${line}`);
	return { line, lineText, from: link.from, to: link.to };
}

function remove(text: string, notesOf: number | 'listNote', line: number, index = 0) {
	return planPictureRemove(text, contentStartOf(splitLines(text)), notesOf, linkAt(text, line, index));
}

describe('pictureLinks', () => {
	test('finds both kinds of picture link in reading order, with their columns and paths', () => {
		expect(pictureLinks(['see ![[a.png]] and ![b](sub/b%20c.jpg)', '![[d.webp|100]]'])).toEqual([
			{ line: 0, from: 4, to: 14, linkpath: 'a.png' },
			{ line: 0, from: 19, to: 38, linkpath: 'sub/b c.jpg' },
			{ line: 1, from: 0, to: 15, linkpath: 'd.webp' },
		]);
	});

	test('leaves out embedded notes, other files and pictures from the web', () => {
		expect(pictureLinks(['![[Garden]]', '![[plan.pdf]]', '![](https://example.com/a.png)'])).toEqual([]);
	});
});

describe('planPictureRemove', () => {
	test('a picture with text beside it leaves the text, with one space between', () => {
		const text = `${FM}- [ ] a\n\n\tsee ![[x.png]] here\n`;
		expect(remove(text, 3, 5)).toEqual({ next: `${FM}- [ ] a\n\n\tsee here\n`, edit: { start: 5, delta: 0, kind: 'change' } });
	});

	test('a picture in a block of its own between two blocks leaves one empty line between them', () => {
		const text = `${FM}- [ ] a\n\n\tone\n\n\t![[x.png]]\n\n\ttwo\n- [ ] b\n`;
		expect(remove(text, 3, 7)).toEqual({ next: `${FM}- [ ] a\n\n\tone\n\n\ttwo\n- [ ] b\n`, edit: { start: 7, delta: -2, kind: 'delete' } });
	});

	test("a picture in the notes' last block takes the empty line above it", () => {
		const text = `${FM}- [ ] a\n\n\tone\n\n\t![[x.png]]\n- [ ] b\n`;
		expect(remove(text, 3, 7)?.next).toBe(`${FM}- [ ] a\n\n\tone\n- [ ] b\n`);
	});

	test('a picture that was all the notes leaves the item with none', () => {
		const text = `${FM}- [ ] a\n\n\t![[x.png]]\n- [ ] b\n`;
		expect(remove(text, 3, 5)).toEqual({ next: `${FM}- [ ] a\n- [ ] b\n`, edit: { start: 4, delta: -2, kind: 'delete' } });
	});

	test("in a file without a final newline, the notes' last picture leaves none", () => {
		const text = `${FM}- [ ] a\n\n\tone\n\n\t![[x.png]]`;
		expect(remove(text, 3, 7)?.next).toBe(`${FM}- [ ] a\n\n\tone`);
	});

	test("the list note's last block keeps the empty line before the first item", () => {
		const text = `${FM}text\n\n![[x.png]]\n- [ ] item\n`;
		expect(remove(text, 'listNote', 5)?.next).toBe(`${FM}text\n\n- [ ] item\n`);
	});

	test('a picture that was all the list note leaves no empty line above the first item', () => {
		const text = `${FM}![[x.png]]\n\n- [ ] item\n`;
		expect(remove(text, 'listNote', 3)?.next).toBe(`${FM}- [ ] item\n`);
	});

	test('the second of two pictures on a line is the one removed', () => {
		const text = `${FM}- [ ] a\n\n\t![[x.png]] ![[y.png]]\n`;
		expect(remove(text, 3, 5, 1)?.next).toBe(`${FM}- [ ] a\n\n\t![[x.png]]\n`);
	});

	test('a picture that starts a line takes the space after it and leaves the indent', () => {
		const text = `${FM}- [ ] a\n\n\tone\n\t![[x.png]] here\n`;
		expect(remove(text, 3, 6)?.next).toBe(`${FM}- [ ] a\n\n\tone\n\there\n`);
	});

	test('a picture that starts the first line of a block leaves the indent', () => {
		const text = `${FM}- [ ] a\n\n\t![[x.png]] here\n`;
		expect(remove(text, 3, 5)?.next).toBe(`${FM}- [ ] a\n\n\there\n`);
	});

	test('a picture that starts a line of the list note leaves no space before the text', () => {
		const text = `${FM}![[x.png]] here\n\n- [ ] item\n`;
		expect(remove(text, 'listNote', 3)?.next).toBe(`${FM}here\n\n- [ ] item\n`);
	});

	test('with no empty line under the title, the empty line below the picture stays', () => {
		const text = `${FM}- [ ] a\n\t![[x.png]]\n\n\tmore\n`;
		expect(remove(text, 3, 4)?.next).toBe(`${FM}- [ ] a\n\n\tmore\n`);
	});

	test('nothing is removed when the line reads differently now', () => {
		const text = `${FM}- [ ] a\n\n\t![[x.png]]\n`;
		const at = { ...linkAt(text, 5), lineText: '\t![[y.png]]' };
		expect(planPictureRemove(text, 3, 3, at)).toBeNull();
	});

	test("nothing is removed from a line outside the item's notes", () => {
		const text = `${FM}- [ ] a\n\n\t![[x.png]]\n- [ ] b ![[x.png]]\n`;
		expect(remove(text, 3, 6)).toBeNull();
	});
});
