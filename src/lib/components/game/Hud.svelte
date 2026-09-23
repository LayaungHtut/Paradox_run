<script lang="ts">
	import type { HudSnapshot } from '$lib/game/client/controller';

	interface Props {
		hud: HudSnapshot;
		title: string;
		touch: boolean;
		fps: number | null;
		onPause: () => void;
		onRewind: () => void;
	}
	let { hud, title, touch, fps, onPause, onRewind }: Props = $props();

	const fmt = (s: number) => s.toFixed(1);
	let low = $derived(hud.phase === 'playing' && hud.loopTimeLeft < 3);
	let canRewind = $derived(hud.phase === 'playing');
</script>

<div class="hud" data-ui>
	<div class="left">
		<button class="icon" data-ui onclick={onPause} aria-label="Pause">
			<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"
				><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect
					x="14"
					y="5"
					width="4"
					height="14"
					rx="1"
					fill="currentColor"
				/></svg
			>
		</button>
		<div class="meta">
			<div class="title">{title}</div>
			<div class="sub tabular">
				LOOP <b>{hud.loop}</b>
				<span class="dot">·</span>
				<span class="echo">ECHOES {hud.echoes}/{hud.maxEchoes}</span>
			</div>
		</div>
	</div>

	<div class="center tabular" class:low>
		{#if hud.phase === 'rewinding' || hud.phase === 'dying'}
			<span class="rew">REWINDING</span>
		{:else}
			{fmt(Math.max(0, hud.loopTimeLeft))}s
		{/if}
	</div>

	<div class="right">
		<div class="stats tabular">
			<div><span class="k">TIME</span> {fmt(hud.totalTime)}</div>
			{#if hud.shardTotal > 0}
				<div><span class="shard">◆</span> {hud.shards}/{hud.shardTotal}</div>
			{/if}
			{#if hud.rivalTime !== null}
				<div class="rival"><span class="k">VS</span> {hud.rivalName} {fmt(hud.rivalTime)}</div>
			{/if}
			{#if fps !== null}<div class="k">{fps} FPS</div>{/if}
		</div>
		<button
			class="rewind"
			data-ui
			onclick={onRewind}
			disabled={!canRewind}
			aria-label="Rewind: end this loop and turn it into an echo"
		>
			<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
				<path
					d="M12 5a7 7 0 1 1-6.6 4.7"
					fill="none"
					stroke="currentColor"
					stroke-width="2.2"
					stroke-linecap="round"
				/>
				<path
					d="M4.5 4.5v5h5"
					fill="none"
					stroke="currentColor"
					stroke-width="2.2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
			<span>{touch ? 'Rewind' : 'Rewind · R'}</span>
		</button>
	</div>
</div>

<style>
	.hud {
		position: absolute;
		inset: 0 0 auto 0;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: start;
		padding: calc(8px + var(--safe-t)) calc(10px + var(--safe-r)) 0 calc(10px + var(--safe-l));
		pointer-events: none;
		z-index: 5;
	}
	.left,
	.right {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.right {
		justify-content: flex-end;
	}
	.icon,
	.rewind {
		pointer-events: auto;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(10, 14, 24, 0.55);
		color: var(--color-text);
		backdrop-filter: blur(6px);
		cursor: pointer;
	}
	.icon {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		display: grid;
		place-items: center;
	}
	.rewind {
		height: 48px;
		padding: 0 14px 0 12px;
		border-radius: 14px;
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-echo);
		border-color: rgba(127, 211, 255, 0.4);
	}
	.rewind:disabled {
		opacity: 0.35;
	}
	.rewind:not(:disabled):active {
		transform: scale(0.95);
	}
	.meta {
		line-height: 1.15;
		text-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
	}
	.title {
		font-weight: 700;
		font-size: 0.8rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.sub {
		font-size: 0.68rem;
		letter-spacing: 0.1em;
		color: var(--color-dim);
	}
	.sub b {
		color: var(--color-text);
	}
	.echo {
		color: var(--color-echo);
	}
	.dot {
		margin: 0 4px;
	}
	.center {
		margin-top: 22px;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--color-text);
		text-shadow: 0 1px 6px rgba(0, 0, 0, 0.7);
	}
	.center.low {
		color: var(--color-danger);
	}
	.rew {
		color: var(--color-echo);
		letter-spacing: 0.24em;
	}
	.stats {
		text-align: right;
		font-size: 0.72rem;
		font-weight: 600;
		line-height: 1.35;
		text-shadow: 0 1px 6px rgba(0, 0, 0, 0.7);
	}
	.k {
		color: var(--color-dim);
		letter-spacing: 0.1em;
	}
	.shard {
		color: #cdb8ff;
	}
	.rival {
		color: var(--color-gold);
	}
	@media (max-width: 700px) {
		.title {
			max-width: 120px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.rewind span {
			display: none;
		}
		.rewind {
			width: 52px;
			justify-content: center;
			padding: 0;
		}
	}
</style>
