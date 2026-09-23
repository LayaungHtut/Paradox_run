import { json } from '@sveltejs/kit';
import { getStore, submitLimiter } from '$lib/server/leaderboard';
import { RejectError, validateSubmission } from '$lib/server/validate';
import type { SubmitResponse } from '$lib/net/types';
import type { RequestHandler } from './$types';

const MAX_BODY = 128 * 1024;

/** Submit a run. The body carries recorded inputs only; the server re-simulates to score it. */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		const ip = getClientAddress();
		if (!submitLimiter.allow(`ip:${ip}`)) throw new RejectError(429, 'too many submissions');
		const text = await request.text();
		if (text.length > MAX_BODY) throw new RejectError(413, 'payload too large');
		let body: unknown;
		try {
			body = JSON.parse(text);
		} catch {
			throw new RejectError(400, 'invalid json');
		}
		const run = validateSubmission(body);
		if (!submitLimiter.allow(`player:${run.playerId}`))
			throw new RejectError(429, 'too many submissions');
		const { entry, improved, rank, total } = getStore().submit({
			board: run.board,
			playerId: run.playerId,
			name: run.name,
			score: run.result.score.total,
			ticks: run.result.totalTicks,
			loops: run.result.loops,
			shards: run.result.shards,
			timeline: run.timeline
		});
		const res: SubmitResponse = {
			ok: true,
			id: entry.id,
			rank,
			total,
			improved,
			score: run.result.score.total,
			ticks: run.result.totalTicks
		};
		return json(res);
	} catch (e) {
		if (e instanceof RejectError)
			return json({ ok: false, error: e.message }, { status: e.status });
		console.error('submit failed', e);
		return json({ ok: false, error: 'server error' }, { status: 500 });
	}
};
