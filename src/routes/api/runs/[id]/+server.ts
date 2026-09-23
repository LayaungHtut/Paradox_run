import { json } from '@sveltejs/kit';
import { getStore, readLimiter } from '$lib/server/leaderboard';
import type { GhostResponse } from '$lib/net/types';
import type { RequestHandler } from './$types';

/** Fetch a stored run's timeline so another player can race its ghost. */
export const GET: RequestHandler = ({ params, getClientAddress }) => {
	if (!readLimiter.allow(`ip:${getClientAddress()}`))
		return json({ ok: false, error: 'rate limited' }, { status: 429 });
	if (!/^[A-Za-z0-9_-]{6,20}$/.test(params.id))
		return json({ ok: false, error: 'bad id' }, { status: 400 });
	const e = getStore().get(params.id);
	if (!e) return json({ ok: false, error: 'ghost not found' }, { status: 404 });
	const res: GhostResponse = {
		id: e.id,
		board: e.board,
		name: e.name,
		score: e.score,
		ticks: e.ticks,
		timeline: e.timeline
	};
	return json(res, { headers: { 'cache-control': 'public, max-age=60' } });
};
