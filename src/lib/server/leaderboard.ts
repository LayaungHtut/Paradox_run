import { env } from '$env/dynamic/private';
import { LeaderboardStore } from './store';
import { RateLimiter } from './validate';

/** Process-wide singletons. DATA_DIR controls where the leaderboard file lives (default ./data). */
let store: LeaderboardStore | null = null;

export function getStore(): LeaderboardStore {
	return (store ??= new LeaderboardStore(env.DATA_DIR || 'data'));
}

export const submitLimiter = new RateLimiter(12, 60_000);
export const readLimiter = new RateLimiter(120, 60_000);
