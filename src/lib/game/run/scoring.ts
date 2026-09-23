import { TICK_RATE } from '../core/constants';

export const SCORE = {
	base: 1000,
	/** points per second finished under par */
	perSecondUnderPar: 50,
	perShard: 250,
	/** per distinct mechanism channel a ghost powered for you in the winning loop */
	perSync: 200,
	/** no deaths anywhere in the timeline */
	clean: 300
} as const;

export interface ScoreInput {
	totalTicks: number;
	parSeconds: number;
	shards: number;
	syncs: number;
	deaths: number;
}

export interface ScoreBreakdown {
	base: number;
	time: number;
	shards: number;
	sync: number;
	clean: number;
	total: number;
}

export function computeScore(s: ScoreInput): ScoreBreakdown {
	const underPar = s.parSeconds * TICK_RATE - s.totalTicks;
	const time = underPar > 0 ? Math.floor((underPar * SCORE.perSecondUnderPar) / TICK_RATE) : 0;
	const shards = s.shards * SCORE.perShard;
	const sync = s.syncs * SCORE.perSync;
	const clean = s.deaths === 0 ? SCORE.clean : 0;
	return {
		base: SCORE.base,
		time,
		shards,
		sync,
		clean,
		total: SCORE.base + time + shards + sync + clean
	};
}

/** ★ complete · ★★ under par · ★★★ under par with every shard */
export function computeStars(
	totalTicks: number,
	parSeconds: number,
	shards: number,
	shardTotal: number
): number {
	if (totalTicks > parSeconds * TICK_RATE) return 1;
	return shards >= shardTotal ? 3 : 2;
}

export const popcount = (n: number): number => {
	let c = 0;
	for (let v = n >>> 0; v; v &= v - 1) c++;
	return c;
};
