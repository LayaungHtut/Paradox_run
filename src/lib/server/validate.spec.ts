import { describe, expect, it } from 'vitest';
import { CAMPAIGN } from '$lib/game/levels/campaign';
import { acceptedDailyKeys, dailyConfig } from '$lib/game/levels/daily';
import { encodeInputs } from '$lib/game/replay/codec';
import { playScripts } from '$lib/game/testing/bot';
import { SOLUTIONS } from '$lib/game/testing/solutions';
import { LeaderboardStore } from './store';
import { RateLimiter, RejectError, validateSubmission } from './validate';

const PLAYER = 'a'.repeat(32);
const def = CAMPAIGN[0];
const goodTimeline = () => playScripts(def, SOLUTIONS[def.id]).session.toTimeline();
const submission = (over: Record<string, unknown> = {}) => ({
	board: `level:${def.id}`,
	playerId: PLAYER,
	name: 'Tester',
	timeline: goodTimeline(),
	...over
});

const rejects = (body: unknown, status: number) => {
	try {
		validateSubmission(body);
	} catch (e) {
		expect(e).toBeInstanceOf(RejectError);
		expect((e as RejectError).status).toBe(status);
		return;
	}
	throw new Error('expected rejection');
};

describe('submission validation', () => {
	it('accepts a genuine run and computes the score server-side', () => {
		const run = validateSubmission(submission());
		expect(run.result.levelId).toBe(def.id);
		expect(run.result.score.total).toBeGreaterThan(0);
	});

	it('rejects malformed identity fields', () => {
		rejects(submission({ playerId: 'nope' }), 400);
		rejects(submission({ name: 'x' }), 400);
		rejects(submission({ name: '<script>' }), 400);
	});

	it('rejects unknown boards and closed dailies', () => {
		rejects(submission({ board: 'level:does-not-exist' }), 404);
		rejects(submission({ board: 'weekly:1' }), 400);
		rejects(submission({ board: 'daily:2001-01-01' }), 410);
	});

	it('rejects a forged timeline that never reaches the exit', () => {
		const t = goodTimeline();
		t.loops = [encodeInputs(new Uint8Array(120).fill(2))];
		t.ends = ['exit'];
		rejects(submission({ timeline: t }), 422);
	});

	it('rejects a timeline recorded for a different level variant', () => {
		const t = goodTimeline();
		t.mirror = true;
		rejects(submission({ timeline: t }), 422);
	});

	it('daily boards resolve deterministically', () => {
		const [today] = acceptedDailyKeys();
		expect(dailyConfig(today)).toEqual(dailyConfig(today));
	});
});

describe('leaderboard store', () => {
	const base = { board: 'level:x' as const, loops: 1, shards: 0, timeline: goodTimeline() };

	it('ranks by score, keeps one best entry per player', () => {
		const s = new LeaderboardStore(null);
		s.submit({ ...base, playerId: 'p1', name: 'A', score: 1000, ticks: 900 });
		s.submit({ ...base, playerId: 'p2', name: 'B', score: 1500, ticks: 900 });
		const worse = s.submit({ ...base, playerId: 'p1', name: 'A', score: 800, ticks: 900 });
		expect(worse.improved).toBe(false);
		expect(worse.rank).toBe(2);
		const better = s.submit({ ...base, playerId: 'p1', name: 'A', score: 2000, ticks: 900 });
		expect(better.improved).toBe(true);
		expect(better.rank).toBe(1);
		expect(s.count('level:x')).toBe(2);
		expect(s.get(better.entry.id)?.score).toBe(2000);
	});

	it('breaks score ties by time', () => {
		const s = new LeaderboardStore(null);
		s.submit({ ...base, playerId: 'p1', name: 'A', score: 1000, ticks: 900 });
		const fast = s.submit({ ...base, playerId: 'p2', name: 'B', score: 1000, ticks: 600 });
		expect(fast.rank).toBe(1);
	});
});

describe('rate limiter', () => {
	it('allows up to the limit per window', () => {
		const r = new RateLimiter(2, 1000);
		expect(r.allow('k', 0)).toBe(true);
		expect(r.allow('k', 1)).toBe(true);
		expect(r.allow('k', 2)).toBe(false);
		expect(r.allow('k', 2000)).toBe(true);
	});
});
