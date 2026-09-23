import { LIMITS } from '$lib/game/core/constants';
import { CAMPAIGN } from '$lib/game/levels/campaign';
import { acceptedDailyKeys, dailyConfig, DAY_RE } from '$lib/game/levels/daily';
import { parseLevel, type LevelData } from '$lib/game/levels/parse';
import {
	TimelineInvalid,
	verifyTimeline,
	type LoopEnd,
	type RunResult,
	type Timeline
} from '$lib/game/run/session';
import { ReplayDecodeError } from '$lib/game/replay/codec';
import { NAME_RE, type BoardKey } from '$lib/net/types';

/*
 * Server-side run validation. Nothing the client says about its score is trusted: the submission is
 * just a timeline of recorded inputs, and the score is whatever the deterministic simulation produces
 * when we replay it here.
 */

export class RejectError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
	}
}

const LEVEL_BOARD = /^level:([a-z0-9-]{1,40})$/;
const DAILY_BOARD = /^daily:(\d{4}-\d{2}-\d{2})$/;
const PLAYER_ID = /^[a-f0-9]{32}$/;
const ENDS: readonly LoopEnd[] = ['death', 'rewind', 'timeout', 'exit'];

export interface ValidRun {
	board: BoardKey;
	playerId: string;
	name: string;
	timeline: Timeline;
	result: RunResult;
}

/** Resolve the exact level variant a board refers to, or reject. */
export function levelForBoard(board: string, now = Date.now()): LevelData {
	const lvl = LEVEL_BOARD.exec(board);
	if (lvl) {
		const def = CAMPAIGN.find((l) => l.id === lvl[1]);
		if (!def) throw new RejectError(404, 'unknown level');
		return parseLevel(def);
	}
	const day = DAILY_BOARD.exec(board);
	if (day && DAY_RE.test(day[1])) {
		if (!acceptedDailyKeys(now).includes(day[1]))
			throw new RejectError(410, 'daily challenge closed');
		const cfg = dailyConfig(day[1]);
		return parseLevel(cfg.def, cfg.mirror);
	}
	throw new RejectError(400, 'bad board');
}

function checkTimelineShape(t: unknown): Timeline {
	const tl = t as Timeline;
	if (!tl || typeof tl !== 'object') throw new RejectError(400, 'missing timeline');
	if (
		typeof tl.v !== 'number' ||
		typeof tl.level !== 'string' ||
		typeof tl.lv !== 'string' ||
		typeof tl.mirror !== 'boolean'
	)
		throw new RejectError(400, 'bad timeline header');
	if (!Array.isArray(tl.loops) || !Array.isArray(tl.ends) || tl.loops.length !== tl.ends.length)
		throw new RejectError(400, 'bad timeline body');
	if (tl.loops.length === 0 || tl.loops.length > LIMITS.maxLoopsPerRun)
		throw new RejectError(400, 'bad loop count');
	for (const l of tl.loops)
		if (typeof l !== 'string' || l.length > LIMITS.maxEncodedLoopChars)
			throw new RejectError(400, 'bad loop data');
	for (const e of tl.ends) if (!ENDS.includes(e)) throw new RejectError(400, 'bad loop end');
	return { v: tl.v, level: tl.level, lv: tl.lv, mirror: tl.mirror, loops: tl.loops, ends: tl.ends };
}

export function validateSubmission(body: unknown, now = Date.now()): ValidRun {
	if (!body || typeof body !== 'object') throw new RejectError(400, 'bad request');
	const b = body as Record<string, unknown>;
	if (typeof b.board !== 'string') throw new RejectError(400, 'bad board');
	if (typeof b.playerId !== 'string' || !PLAYER_ID.test(b.playerId))
		throw new RejectError(400, 'bad player id');
	if (typeof b.name !== 'string' || !NAME_RE.test(b.name.trim()))
		throw new RejectError(400, 'bad name');
	const level = levelForBoard(b.board, now);
	const timeline = checkTimelineShape(b.timeline);
	let result: RunResult;
	try {
		result = verifyTimeline(level, timeline);
	} catch (e) {
		if (e instanceof TimelineInvalid || e instanceof ReplayDecodeError)
			throw new RejectError(422, `run rejected: ${e.message}`);
		throw e;
	}
	return {
		board: b.board as BoardKey,
		playerId: b.playerId,
		name: b.name.trim(),
		timeline,
		result
	};
}

/** Fixed-window rate limiter keyed by IP / player. In-memory: resets with the process. */
export class RateLimiter {
	private hits = new Map<string, { n: number; reset: number }>();

	constructor(
		private limit: number,
		private windowMs: number
	) {}

	allow(key: string, now = Date.now()): boolean {
		const h = this.hits.get(key);
		if (!h || now > h.reset) {
			this.hits.set(key, { n: 1, reset: now + this.windowMs });
			if (this.hits.size > 10000) this.prune(now);
			return true;
		}
		return ++h.n <= this.limit;
	}

	private prune(now: number): void {
		for (const [k, v] of this.hits) if (now > v.reset) this.hits.delete(k);
	}
}
