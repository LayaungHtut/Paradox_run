<script lang="ts">
	import { TICK_RATE } from '$lib/game/core/constants';
	import { fetchBoard } from '$lib/net/api';
	import type { BoardKey, BoardResponse } from '$lib/net/types';
	import { profile } from '$lib/state/profile.svelte';

	interface Props {
		board: BoardKey;
		limit?: number;
		compact?: boolean;
	}
	let { board, limit = 25, compact = false }: Props = $props();

	let view = $state<
		{ kind: 'loading' } | { kind: 'ok'; data: BoardResponse } | { kind: 'error'; message: string }
	>({ kind: 'loading' });

	async function load(key: BoardKey) {
		view = { kind: 'loading' };
		try {
			view = { kind: 'ok', data: await fetchBoard(key, profile.data.id, limit) };
		} catch (e) {
			view = { kind: 'error', message: (e as Error).message };
		}
	}

	$effect(() => {
		void load(board);
	});

	const secs = (t: number) => (t / TICK_RATE).toFixed(2);
</script>

<div class="board" class:compact>
	{#if view.kind === 'loading'}
		<p class="note">Loading verified runs…</p>
	{:else if view.kind === 'error'}
		<p class="note">
			Leaderboard unavailable ({view.message}). Your results are still saved on this device.
			<button class="retry" onclick={() => load(board)}>Retry</button>
		</p>
	{:else if view.data.entries.length === 0}
		<p class="note">No verified runs yet. Finish this one and you're #1.</p>
	{:else}
		<table>
			<thead>
				<tr>
					<th class="r">#</th>
					<th>Runner</th>
					<th class="n">Score</th>
					<th class="n">Time</th>
					{#if !compact}<th class="n hide-sm">Loops</th>{/if}
					<th class="n"><span class="sr">Ghost</span></th>
				</tr>
			</thead>
			<tbody>
				{#each view.data.entries as e, i (e.id)}
					<tr class:you={e.you}>
						<td class="r tabular">{i + 1}</td>
						<td class="name"
							>{e.name}{#if e.you}<span class="tag">you</span>{/if}</td
						>
						<td class="n tabular">{e.score.toLocaleString()}</td>
						<td class="n tabular">{secs(e.ticks)}s</td>
						{#if !compact}<td class="n tabular hide-sm">{e.loops}</td>{/if}
						<td class="n"
							><a class="race" href={`/challenge/${e.id}`} title="Race this run's ghost">Race</a
							></td
						>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if view.data.me && !view.data.entries.some((e) => e.you)}
			<p class="me tabular">
				You: #{view.data.me.rank} of {view.data.total} · {view.data.me.score.toLocaleString()} · {secs(
					view.data.me.ticks
				)}s
			</p>
		{:else}
			<p class="total">{view.data.total} verified runner{view.data.total === 1 ? '' : 's'}</p>
		{/if}
	{/if}
</div>

<style>
	.board {
		background: var(--color-panel);
		border: 1px solid var(--color-line);
		border-radius: 18px;
		padding: 6px 12px 10px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.86rem;
	}
	th {
		text-align: left;
		font-size: 0.66rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-dim);
		font-weight: 600;
		padding: 8px 6px;
	}
	td {
		padding: 8px 6px;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
	}
	.r {
		width: 2.2em;
		color: var(--color-dim);
	}
	.n {
		text-align: right;
		white-space: nowrap;
	}
	.name {
		font-weight: 600;
		max-width: 12em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	tr.you td {
		background: rgba(127, 211, 255, 0.07);
	}
	.tag {
		margin-left: 6px;
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-echo);
	}
	.race {
		display: inline-block;
		padding: 5px 10px;
		border-radius: 999px;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-gold);
		border: 1px solid rgba(255, 210, 122, 0.35);
	}
	.race:hover {
		background: rgba(255, 210, 122, 0.1);
	}
	.note,
	.me,
	.total {
		padding: 10px 6px;
		font-size: 0.84rem;
		color: var(--color-dim);
	}
	.me {
		color: var(--color-echo);
	}
	.retry {
		color: var(--color-echo);
		text-decoration: underline;
		margin-left: 6px;
		cursor: pointer;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	@media (max-width: 520px) {
		.hide-sm {
			display: none;
		}
	}
</style>
