<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import BoardTable from '$lib/components/BoardTable.svelte';
	import PageShell from '$lib/components/PageShell.svelte';
	import { CAMPAIGN } from '$lib/game/levels/campaign';
	import type { BoardKey } from '$lib/net/types';
	import { dayKey } from '$lib/state/progress.svelte';

	const today = `daily:${dayKey()}` as BoardKey;
	const options: { key: BoardKey; label: string }[] = [
		{ key: today, label: 'Today’s Daily' },
		...CAMPAIGN.map((l, i) => ({ key: `level:${l.id}` as BoardKey, label: `${i + 1} · ${l.name}` }))
	];

	const BOARD_RE = /^(level:[a-z0-9-]{1,40}|daily:\d{4}-\d{2}-\d{2})$/;
	let board = $derived.by((): BoardKey => {
		const q = page.url.searchParams.get('board');
		return q && BOARD_RE.test(q) ? (q as BoardKey) : today;
	});

	function select(key: string) {
		void goto(`/leaderboard?board=${encodeURIComponent(key)}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}
</script>

<svelte:head><title>Leaderboard · PARADOX RUN</title></svelte:head>

<PageShell title="Leaderboard" eyebrow="Server-verified runs only">
	<div class="pick">
		<label for="board" class="eyebrow">Board</label>
		<select id="board" value={board} onchange={(e) => select(e.currentTarget.value)}>
			{#each options as o (o.key)}
				<option value={o.key}>{o.label}</option>
			{/each}
			{#if !options.some((o) => o.key === board)}
				<option value={board}>{board.replace('daily:', 'Daily ')}</option>
			{/if}
		</select>
	</div>
	<p class="how">
		Ranked by score (time under par, shards, echo sync, clean timeline), then time. Scores are never
		sent by the game — the server replays every submitted timeline input-by-input and computes them
		itself. Tap
		<b>Race</b> to play against that run's ghost.
	</p>
	{#key board}
		<BoardTable {board} limit={50} />
	{/key}
</PageShell>

<style>
	.pick {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 10px;
	}
	select {
		flex: 1;
		max-width: 360px;
		min-height: 44px;
		background: var(--color-panel);
		color: var(--color-text);
		border: 1px solid var(--color-line);
		border-radius: 12px;
		padding: 0 12px;
		font-weight: 600;
	}
	.how {
		font-size: 0.82rem;
		color: var(--color-dim);
		margin-bottom: 14px;
		max-width: 640px;
	}
	.how b {
		color: var(--color-gold);
	}
</style>
