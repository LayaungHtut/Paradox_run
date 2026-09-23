import { loadJson, saveJson } from '$lib/state/storage';
import { ApiFailure, submitRun } from './api';
import type { SubmitRequest } from './types';

/*
 * Runs finished offline are queued on the device and submitted when connectivity returns.
 * Only network failures are queued; a run the server rejects is never retried.
 */
const KEY = 'pending-submissions';
const VERSION = 1;
const MAX = 20;

export function enqueue(req: SubmitRequest): void {
	const q = loadJson<SubmitRequest[]>(KEY, VERSION, []);
	q.push(req);
	saveJson(KEY, VERSION, q.slice(-MAX));
}

export function pendingCount(): number {
	return loadJson<SubmitRequest[]>(KEY, VERSION, []).length;
}

let flushing = false;

/** Try to submit everything queued. Returns how many were accepted. */
export async function flushQueue(): Promise<number> {
	if (flushing || (typeof navigator !== 'undefined' && !navigator.onLine)) return 0;
	flushing = true;
	let accepted = 0;
	try {
		const q = loadJson<SubmitRequest[]>(KEY, VERSION, []);
		const keep: SubmitRequest[] = [];
		for (const req of q) {
			try {
				await submitRun(req);
				accepted++;
			} catch (e) {
				// keep only if it was a connectivity problem; drop runs the server refused
				if (e instanceof ApiFailure && (e.status === 0 || e.status >= 500 || e.status === 429))
					keep.push(req);
			}
		}
		saveJson(KEY, VERSION, keep);
	} finally {
		flushing = false;
	}
	return accepted;
}
