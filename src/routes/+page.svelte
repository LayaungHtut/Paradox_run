<script lang="ts">
	import { AttractPlayer } from '$lib/game/client/attract';
	import { CAMPAIGN, levelById } from '$lib/game/levels/campaign';
	import { dailyConfig } from '$lib/game/levels/daily';
	import { dayKey, progress } from '$lib/state/progress.svelte';
	import { profile } from '$lib/state/profile.svelte';
	import { enterImmersive } from '$lib/ui/immersive';

	const nextId = progress.nextLevelId;
	const nextIndex = CAMPAIGN.findIndex((l) => l.id === nextId);
	const started = Object.keys(progress.data.levels).length > 0;
	const today = dayKey();
	const daily = dailyConfig(today);
	const dailyDone = progress.data.daily[today];

	function attract(stage: HTMLDivElement) {
		const canvas = stage.querySelector('canvas')!;
		const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduced) return;
		const p = new AttractPlayer(canvas, levelById('two-of-me') ?? CAMPAIGN[0]);
		p.start();
		return () => p.stop();
	}
</script>

<svelte:head><title>PARADOX RUN</title></svelte:head>

<div class="bg" {@attach attract}><canvas></canvas></div>

<main class="home">
	<header class="fade-up">
		<div class="eyebrow">A time-loop arcade platformer</div>
		<h1><span>PARADOX</span> RUN</h1>
		<p class="pitch">Every run you lose <em>runs with you.</em></p>
	</header>

	<nav class="menu fade-up" style="animation-delay: 0.08s">
		<a class="btn btn-primary big" href={`/play/${nextId}`} onclick={enterImmersive}>
			{started ? 'Continue' : 'Play'}
			<small>{nextIndex + 1} · {CAMPAIGN[nextIndex].name}</small>
		</a>
		<a class="btn btn-echo" href="/daily">
			Daily Paradox #{daily.number}
			{#if dailyDone}<small>best {dailyDone.bestScore.toLocaleString()}</small>{/if}
		</a>
		<div class="row">
			<a class="btn" href="/levels"
				>Levels <small>★ {progress.totalStars}/{CAMPAIGN.length * 3}</small></a
			>
			<a class="btn" href="/leaderboard">Leaderboard</a>
			<a class="btn" href="/settings" aria-label="Settings and profile">Profile</a>
		</div>
	</nav>

	<section class="how fade-up" style="animation-delay: 0.16s" aria-label="How to play">
		<div><b>1 · Run.</b> Reach the exit before the loop collapses.</div>
		<div><b>2 · Fail.</b> Every loop you end becomes an <em>echo</em>.</div>
		<div>
			<b>3 · Cooperate.</b> Echoes replay you exactly — they hold plates, trip relays, take bullets.
		</div>
	</section>

	<footer>
		Playing as <a href="/settings">{profile.data.name}</a>
		{#if progress.data.streak > 0}· {progress.data.streak}-day streak{/if}
		· <a href="/credits">Credits</a>
	</footer>
</main>

<style>
	.bg {
		position: fixed;
		inset: 0;
		opacity: 0.9;
		pointer-events: none;
	}
	.bg canvas {
		display: block;
	}
	.bg::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			90deg,
			rgba(7, 10, 18, 0.92) 0%,
			rgba(7, 10, 18, 0.6) 45%,
			rgba(7, 10, 18, 0.05) 100%
		);
	}
	.home {
		position: relative;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 22px;
		padding: calc(24px + var(--safe-t)) calc(24px + var(--safe-r)) calc(20px + var(--safe-b))
			calc(28px + var(--safe-l));
		max-width: 720px;
	}
	h1 {
		font-size: clamp(2.6rem, 8vw, 4.6rem);
		font-weight: 900;
		letter-spacing: 0.06em;
		line-height: 0.95;
		margin-top: 6px;
	}
	h1 span {
		color: var(--color-echo);
		text-shadow: 0 0 28px rgba(127, 211, 255, 0.35);
	}
	.pitch {
		margin-top: 10px;
		font-size: 1.1rem;
		color: #c3cbe0;
	}
	.pitch em {
		font-style: normal;
		color: var(--color-echo);
	}
	.menu {
		display: grid;
		gap: 10px;
		max-width: 440px;
	}
	.menu .btn {
		justify-content: space-between;
	}
	.menu small {
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		text-transform: none;
		opacity: 0.7;
		font-weight: 600;
	}
	.big {
		min-height: 58px;
		font-size: 1rem;
	}
	.row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}
	.row .btn {
		flex-direction: column;
		justify-content: center;
		gap: 0;
		padding: 0 8px;
	}
	.how {
		display: grid;
		gap: 6px;
		font-size: 0.88rem;
		color: #aeb8d2;
		max-width: 480px;
	}
	.how b {
		color: var(--color-text);
	}
	.how em {
		font-style: normal;
		color: var(--color-echo);
	}
	footer {
		font-size: 0.78rem;
		color: var(--color-dim);
	}
	footer a {
		color: var(--color-text);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	@media (max-height: 480px) {
		.home {
			gap: 12px;
			padding-top: calc(12px + var(--safe-t));
		}
		h1 {
			font-size: 2.4rem;
		}
		.how {
			display: none;
		}
	}
</style>
