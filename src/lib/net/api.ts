import type {
	BoardKey,
	BoardResponse,
	GhostResponse,
	SubmitRequest,
	SubmitResponse
} from './types';

/*
 * Thin client for the leaderboard API. Every call can fail (offline, server down, rejected run) and
 * callers must treat the online layer as optional — the game never waits on it to be playable.
 */

export class ApiFailure extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

/** Static builds (VITE_STATIC_BUILD) ship without the /api server. */
const STATIC_BUILD = !!import.meta.env.VITE_STATIC_BUILD;

async function request<T>(path: string, init?: RequestInit, timeoutMs = 8000): Promise<T> {
	// 404, not 0: a missing server is not "offline", so runs are not queued for retry
	if (STATIC_BUILD) throw new ApiFailure('online features are off in this build', 404);
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		const res = await fetch(path, {
			...init,
			signal: ctrl.signal,
			headers: { 'content-type': 'application/json', ...init?.headers }
		});
		const body = (await res.json().catch(() => null)) as
			(T & { ok?: boolean; error?: string }) | null;
		if (!res.ok || !body || body.ok === false)
			throw new ApiFailure(body?.error ?? `HTTP ${res.status}`, res.status);
		return body;
	} catch (e) {
		if (e instanceof ApiFailure) throw e;
		throw new ApiFailure(navigator.onLine === false ? 'offline' : 'network error', 0);
	} finally {
		clearTimeout(timer);
	}
}

export const submitRun = (req: SubmitRequest) =>
	request<SubmitResponse>('/api/runs', { method: 'POST', body: JSON.stringify(req) }, 15000);

export const fetchBoard = (board: BoardKey, playerId: string, limit = 25) =>
	request<BoardResponse>(
		`/api/leaderboard?board=${encodeURIComponent(board)}&player=${encodeURIComponent(playerId)}&limit=${limit}`
	);

export const fetchGhost = (id: string) =>
	request<GhostResponse>(`/api/runs/${encodeURIComponent(id)}`);
