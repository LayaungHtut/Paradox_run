import { json } from '@sveltejs/kit';
import { getStore, readLimiter } from '$lib/server/leaderboard';
import { summarize } from '$lib/server/store';
import type { BoardKey, BoardResponse } from '$lib/net/types';
import type { RequestHandler } from './$types';

const BOARD = /^(level:[a-z0-9-]{1,40}|daily:\d{4}-\d{2}-\d{2})$/;

export const GET: RequestHandler = ({ url, getClientAddress }) => {
	if (!readLimiter.allow(`ip:${getClientAddress()}`))
		return json({ ok: false, error: 'rate limited' }, { status: 429 });
	const board = url.searchParams.get('board') ?? '';
	if (!BOARD.test(board)) return json({ ok: false, error: 'bad board' }, { status: 400 });
	const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit')) || 25));
	const player = url.searchParams.get('player') ?? '';
	const store = getStore();
	const key = board as BoardKey;
	const mine = /^[a-f0-9]{32}$/.test(player) ? store.playerBest(key, player) : null;
	const res: BoardResponse = {
		board: key,
		entries: store.top(key, limit).map((e) => summarize(e, e.playerId === player)),
		total: store.count(key),
		me: mine ? { ...summarize(mine.entry, true), rank: mine.rank } : null
	};
	return json(res, { headers: { 'cache-control': 'no-store' } });
};
