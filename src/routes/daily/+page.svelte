<script lang="ts">
	import BoardTable from '$lib/components/BoardTable.svelte';
	import PageShell from '$lib/components/PageShell.svelte';
	import { TICK_RATE } from '$lib/game/core/constants';
	import { dailyConfig } from '$lib/game/levels/daily';
	import { dayKey, progress } from '$lib/state/progress.svelte';
	import { enterImmersive } from '$lib/ui/immersive';

	const key = dayKey();
	const cfg = dailyConfig(key);
	const mine = progress.data.daily[key];

	let now = $state(Date.now());
	$effect(() => {
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});
	let left = $derived.by(() => {
		const end = Date.parse(`${key}T00:00:00Z`) + 86400000;
		const s = Math.max(0, Math.floor((end - now) / 1000));
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		return `${h}h ${String(m).padStart(2, '0')}m`;
	});
</script>

<svelte:head><title>Daily Paradox · PARADOX RUN</title></svelte:head>

<PageShell title={`Daily Paradox #${cfg.number}`} eyebrow={`${key} UTC · new puzzle in ${left}`}>
	<section class="hero panel">
		<div>
			<div class="eyebrow">Today's timeline</div>
			<h2>{cfg.def.name}</h2>
			<p>{cfg.def.tagline}</p>
			{#if cfg.modifiers.length}
				<div class="mods">
					{#each cfg.modifiers as m (m.id)}
						<span class="mod" title={m.desc}><b>{m.name}</b> {m.desc}</span>
					{/each}
				</div>
			{:else}
				<div class="mods"><span class="mod"><b>Standard</b> No modifiers today.</span></div>
			{/if}
			<ul class="facts">
				<li>Same puzzle for every runner today</li>
				<li>
					{cfg.def.maxGhosts} echo{cfg.def.maxGhosts > 1 ? 'es' : ''} · {cfg.def.loopSeconds}s loops
				</li>
				<li>Every submission is re-simulated on the server</li>
			</ul>
		</div>
		<div class="side">
			{#if mine}
				<div class="best tabular">
					<span class="eyebrow">Your best</span>
					<b>{mine.bestScore.toLocaleString()}</b>
					<span
						>{(mine.bestTicks / TICK_RATE).toFixed(2)}s · {mine.attempts} clear{mine.attempts === 1
							? ''
							: 's'}</span
					>
				</div>
			{/if}
			{#if progress.data.streak > 0}
				<div class="streak">{progress.data.streak}-day streak</div>
			{/if}
			<a class="btn btn-primary" href="/daily/run" onclick={enterImmersive}
				>{mine ? 'Run it again' : 'Play today'}</a
			>
		</div>
	</section>

	<h3 class="eyebrow sec">Today's verified leaderboard</h3>
	<BoardTable board={`daily:${key}`} />
</PageShell>

<style>
	.hero {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 20px;
		padding: 20px;
		margin-bottom: 22px;
	}
	h2 {
		font-size: 1.6rem;
		font-weight: 800;
		margin: 2px 0 4px;
	}
	p {
		color: #c3cbe0;
	}
	.mods {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 10px;
	}
	.mod {
		font-size: 0.78rem;
		padding: 4px 10px;
		border-radius: 999px;
		border: 1px solid rgba(185, 155, 255, 0.4);
		background: rgba(185, 155, 255, 0.08);
		color: #d8ccff;
	}
	.mod b {
		color: #efe8ff;
		margin-right: 2px;
	}
	.facts {
		margin-top: 12px;
		display: grid;
		gap: 4px;
		font-size: 0.82rem;
		color: var(--color-dim);
	}
	.facts li::before {
		content: '◆ ';
		color: var(--color-echo);
	}
	.side {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 10px;
		min-width: 200px;
	}
	.best {
		display: grid;
	}
	.best b {
		font-size: 1.8rem;
		font-weight: 800;
	}
	.best span:last-child {
		font-size: 0.8rem;
		color: var(--color-dim);
	}
	.streak {
		font-size: 0.8rem;
		color: var(--color-gold);
	}
	.sec {
		margin-bottom: 8px;
	}
	@media (max-width: 640px) {
		.hero {
			grid-template-columns: 1fr;
		}
	}
</style>
