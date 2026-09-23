<script lang="ts">
	import { TICK_RATE } from '$lib/game/core/constants';
	import type { RunResult } from '$lib/game/run/session';
	import { achievementById } from '$lib/state/achievements';
	import type { Submission } from '$lib/net/types';
	import type { RecordOutcome } from '$lib/state/progress.svelte';

	interface Props {
		heading: string;
		result: RunResult;
		outcome: RecordOutcome;
		submission: Submission;
		nextHref: string | null;
		rival: { name: string; ticks: number } | null;
		/** the final campaign level was just cleared: show the ending */
		ending?: boolean;
		onRetry: () => void;
		onMenu: () => void;
		onBoard: () => void;
	}
	let {
		heading,
		result,
		outcome,
		submission,
		nextHref,
		rival,
		ending = false,
		onRetry,
		onMenu,
		onBoard
	}: Props = $props();

	const secs = (t: number) => (t / TICK_RATE).toFixed(2);
	let shareState = $state<'idle' | 'copied' | 'failed'>('idle');
	let prevScore = $derived(outcome.previousBest?.bestScore ?? null);
	let bestTicks = $derived(
		Math.min(outcome.previousBest?.bestTicks ?? Infinity, result.totalTicks)
	);
	let isYou = $derived(rival?.name === 'your best');

	const rows = $derived([
		{ k: 'Loop closed', v: result.score.base },
		{ k: 'Under par', v: result.score.time },
		{ k: `Shards ${result.shards}/${result.shardTotal}`, v: result.score.shards },
		{ k: `Echo sync ×${result.syncs}`, v: result.score.sync },
		{ k: 'Clean timeline', v: result.score.clean }
	]);

	async function share(id: string) {
		const url = `${location.origin}/challenge/${id}`;
		const text = `I closed "${heading}" in ${secs(result.totalTicks)}s with ${result.loops} loop${result.loops === 1 ? '' : 's'}. Beat my ghost in PARADOX RUN:`;
		try {
			if (navigator.share) {
				await navigator.share({ title: 'PARADOX RUN — beat my ghost', text, url });
				return;
			}
			await navigator.clipboard.writeText(`${text} ${url}`);
			shareState = 'copied';
		} catch (e) {
			if ((e as DOMException)?.name !== 'AbortError') shareState = 'failed';
		}
	}
</script>

<div class="overlay" data-ui role="dialog" aria-modal="true" aria-label="Level complete">
	<div class="panel card fade-up">
		<div class="top">
			<div>
				<div class="eyebrow">Loop closed</div>
				<h2>{heading}</h2>
			</div>
			<div class="stars" aria-label={`${result.stars} of 3 stars`}>
				{#each [1, 2, 3] as s (s)}
					<span class:on={result.stars >= s}>★</span>
				{/each}
			</div>
		</div>

		<div class="headline">
			<div class="big tabular">{secs(result.totalTicks)}<small>s</small></div>
			<div class="side">
				<div class="score tabular">{result.score.total.toLocaleString()} <span>pts</span></div>
				<div class="loops">
					{result.loops} loop{result.loops === 1 ? '' : 's'} · {result.deaths} death{result.deaths ===
					1
						? ''
						: 's'}
				</div>
				<div class="loops tabular">Best time {secs(bestTicks)}s</div>
				{#if !outcome.previousBest}
					<div class="badge">First clear</div>
				{:else if outcome.newBestTime}
					<div class="badge">New record · was {secs(outcome.previousBest.bestTicks)}s</div>
				{:else if outcome.newBest && prevScore !== null}
					<div class="badge">New high score · was {prevScore.toLocaleString()}</div>
				{/if}
			</div>
		</div>

		{#if rival}
			<div class="rival" class:won={result.totalTicks < rival.ticks}>
				{#if result.totalTicks < rival.ticks}
					You beat {isYou ? 'your own best ghost' : `${rival.name}'s ghost`} by {secs(
						rival.ticks - result.totalTicks
					)}s
				{:else if result.totalTicks === rival.ticks}
					Dead heat with {isYou ? 'your best ghost' : `${rival.name}'s ghost`}
				{:else}
					{isYou ? 'Your best ghost' : `${rival.name}'s ghost`} was {secs(
						result.totalTicks - rival.ticks
					)}s faster — run it again
				{/if}
			</div>
		{/if}

		<dl class="rows tabular">
			{#each rows as r (r.k)}
				<div class:zero={r.v === 0}>
					<dt>{r.k}</dt>
					<dd>+{r.v}</dd>
				</div>
			{/each}
		</dl>

		{#if outcome.unlocked.length}
			<div class="ach">
				{#each outcome.unlocked as id (id)}
					{@const a = achievementById(id)}
					{#if a}<div class="chip"><b>{a.name}</b> {a.desc}</div>{/if}
				{/each}
			</div>
		{/if}

		<div class="online">
			{#if submission.state === 'pending'}
				<span class="dim">Verifying run on server…</span>
			{:else if submission.state === 'ok'}
				<span
					>✓ Verified · rank <b>#{submission.rank}</b> of {submission.total}{submission.improved
						? ''
						: ' (your best stands)'}</span
				>
				<button class="link" onclick={() => share(submission.id)}>
					{shareState === 'copied'
						? 'Link copied'
						: shareState === 'failed'
							? 'Could not share'
							: 'Challenge a friend'}
				</button>
				<button class="link" onclick={onBoard}>Leaderboard</button>
			{:else if submission.state === 'error'}
				<span class="dim"
					>Not submitted: {submission.message}. Your result is saved on this device.</span
				>
			{:else}
				<span class="dim">Saved on this device.</span>
			{/if}
		</div>

		{#if ending}
			<div class="ending">
				<b>Timeline closed.</b>
				You couldn't have done it alone — but your past selves could. Every level is open for replay:
				chase three stars, race your best ghost, or try today's Daily Paradox.
				<a href="/credits">Credits</a>
			</div>
		{/if}

		<div class="actions">
			{#if nextHref}
				<a class="btn btn-primary" href={nextHref}>Next level</a>
			{/if}
			<button class="btn" class:btn-primary={!nextHref} onclick={onRetry}>Run again</button>
			<button class="btn" onclick={onMenu}>Menu</button>
		</div>
	</div>
</div>

<style>
	.overlay {
		position: absolute;
		inset: 0;
		z-index: 20;
		display: grid;
		place-items: center;
		background: rgba(4, 6, 12, 0.55);
		padding: calc(10px + var(--safe-t)) 14px calc(10px + var(--safe-b));
		overflow-y: auto;
	}
	.card {
		width: min(560px, 100%);
		padding: 20px 22px;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}
	h2 {
		font-size: 1.35rem;
		font-weight: 800;
	}
	.stars {
		font-size: 1.6rem;
		letter-spacing: 2px;
		color: #2a3450;
	}
	.stars .on {
		color: var(--color-gold);
		text-shadow: 0 0 12px rgba(255, 210, 122, 0.5);
	}
	.headline {
		display: flex;
		align-items: center;
		gap: 20px;
		margin: 10px 0 8px;
	}
	.big {
		font-size: 3rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1;
	}
	.big small {
		font-size: 1.2rem;
		color: var(--color-dim);
		margin-left: 2px;
	}
	.score {
		font-size: 1.2rem;
		font-weight: 700;
	}
	.score span {
		font-size: 0.75rem;
		color: var(--color-dim);
	}
	.loops {
		font-size: 0.8rem;
		color: var(--color-dim);
	}
	.badge {
		display: inline-block;
		margin-top: 4px;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-ink);
		background: var(--color-gold);
		padding: 2px 8px;
		border-radius: 999px;
	}
	.rival {
		font-size: 0.85rem;
		padding: 8px 12px;
		border-radius: 12px;
		background: rgba(255, 210, 122, 0.08);
		border: 1px solid rgba(255, 210, 122, 0.3);
		color: var(--color-gold);
		margin-bottom: 8px;
	}
	.rival.won {
		background: rgba(110, 242, 193, 0.08);
		border-color: rgba(110, 242, 193, 0.35);
		color: var(--color-mint);
	}
	.rows {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2px 18px;
		font-size: 0.8rem;
	}
	.rows div {
		display: flex;
		justify-content: space-between;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		padding: 3px 0;
	}
	.rows dt {
		color: var(--color-dim);
	}
	.rows .zero dd {
		color: #4b5670;
	}
	.ach {
		margin-top: 10px;
		display: grid;
		gap: 6px;
	}
	.chip {
		font-size: 0.78rem;
		padding: 6px 10px;
		border-radius: 10px;
		background: rgba(185, 155, 255, 0.1);
		border: 1px solid rgba(185, 155, 255, 0.35);
		color: #d8ccff;
	}
	.ending {
		margin-top: 12px;
		padding: 12px 14px;
		border-radius: 14px;
		font-size: 0.86rem;
		line-height: 1.45;
		color: #dff3ff;
		background: linear-gradient(120deg, rgba(127, 211, 255, 0.12), rgba(185, 155, 255, 0.1));
		border: 1px solid rgba(127, 211, 255, 0.35);
	}
	.ending b {
		display: block;
		font-size: 1rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-echo);
		margin-bottom: 2px;
	}
	.ending a {
		color: var(--color-echo);
		text-decoration: underline;
		text-underline-offset: 3px;
		margin-left: 4px;
	}
	.online {
		margin: 12px 0 14px;
		font-size: 0.8rem;
		display: flex;
		flex-wrap: wrap;
		gap: 6px 14px;
		align-items: center;
	}
	.dim {
		color: var(--color-dim);
	}
	.link {
		color: var(--color-echo);
		font-weight: 650;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
		min-height: 32px;
	}
	.actions {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.actions > * {
		flex: 1 1 120px;
	}
	@media (max-height: 430px) {
		.card {
			padding: 14px 16px;
		}
		.big {
			font-size: 2.2rem;
		}
		.rows {
			display: none;
		}
	}
</style>
