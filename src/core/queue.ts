// Runs tasks one at a time, in the order they were added. A task that fails goes to `onError`, and
// the next one still runs. The returned promise settles when the task is done, and never rejects.
export function serialQueue(onError: (error: unknown) => void): (task: () => Promise<void>) => Promise<void> {
	let last: Promise<void> = Promise.resolve();
	return (task) => {
		last = last.then(task).catch((error: unknown) => {
			onError(error);
		});
		return last;
	};
}
