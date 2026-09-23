import type { Timeline } from '$lib/game/run/session';

/** Allowed public display names. Shared by client and server validation. */
export const NAME_RE = /^[A-Za-z0-9 _.-]{2,16}$/;

/** A leaderboard is identified by a board key: `level:<levelId>` or `daily:<YYYY-MM-DD>`. */
export type BoardKey = `level:${string}` | `daily:${string}`;

export interface SubmitRequest {
	board: BoardKey;
	timeline: Timeline;
	playerId: string;
	name: string;
}

export interface EntrySummary {
	id: string;
	name: string;
	score: number;
	ticks: number;
	loops: number;
	shards: number;
	createdAt: number;
	/** true for the requesting player's own entry */
	you?: boolean;
}

export interface SubmitResponse {
	ok: true;
	id: string;
	rank: number;
	total: number;
	/** whether this submission replaced the player's previous best on the board */
	improved: boolean;
	score: number;
	ticks: number;
}

export interface BoardResponse {
	board: BoardKey;
	entries: EntrySummary[];
	total: number;
	/** requesting player's own best, if any */
	me: (EntrySummary & { rank: number }) | null;
}

export interface GhostResponse {
	id: string;
	board: BoardKey;
	name: string;
	score: number;
	ticks: number;
	timeline: Timeline;
}

export interface ApiError {
	ok: false;
	error: string;
}

/** Client-side state of a leaderboard submission, shown on the results screen. */
export type Submission =
	| { state: 'pending' }
	| { state: 'ok'; id: string; rank: number; total: number; improved: boolean }
	| { state: 'error'; message: string }
	| { state: 'off' };
