import { describe, expect, it } from 'vitest';
import { CAMPAIGN } from '../levels/campaign';
import { parseLevel } from '../levels/parse';
import { IN_RIGHT } from '../core/constants';
import { playScripts, runTo, waitFor } from '../testing/bot';
import { PERFECT_SOLUTIONS, SOLUTIONS } from '../testing/solutions';
import { TimelineInvalid, verifyTimeline } from './session';
import { decodeInputs, encodeInputs } from '../replay/codec';

describe('campaign levels are solvable and verifiable', () => {
	for (const def of CAMPAIGN) {
		for (const mirror of [false, true]) {
			it(`${def.id}${mirror ? ' (mirrored)' : ''}`, () => {
				const scripts = SOLUTIONS[def.id];
				expect(scripts, `missing solution for ${def.id}`).toBeDefined();
				const { session, ends } = playScripts(def, scripts, mirror);
				expect(ends[ends.length - 1], `ends: ${ends.join(',')}`).toBe('exit');
				const local = session.getResult()!;
				const verified = verifyTimeline(parseLevel(def, mirror), session.toTimeline());
				expect(verified).toEqual(local);
			});
		}
	}
});

describe('three stars are achievable on every level', () => {
	for (const def of CAMPAIGN) {
		it(`${def.id}: every shard reachable and par beatable`, () => {
			const { session } = playScripts(def, PERFECT_SOLUTIONS[def.id]);
			const r = session.getResult();
			expect(r, 'perfect route did not finish').not.toBeNull();
			expect(r!.shards).toBe(r!.shardTotal);
			expect(r!.stars).toBe(3);
		});
	}
});

describe('levels genuinely need echoes', () => {
	for (const def of CAMPAIGN) {
		it(`${def.id}: the winning route fails without the earlier loops`, () => {
			const scripts = SOLUTIONS[def.id];
			let ends: string[];
			try {
				ends = playScripts(def, scripts.slice(-1)).ends;
			} catch {
				ends = ['stuck'];
			}
			expect(ends[0]).not.toBe('exit');
		});
	}
});

describe('level-specific design guarantees', () => {
	it('overdrive cannot be crossed without dashing, even with the stepping stone raised', () => {
		const def = CAMPAIGN.find((l) => l.id === 'overdrive')!;
		const [holdPlate] = SOLUTIONS[def.id];
		const { ends } = playScripts(def, [
			holdPlate,
			function* (s) {
				yield* waitFor(s, () => s.world.lifts[0].y <= s.level.lifts[0].y - 48, IN_RIGHT);
				yield* runTo(s, 660, { jumps: [304, 434] });
			}
		]);
		expect(ends[1]).not.toBe('exit');
	});
});

describe('timeline verification rejects tampering', () => {
	const def = CAMPAIGN[0];
	const good = () => playScripts(def, SOLUTIONS[def.id]).session.toTimeline();

	it('rejects a truncated final loop', () => {
		const t = good();
		const last = decodeInputs(t.loops[t.loops.length - 1]);
		t.loops[t.loops.length - 1] = encodeInputs(last.subarray(0, last.length - 20));
		expect(() => verifyTimeline(parseLevel(def), t)).toThrow(TimelineInvalid);
	});

	it('rejects a timeline without its helper loop', () => {
		const t = good();
		t.loops = t.loops.slice(-1);
		t.ends = t.ends.slice(-1);
		expect(() => verifyTimeline(parseLevel(def), t)).toThrow(TimelineInvalid);
	});

	it('rejects a run recorded on a different version of the level', () => {
		const t = good();
		t.lv = 'deadbeef';
		expect(() => verifyTimeline(parseLevel(def), t)).toThrow(/older version/);
	});

	it('rejects mislabelled loop ends and wrong versions', () => {
		const t = good();
		t.ends[0] = 'death';
		expect(() => verifyTimeline(parseLevel(def), t)).toThrow(TimelineInvalid);
		const t2 = good();
		t2.v = 999;
		expect(() => verifyTimeline(parseLevel(def), t2)).toThrow(TimelineInvalid);
	});
});
