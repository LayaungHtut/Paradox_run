import { describe, expect, it } from 'vitest';
import { playScripts } from '../testing/bot';
import { SOLUTIONS } from '../testing/solutions';
import { CAMPAIGN } from './campaign';
import { dailyConfig, dailyLevel } from './daily';
import { levelVersion } from './parse';

const days = Array.from({ length: 30 }, (_, i) =>
	new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10)
);

describe('Daily Paradox', () => {
	it('is deterministic for a given date', () => {
		for (const d of days.slice(0, 5)) expect(dailyConfig(d)).toEqual(dailyConfig(d));
	});

	it('produces genuine variety across a month', () => {
		const combos = new Set(
			days.map((d) => {
				const c = dailyConfig(d);
				return `${c.baseId}|${c.modifiers.map((m) => m.id).join('+')}`;
			})
		);
		expect(combos.size).toBeGreaterThan(12);
	});

	it('every daily of the month is solvable and versioned separately from the campaign', () => {
		for (const d of days) {
			const { config, level } = dailyLevel(d);
			const { session } = playScripts(config.def, SOLUTIONS[config.baseId], config.mirror);
			expect(session.status, `${d} ${config.baseId}`).toBe('complete');
			// a modified daily must never share a version with the campaign level it remixes, so daily
			// runs can't be submitted as campaign runs (or vice versa)
			const campaignDef = CAMPAIGN.find((l) => l.id === config.baseId)!;
			if (config.modifiers.some((m) => m.id !== 'mirror'))
				expect(level.version).not.toBe(levelVersion(campaignDef));
			else expect(level.version).toBe(levelVersion(campaignDef));
		}
	});

	it('rejects malformed day keys', () => {
		expect(() => dailyConfig('2026-9-1')).toThrow();
	});
});
