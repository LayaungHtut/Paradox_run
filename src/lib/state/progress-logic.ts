import { TICK_RATE } from '$lib/game/core/constants';
import type { RunResult, Timeline } from '$lib/game/run/session';

/*
 * Pure progression rules, kept apart from the Svelte state class so they can be unit tested:
 * sanitising stored saves, recording a finished run, unlocking achievements, daily streaks.
 * Every function takes the data explicitly; nothing here touches storage or the DOM.
 */

export interface LevelRecord {
	bestTicks: number;
	bestScore: number;
	stars: number;
	clears: number;
	/** timeline of the FASTEST run — raced as your personal-best ghost */
	bestTimeline: Timeline | null;
}

export interface DailyRecord {
	bestScore: number;
	bestTicks: number;
	attempts: number;
	bestTimeline: Timeline | null;
}

export interface ProgressData {
	levels: Record<string, LevelRecord>;
	daily: Record<string, DailyRecord>;
	lastDaily: string | null;
	streak: number;
	achievements: Record<string, number>;
	hints: Record<string, boolean>;
}

export interface RecordOutcome {
	/** best score improved */
	newBest: boolean;
	/** best time improved */
	newBestTime: boolean;
	previousBest: { bestScore: number; bestTicks: number } | null;
	unlocked: string[];
}

export interface RunContext {
	/** echoes in play during the winning loop */
	finalEchoes: number;
	/** the player was racing their own best ghost and finished faster */
	beatGhost: boolean;
}

export const emptyProgress = (): ProgressData => ({
	levels: {},
	daily: {},
	lastDaily: null,
	streak: 0,
	achievements: {},
	hints: {}
});

const isObj = (v: unknown): v is Record<string, unknown> =>
	!!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, fallback: number, min = 0): number =>
	typeof v === 'number' && Number.isFinite(v) && v >= min ? v : fallback;

function sanitizeTimeline(v: unknown): Timeline | null {
	if (!isObj(v)) return null;
	const ok =
		typeof v.v === 'number' &&
		typeof v.level === 'string' &&
		typeof v.lv === 'string' &&
		typeof v.mirror === 'boolean' &&
		Array.isArray(v.loops) &&
		v.loops.every((l) => typeof l === 'string') &&
		Array.isArray(v.ends) &&
		v.ends.length === v.loops.length;
	return ok ? (v as unknown as Timeline) : null;
}

/**
 * Accept whatever was in storage and return a valid ProgressData. Corrupted fields are dropped
 * individually, so one bad record never wipes the rest of a player's progress.
 */
export function sanitizeProgress(raw: unknown): ProgressData {
	const out = emptyProgress();
	if (!isObj(raw)) return out;
	if (isObj(raw.levels))
		for (const [id, r] of Object.entries(raw.levels)) {
			if (!isObj(r)) continue;
			const clears = num(r.clears, 0);
			if (clears < 1) continue;
			out.levels[id] = {
				bestTicks: num(r.bestTicks, Number.MAX_SAFE_INTEGER, 1),
				bestScore: num(r.bestScore, 0),
				stars: Math.min(3, Math.floor(num(r.stars, 1))),
				clears: Math.floor(clears),
				bestTimeline: sanitizeTimeline(r.bestTimeline)
			};
		}
	if (isObj(raw.daily))
		for (const [key, r] of Object.entries(raw.daily)) {
			if (!isObj(r) || !/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
			out.daily[key] = {
				bestScore: num(r.bestScore, 0),
				bestTicks: num(r.bestTicks, Number.MAX_SAFE_INTEGER, 1),
				attempts: Math.floor(num(r.attempts, 1)),
				bestTimeline: sanitizeTimeline(r.bestTimeline)
			};
		}
	if (typeof raw.lastDaily === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastDaily))
		out.lastDaily = raw.lastDaily;
	out.streak = Math.floor(num(raw.streak, 0));
	if (isObj(raw.achievements))
		for (const [id, t] of Object.entries(raw.achievements))
			if (typeof t === 'number') out.achievements[id] = t;
	if (isObj(raw.hints))
		for (const [k, v] of Object.entries(raw.hints)) if (v === true) out.hints[k] = true;
	return out;
}

export function unlock(data: ProgressData, id: string, now = Date.now()): boolean {
	if (data.achievements[id]) return false;
	data.achievements[id] = now;
	return true;
}

export const prevDay = (key: string): string =>
	new Date(Date.parse(`${key}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);

/** Achievements that depend only on the finished run itself. */
function runAchievements(
	data: ProgressData,
	r: RunResult,
	ctx: RunContext,
	parSeconds: number
): string[] {
	const out: string[] = [];
	const tryUnlock = (id: string, cond: boolean) => {
		if (cond && unlock(data, id)) out.push(id);
	};
	tryUnlock('self-help', r.syncs > 0);
	tryUnlock('clean', r.deaths === 0);
	tryUnlock('three-stars', r.stars === 3);
	tryUnlock('crowd', ctx.finalEchoes >= 3);
	tryUnlock('speed-runner', r.totalTicks <= parSeconds * TICK_RATE * 0.6);
	tryUnlock('beat-ghost', ctx.beatGhost);
	return out;
}

export function applyLevelResult(
	data: ProgressData,
	r: RunResult,
	timeline: Timeline,
	ctx: RunContext,
	campaign: { id: string; parSeconds: number }[]
): RecordOutcome {
	const prev = data.levels[r.levelId] ?? null;
	const newBest = !prev || r.score.total > prev.bestScore;
	const newBestTime = !prev || r.totalTicks < prev.bestTicks;
	data.levels[r.levelId] = {
		bestTicks: Math.min(prev?.bestTicks ?? Number.MAX_SAFE_INTEGER, r.totalTicks),
		bestScore: Math.max(prev?.bestScore ?? 0, r.score.total),
		stars: Math.max(prev?.stars ?? 0, r.stars),
		clears: (prev?.clears ?? 0) + 1,
		bestTimeline: newBestTime ? timeline : (prev?.bestTimeline ?? null)
	};
	const par = campaign.find((l) => l.id === r.levelId)?.parSeconds ?? 0;
	const unlocked = runAchievements(data, r, ctx, par);
	if (campaign.every((l) => data.levels[l.id]?.clears) && unlock(data, 'closed-loop'))
		unlocked.push('closed-loop');
	if (campaign.every((l) => data.levels[l.id]?.stars === 3) && unlock(data, 'paradox-master'))
		unlocked.push('paradox-master');
	return {
		newBest,
		newBestTime,
		previousBest: prev && { bestScore: prev.bestScore, bestTicks: prev.bestTicks },
		unlocked
	};
}

export function applyDailyResult(
	data: ProgressData,
	key: string,
	r: RunResult,
	timeline: Timeline,
	ctx: RunContext,
	parSeconds: number
): RecordOutcome {
	const prev = data.daily[key] ?? null;
	const newBest = !prev || r.score.total > prev.bestScore;
	const newBestTime = !prev || r.totalTicks < prev.bestTicks;
	data.daily[key] = {
		bestScore: Math.max(prev?.bestScore ?? 0, r.score.total),
		bestTicks: Math.min(prev?.bestTicks ?? Number.MAX_SAFE_INTEGER, r.totalTicks),
		attempts: (prev?.attempts ?? 0) + 1,
		bestTimeline: newBestTime ? timeline : (prev?.bestTimeline ?? null)
	};
	if (data.lastDaily !== key) {
		data.streak = data.lastDaily === prevDay(key) ? data.streak + 1 : 1;
		data.lastDaily = key;
	}
	const unlocked = runAchievements(data, r, ctx, parSeconds);
	if (unlock(data, 'daily')) unlocked.push('daily');
	if (data.streak >= 3 && unlock(data, 'habit')) unlocked.push('habit');
	return {
		newBest,
		newBestTime,
		previousBest: prev && { bestScore: prev.bestScore, bestTicks: prev.bestTicks },
		unlocked
	};
}

/** Keep storage bounded: only the N most recent daily records. */
export function pruneDaily(data: ProgressData, keep = 14): void {
	const keys = Object.keys(data.daily).sort();
	for (const k of keys.slice(0, Math.max(0, keys.length - keep))) delete data.daily[k];
}

export function isUnlocked(
	data: ProgressData,
	campaign: { id: string }[],
	levelId: string
): boolean {
	const i = campaign.findIndex((l) => l.id === levelId);
	if (i <= 0) return i === 0;
	return (data.levels[campaign[i - 1].id]?.clears ?? 0) > 0;
}
