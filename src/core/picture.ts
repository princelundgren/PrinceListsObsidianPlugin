export const PICTURE_EXTENSIONS = ['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'];

const MIME_EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' };

export function pictureName(file: { name: string; type: string }, pasted: boolean, now: Date): string | null {
	if (pasted) {
		const extension = MIME_EXTENSIONS[file.type] ?? file.type.replace(/^image\//, '');
		return file.type.startsWith('image/') && PICTURE_EXTENSIONS.includes(extension) ? `Pasted image ${timestamp(now)}.${extension}` : null;
	}
	const extension = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
	const hasExtension = file.name.includes('.') && PICTURE_EXTENSIONS.includes(extension);
	return hasExtension ? file.name.replace(/[#^|[\]]/g, '-') : null;
}

export function appendOnOwnLine(notes: string, text: string): string {
	if (notes === '') return text;
	return `${notes.endsWith('\n') ? notes : `${notes}\n`}${text}`;
}

function timestamp(date: Date): string {
	const two = (value: number) => String(value).padStart(2, '0');
	const day = `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}`;
	return `${day}${two(date.getHours())}${two(date.getMinutes())}${two(date.getSeconds())}`;
}
