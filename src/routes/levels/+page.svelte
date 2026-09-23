<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';
	import { TICK_RATE } from '$lib/game/core/constants';
	import { CAMPAIGN } from '$lib/game/levels/campaign';
	import { progress } from '$lib/state/progress.svelte';
	import { enterImmersive } from '$lib/ui/immersive';
</script>

<svelte:head><title>Levels · PARADOX RUN</title></svelte:head>

<PageShell title="Levels" eyebrow={`★ ${progress.totalStars} / ${CAMPAIGN.length * 3}`}>
	<ol class="grid">
		{#each CAMPAIGN as level, i (level.id)}
			{@const rec = progress.data.levels[level.id]}
			{@const open = progress.isUnlocked(level.id)}
			<li>
				{#if open}
					<a
						class="card"
						class:cleared={rec?.clears}
						href={`/play/${level.id}`}
						onclick={enterImmersive}
					>
						<div class="top">
							<span class="num">{String(i + 1).padStart(2, '0')}</span>
							<span class="stars" aria-label={`${rec?.stars ?? 0} stars`}>
								{#each [1, 2, 3] as s (s)}<span class:on={(rec?.stars ?? 0) >= s}>★</span>{/each}
							</span>
						</div>
						<h2>{level.name}</h2>
						<p>{level.tagline}</p>
						<div class="meta">
							<span class="echo" title="Echo capacity">
								{#each Array.from({ length: level.maxGhosts }, (_, k) => k) as k (k)}<i></i>{/each}
								{level.maxGhosts} echo{level.maxGhosts > 1 ? 'es' : ''}
							</span>
							<span>{level.loopSeconds}s loops</span>
							{#if rec}<span class="best tabular"
									>best {(rec.bestTicks / TICK_RATE).toFixed(2)}s</span
								>{/if}
						</div>
					</a>
				{:else}
					<div class="card locked" aria-disabled="true">
						<div class="top">
							<span class="num">{String(i + 1).padStart(2, '0')}</span><span class="lock"
								>Locked</span
							>
						</div>
						<h2>{level.name}</h2>
						<p>Clear level {i} to unlock.</p>
					</div>
				{/if}
			</li>
		{/each}
	</ol>
</PageShell>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 12px;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		height: 100%;
		padding: 16px;
		border-radius: 18px;
		background: var(--color-panel);
		border: 1px solid var(--color-line);
		transition:
			border-color 0.15s,
			transform 0.12s;
	}
	a.card:hover {
		border-color: rgba(127, 211, 255, 0.5);
	}
	a.card:active {
		transform: scale(0.98);
	}
	.card.cleared {
		background: linear-gradient(160deg, rgba(127, 211, 255, 0.06), var(--color-panel) 60%);
	}
	.locked {
		opacity: 0.45;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.num {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--color-dim);
	}
	.stars {
		color: #2a3450;
		letter-spacing: 1px;
	}
	.stars .on {
		color: var(--color-gold);
	}
	.lock {
		font-size: 0.68rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-dim);
	}
	h2 {
		font-size: 1.15rem;
		font-weight: 750;
	}
	p {
		font-size: 0.84rem;
		color: #aeb8d2;
		flex: 1;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		font-size: 0.72rem;
		color: var(--color-dim);
		letter-spacing: 0.04em;
	}
	.echo {
		color: var(--color-echo);
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}
	.echo i {
		width: 6px;
		height: 9px;
		border-radius: 2px;
		background: rgba(127, 211, 255, 0.55);
	}
	.echo i:last-of-type {
		margin-right: 4px;
	}
	.best {
		color: var(--color-text);
	}
</style>
