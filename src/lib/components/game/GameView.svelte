<script lang="ts">
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import { audio } from '$lib/game/audio/audio';
	import { GameController, type HintKey, type HudSnapshot } from '$lib/game/client/controller';
	import type { RivalReplay } from '$lib/game/client/rival';
	import type { LevelData } from '$lib/game/levels/parse';
	import type { RunResult, Timeline } from '$lib/game/run/session';
	import { ApiFailure, submitRun } from '$lib/net/api';
	import { enqueue } from '$lib/net/queue';
	import type { BoardKey, Submission } from '$lib/net/types';
	import { achievementById } from '$lib/state/achievements';
	import { profile } from '$lib/state/profile.svelte';
	import { progress, type RecordOutcome } from '$lib/state/progress.svelte';
	import { settings } from '$lib/state/settings.svelte';
	import Hud from './Hud.svelte';
	import PauseMenu from './PauseMenu.svelte';
	import Results from './Results.svelte';
	import TouchControls from './TouchControls.svelte';

	interface Props {
		level: LevelData;
		heading: string;
		board: BoardKey;
		mode: 'campaign' | 'daily' | 'challenge';
		dailyKey?: string | null;
		rival?: RivalReplay | null;
		/** 'best' = the player's own fastest run; 'friend' = someone else's shared run */
		rivalKind?: 'best' | 'friend';
		nextHref?: string | null;
		backHref?: string;
	}
	let {
		level,
		heading,
		board,
		mode,
		dailyKey = null,
		rival = null,
		rivalKind = 'friend',
		nextHref = null,
		backHref = '/'
	}: Props = $props();

	let hud = $state<HudSnapshot | null>(null);
	let fps = $state<number | null>(null);
	let toast = $state<{ text: string; kind: 'hint' | 'ach'; id: number } | null>(null);
	let done = $state<{ result: RunResult; timeline: Timeline; outcome: RecordOutcome } | null>(null);
	let submission = $state<Submission>({ state: 'off' });
	let runId = $state(0);
	let controller: GameController | null = null;
	/** the ghost actually raced in the current run, frozen at mount (a new best saved mid-results must not replace it) */
	let racedRival = $state<{ name: string; ticks: number } | null>(null);
	const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	const HINTS: Record<HintKey, { text: string; ach?: string }> = {
		firstEcho: {
			text: 'That’s you. Echo 1 replays your last loop — every step, exactly.',
			ach: 'hello-me'
		},
		holdPlate: {
			text: touch
				? 'Your echo will hold this plate exactly as long as you do. Wait a while, then tap REWIND.'
				: 'Your echo will hold this plate exactly as long as you do. Wait a while, then press R.'
		},
		desync: {
			text: 'PARADOX — the world changed, so an echo drifted off its recording.',
			ach: 'paradox'
		},
		decoy: { text: 'Your echo drew the fire.', ach: 'decoy' }
	};

	function showToast(text: string, kind: 'hint' | 'ach', ms = 5200) {
		clearTimeout(toastTimer);
		toast = { text, kind, id: Date.now() };
		toastTimer = setTimeout(() => (toast = null), ms);
	}

	function onHint(key: HintKey) {
		const h = HINTS[key];
		const firstTime = progress.markHint(key);
		if (h.ach && progress.unlock(h.ach)) {
			const a = achievementById(h.ach);
			if (!firstTime && a) showToast(`Achievement · ${a.name}`, 'ach', 3200);
		}
		if (firstTime) showToast(h.text, 'hint');
	}

	async function onComplete(result: RunResult, timeline: Timeline) {
		const ctx = {
			finalEchoes: Math.min(result.loops - 1, level.def.maxGhosts),
			beatGhost: rivalKind === 'best' && !!racedRival && result.totalTicks < racedRival.ticks
		};
		const outcome = dailyKey
			? progress.recordDaily(dailyKey, result, timeline, ctx, level.def.parSeconds)
			: progress.recordLevel(result, timeline, ctx);
		done = { result, timeline, outcome };
		submission = { state: 'pending' };
		const req = { board, timeline, playerId: profile.data.id, name: profile.data.name };
		try {
			const res = await submitRun(req);
			submission = {
				state: 'ok',
				id: res.id,
				rank: res.rank,
				total: res.total,
				improved: res.improved
			};
		} catch (e) {
			const offline = e instanceof ApiFailure && (e.status === 0 || e.status >= 500);
			if (offline) enqueue(req);
			submission = {
				state: 'error',
				message: offline
					? 'offline — queued, it will be sent when you reconnect'
					: (e as Error).message
			};
		}
	}

	function mount(stage: HTMLDivElement) {
		const canvas = stage.querySelector('canvas')!;
		const s = untrack(() => settings.data);
		const r = untrack(() => rival);
		racedRival = r
			? { name: rivalKind === 'best' ? 'your best' : r.name, ticks: r.totalTicks }
			: null;
		const c = new GameController(canvas, {
			level,
			settings: {
				screenShake: s.screenShake,
				haptics: s.haptics,
				reducedEffects: s.reducedEffects,
				reducedFlashing: s.reducedFlashing
			},
			// untracked: a new best saved on the results screen must not restart the running game;
			// "Run again" remounts and picks up the fresh ghost
			rival: r,
			onHud: (h) => (hud = h),
			onComplete: (r, t) => void onComplete(r, t),
			onHint,
			onFps: s.showFps ? (f) => (fps = f) : undefined
		});
		controller = c;
		// dev-only hook for automated browser QA (tree-shaken from production builds)
		if (import.meta.env.DEV) (window as unknown as { __game: GameController }).__game = c;
		c.start();
		audio.startMusic();
		return () => {
			c.destroy();
			audio.stopMusic();
			controller = null;
		};
	}

	function restart() {
		done = null;
		submission = { state: 'off' };
		rival?.reset();
		runId++;
	}

	function quit() {
		void goto(backHref);
	}

	let intro = $derived(hud?.phase === 'ready' && hud.loop === 1);
	let readyPrompt = $derived(hud?.phase === 'ready' && hud.loop > 1);
</script>

<svelte:document onvisibilitychange={() => document.hidden && controller?.pause()} />

<div class="wrap">
	{#key runId}
		<div class="stage" {@attach mount}>
			<canvas></canvas>

			{#if touch && !done}
				<TouchControls showHelp={intro} />
			{/if}

			{#if hud && !done}
				<Hud
					{hud}
					title={heading}
					{touch}
					{fps}
					onPause={() => controller?.togglePause()}
					onRewind={() => controller?.requestRewind()}
				/>
			{/if}

			{#if intro}
				<div class="card-intro fade-up">
					<div class="eyebrow">
						{mode === 'daily'
							? 'Daily Paradox'
							: mode === 'challenge'
								? 'Ghost challenge'
								: 'Level'}
					</div>
					<h1>{heading}</h1>
					<p>{level.def.tagline}</p>
					<div class="go">{touch ? 'Move to start' : 'Move with A / D or ← → to start'}</div>
				</div>
			{:else if readyPrompt && hud}
				<div class="ready fade-up">
					<b>LOOP {hud.loop}</b>
					<span>{hud.echoes} echo{hud.echoes === 1 ? '' : 'es'} synced — move to start</span>
				</div>
			{/if}

			{#if toast}
				{#key toast.id}
					<div class="toast fade-up" class:ach={toast.kind === 'ach'} role="status">
						{toast.text}
					</div>
				{/key}
			{/if}

			{#if hud?.phase === 'paused'}
				<PauseMenu
					title={heading}
					tagline={level.def.tagline}
					onResume={() => controller?.resume()}
					onRestart={restart}
					onQuit={quit}
				/>
			{/if}

			{#if done}
				<Results
					{heading}
					result={done.result}
					outcome={done.outcome}
					{submission}
					{nextHref}
					rival={racedRival}
					ending={mode === 'campaign' && !nextHref}
					onRetry={restart}
					onMenu={quit}
					onBoard={() => goto(`/leaderboard?board=${encodeURIComponent(board)}`)}
				/>
			{/if}
		</div>
	{/key}

	{#if touch}
		<div class="rotate" role="alert">
			<svg viewBox="0 0 24 24" width="48" height="48"
				><rect
					x="7"
					y="3"
					width="10"
					height="18"
					rx="2"
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
				/><path
					d="M20 14a8 8 0 0 1-6 6"
					fill="none"
					stroke="currentColor"
					stroke-width="1.6"
					stroke-linecap="round"
				/></svg
			>
			<p>Turn your phone sideways</p>
			<button class="btn" onclick={quit}>Back to menu</button>
		</div>
	{/if}
</div>

<style>
	.wrap {
		position: fixed;
		inset: 0;
		background: var(--color-ink);
		overflow: hidden;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}
	.stage {
		position: absolute;
		inset: 0;
	}
	canvas {
		display: block;
		position: absolute;
		inset: 0;
	}
	.card-intro {
		position: absolute;
		left: 50%;
		top: 16%;
		translate: -50% 0;
		text-align: center;
		pointer-events: none;
		z-index: 3;
		width: min(92vw, 560px);
		text-shadow: 0 2px 16px rgba(0, 0, 0, 0.8);
	}
	.card-intro h1 {
		font-size: clamp(1.6rem, 5vw, 2.6rem);
		font-weight: 800;
		letter-spacing: 0.01em;
		margin: 2px 0 4px;
	}
	.card-intro p {
		color: #c3cbe0;
		font-size: 0.95rem;
	}
	.go {
		margin-top: 14px;
		font-size: 0.72rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-echo);
		animation: pulse 1.6s ease-in-out infinite;
	}
	.ready {
		position: absolute;
		left: 50%;
		top: 30%;
		translate: -50% 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		pointer-events: none;
		z-index: 3;
		text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8);
	}
	.ready b {
		font-size: 1.4rem;
		letter-spacing: 0.2em;
	}
	.ready span {
		font-size: 0.75rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-echo);
		animation: pulse 1.6s ease-in-out infinite;
	}
	.toast {
		position: absolute;
		left: 50%;
		top: calc(62px + var(--safe-t));
		translate: -50% 0;
		max-width: min(92vw, 540px);
		padding: 10px 16px;
		border-radius: 14px;
		background: rgba(10, 16, 30, 0.82);
		border: 1px solid rgba(127, 211, 255, 0.4);
		color: #dff3ff;
		font-size: 0.85rem;
		line-height: 1.35;
		text-align: center;
		z-index: 6;
		pointer-events: none;
		backdrop-filter: blur(8px);
	}
	.toast.ach {
		border-color: rgba(185, 155, 255, 0.5);
		color: #e4dbff;
	}
	.rotate {
		display: none;
	}
	@media (orientation: portrait) {
		.rotate {
			position: absolute;
			inset: 0;
			z-index: 50;
			display: grid;
			place-content: center;
			justify-items: center;
			gap: 12px;
			background: var(--color-ink);
			color: var(--color-dim);
			font-size: 0.9rem;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}
		.rotate svg {
			animation: tilt 2s ease-in-out infinite;
		}
	}
	@media (max-height: 420px) {
		.card-intro {
			top: 18%;
		}
		.card-intro h1 {
			font-size: 1.5rem;
		}
		.card-intro p {
			font-size: 0.82rem;
		}
		.go {
			margin-top: 8px;
		}
	}
	@keyframes pulse {
		50% {
			opacity: 0.45;
		}
	}
	@keyframes tilt {
		40%,
		70% {
			transform: rotate(-90deg);
		}
	}
</style>
