import { describe, expect, it } from 'vitest';
import { CAMPAIGN } from '$lib/game/levels/campaign';
import type { RunResult, Timeline } from '$lib/game/run/session';
import {
	applyDailyResult,
	applyLevelResult,
	emptyProgress,
	isUnlocked,
	pruneDaily,
	sanitizeProgress
} from './progress-logic';
import { sanitize as sanitizeSettings } from './settings.svelte';

const timeline = (level: string): Timeline => ({
	v: 2,
	level,
	lv: 'abc',
	mirror: false,
	loops: ['AA'],
	ends: ['exit']
});

const result = (levelId: string, over: Partial<RunResult> = {}): RunResult => ({
	levelId,
	mirrored: false,
	totalTicks: 1200,
	loops: 2,
	deaths: 1,
	shards: 0,
	shardTotal: 1,
	syncs: 1,
	score: { base: 1000, time: 100, shards: 0, sync: 200, clean: 0, total: 1300 },
	stars: 1,
	...over
});

const ctx = { finalEchoes: 1, beatGhost: false };

describe('progression', () => {
	it('unlocks levels sequentially', () => {
		const d = emptyProgress();
		expect(isUnlocked(d, CAMPAIGN, CAMPAIGN[0].id)).toBe(true);
		expect(isUnlocked(d, CAMPAIGN, CAMPAIGN[1].id)).toBe(false);
		applyLevelResult(d, result(CAMPAIGN[0].id), timeline(CAMPAIGN[0].id), ctx, CAMPAIGN);
		expect(isUnlocked(d, CAMPAIGN, CAMPAIGN[1].id)).toBe(true);
		expect(isUnlocked(d, CAMPAIGN, CAMPAIGN[2].id)).toBe(false);
		expect(isUnlocked(d, CAMPAIGN, 'nope')).toBe(false);
	});

	it('keeps best score and best time independently; the ghost is the fastest run', () => {
		const d = emptyProgress();
		const id = CAMPAIGN[0].id;
		const fast = { ...timeline(id), loops: ['FAST'] };
		const slow = { ...timeline(id), loops: ['SLOW'] };
		applyLevelResult(d, result(id, { totalTicks: 900 }), fast, ctx, CAMPAIGN);
		const second = applyLevelResult(
			d,
			result(id, { totalTicks: 1500, score: { ...result(id).score, total: 5000 } }),
			slow,
			ctx,
			CAMPAIGN
		);
		expect(second.newBest).toBe(true); // higher score
		expect(second.newBestTime).toBe(false); // but slower
		expect(d.levels[id].bestTicks).toBe(900);
		expect(d.levels[id].bestScore).toBe(5000);
		expect(d.levels[id].bestTimeline?.loops).toEqual(['FAST']);
		expect(d.levels[id].clears).toBe(2);
	});

	it('unlocks run achievements exactly once', () => {
		const d = emptyProgress();
		const id = CAMPAIGN[0].id;
		const clean = result(id, { deaths: 0, stars: 3, totalTicks: 60 });
		const first = applyLevelResult(
			d,
			clean,
			timeline(id),
			{ finalEchoes: 3, beatGhost: true },
			CAMPAIGN
		);
		expect(first.unlocked).toEqual(
			expect.arrayContaining([
				'self-help',
				'clean',
				'three-stars',
				'crowd',
				'speed-runner',
				'beat-ghost'
			])
		);
		const again = applyLevelResult(
			d,
			clean,
			timeline(id),
			{ finalEchoes: 3, beatGhost: true },
			CAMPAIGN
		);
		expect(again.unlocked).toEqual([]);
	});

	it('awards Full Completion and Paradox Master only when every level qualifies', () => {
		const d = emptyProgress();
		for (const [i, l] of CAMPAIGN.entries()) {
			const out = applyLevelResult(d, result(l.id, { stars: 3 }), timeline(l.id), ctx, CAMPAIGN);
			const last = i === CAMPAIGN.length - 1;
			expect(out.unlocked.includes('closed-loop')).toBe(last);
			expect(out.unlocked.includes('paradox-master')).toBe(last);
		}
	});

	it('daily streak counts consecutive UTC days and resets after a gap', () => {
		const d = emptyProgress();
		const run = (key: string) =>
			applyDailyResult(d, key, result('relay'), timeline('relay'), ctx, 16);
		run('2026-09-20');
		expect(d.streak).toBe(1);
		run('2026-09-20'); // same day again: no change
		expect(d.streak).toBe(1);
		run('2026-09-21');
		const third = run('2026-09-22');
		expect(d.streak).toBe(3);
		expect(third.unlocked).toContain('habit');
		run('2026-09-25');
		expect(d.streak).toBe(1);
		expect(d.daily['2026-09-20'].attempts).toBe(2);
	});

	it('prunes old daily records', () => {
		const d = emptyProgress();
		for (let day = 1; day <= 20; day++)
			applyDailyResult(
				d,
				`2026-08-${String(day).padStart(2, '0')}`,
				result('relay'),
				timeline('relay'),
				ctx,
				16
			);
		pruneDaily(d, 14);
		expect(Object.keys(d.daily)).toHaveLength(14);
		expect(d.daily['2026-08-20']).toBeDefined();
		expect(d.daily['2026-08-01']).toBeUndefined();
	});
});

describe('save recovery', () => {
	it('returns empty progress for garbage', () => {
		for (const junk of [null, 42, 'x', [], { levels: 'nope' }])
			expect(sanitizeProgress(junk)).toEqual(emptyProgress());
	});

	it('drops only the corrupted records and keeps the rest', () => {
		const raw = {
			levels: {
				'first-echo': {
					bestTicks: 900,
					bestScore: 2000,
					stars: 2,
					clears: 3,
					bestTimeline: timeline('first-echo')
				},
				relay: {
					bestTicks: 'fast',
					bestScore: -5,
					stars: 99,
					clears: 1,
					bestTimeline: { broken: true }
				},
				decoy: 'corrupted',
				overdrive: { clears: 0 }
			},
			daily: { '2026-09-01': { bestScore: 10, bestTicks: 100, attempts: 2 }, notadate: {} },
			lastDaily: 12,
			streak: -3,
			achievements: { 'hello-me': 123, bad: 'x' },
			hints: { firstEcho: true, other: 'yes' }
		};
		const p = sanitizeProgress(raw);
		expect(p.levels['first-echo'].bestTimeline?.level).toBe('first-echo');
		expect(p.levels.relay.stars).toBe(3);
		expect(p.levels.relay.bestScore).toBe(0);
		expect(p.levels.relay.bestTimeline).toBeNull();
		expect(p.levels.decoy).toBeUndefined();
		expect(p.levels.overdrive).toBeUndefined();
		expect(Object.keys(p.daily)).toEqual(['2026-09-01']);
		expect(p.lastDaily).toBeNull();
		expect(p.streak).toBe(0);
		expect(p.achievements).toEqual({ 'hello-me': 123 });
		expect(p.hints).toEqual({ firstEcho: true });
	});

	it('settings: wrong types fall back to defaults, volumes are clamped', () => {
		const defaults = {
			sfx: 0.8,
			music: 0.5,
			screenShake: true,
			haptics: true,
			reducedEffects: false,
			showFps: false,
			muted: false,
			reducedFlashing: false,
			bestGhost: true
		};
		const s = sanitizeSettings(defaults, { sfx: 'loud', music: 7, muted: 'yes', showFps: true });
		expect(s.sfx).toBe(0.8);
		expect(s.music).toBe(1);
		expect(s.muted).toBe(false);
		expect(s.showFps).toBe(true);
		expect(sanitizeSettings(defaults, null)).toEqual(defaults);
	});
});
