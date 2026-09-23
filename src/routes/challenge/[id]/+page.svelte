<script lang="ts">
	import { page } from '$app/state';
	import GameView from '$lib/components/game/GameView.svelte';
	import PageShell from '$lib/components/PageShell.svelte';
	import { RivalReplay } from '$lib/game/client/rival';
	import { TICK_RATE } from '$lib/game/core/constants';
	import { levelById } from '$lib/game/levels/campaign';
	import { dailyConfig } from '$lib/game/levels/daily';
	import { parseLevel, type LevelData } from '$lib/game/levels/parse';
	import { fetchGhost } from '$lib/net/api';
	import type { BoardKey, GhostResponse } from '$lib/net/types';
	import { enterImmersive } from '$lib/ui/immersive';

	interface Loaded {
		ghost: GhostResponse;
		level: LevelData;
		heading: string;
		board: BoardKey;
		daily: string | null;
	}

	let view = $state<
		{ kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; data: Loaded }
	>({ kind: 'loading' });
	let playing = $state(false);
	let rival = $state<RivalReplay | null>(null);

	async function load(id: string) {
		view = { kind: 'loading' };
		try {
			const ghost = await fetchGhost(id);
			let level: LevelData;
			let heading: string;
			let daily: string | null = null;
			const board = ghost.board;
			if (ghost.board.startsWith('daily:')) {
				// an expired daily can still be raced; the server will simply decline the submission
				daily = ghost.board.slice(6);
				const cfg = dailyConfig(daily);
				level = parseLevel(cfg.def, cfg.mirror);
				heading = `Daily #${cfg.number} · ${cfg.def.name}`;
			} else {
				const def = levelById(ghost.board.slice(6));
				if (!def) throw new Error('this level no longer exists');
				level = parseLevel(def);
				heading = def.name;
			}
			rival = new RivalReplay(level, ghost.timeline, ghost.name, ghost.ticks);
			view = { kind: 'ready', data: { ghost, level, heading, board, daily } };
		} catch (e) {
			view = { kind: 'error', message: (e as Error).message };
		}
	}

	$effect(() => {
		void load(page.params.id ?? '');
	});
</script>

<svelte:head><title>Beat this ghost · PARADOX RUN</title></svelte:head>

{#if playing && view.kind === 'ready'}
	<GameView
		level={view.data.level}
		heading={`vs ${view.data.ghost.name} · ${view.data.heading}`}
		board={view.data.board}
		mode="challenge"
		dailyKey={view.data.daily}
		{rival}
		backHref="/leaderboard"
	/>
{:else}
	<PageShell title="Beat this ghost" eyebrow="Ghost challenge">
		{#if view.kind === 'loading'}
			<p class="note">Fetching the ghost…</p>
		{:else if view.kind === 'error'}
			<p class="note">Couldn't load this challenge: {view.message}.</p>
			<a class="btn" href="/">Back to menu</a>
		{:else}
			{@const g = view.data.ghost}
			<section class="panel card">
				<div class="rival">
					<div class="eyebrow">Rival</div>
					<h2>{g.name}</h2>
					<p class="tabular">
						<b>{(g.ticks / TICK_RATE).toFixed(2)}s</b> · {g.score.toLocaleString()} pts · {g
							.timeline.loops.length} loops
					</p>
				</div>
				<p class="level">on <b>{view.data.heading}</b></p>
				<p class="explain">
					Their winning loop — echoes and all — runs beside you as a <span>gold ghost</span>. It
					can't touch your world. Close your timeline faster than {(g.ticks / TICK_RATE).toFixed(
						2
					)}s to win.
				</p>
				<button
					class="btn btn-primary"
					onclick={() => {
						void enterImmersive();
						playing = true;
					}}>Race the ghost</button
				>
			</section>
		{/if}
	</PageShell>
{/if}

<style>
	.card {
		padding: 22px;
		display: grid;
		gap: 12px;
		max-width: 560px;
	}
	h2 {
		font-size: 1.8rem;
		font-weight: 800;
		color: var(--color-gold);
	}
	.rival p {
		color: #c3cbe0;
	}
	.level {
		color: var(--color-dim);
	}
	.level b {
		color: var(--color-text);
	}
	.explain {
		font-size: 0.9rem;
		color: #aeb8d2;
	}
	.explain span {
		color: var(--color-gold);
	}
	.note {
		color: var(--color-dim);
		margin-bottom: 12px;
	}
</style>
