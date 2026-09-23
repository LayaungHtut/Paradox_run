<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';
</script>

<svelte:head><title>Credits · PARADOX RUN</title></svelte:head>

<PageShell title="Credits">
	<section class="panel block">
		<h2 class="eyebrow">PARADOX RUN</h2>
		<p class="lead">
			A time-loop arcade platformer about the one teammate you always have: yourself, a few seconds
			ago.
		</p>
	</section>

	<section class="panel block">
		<h2 class="eyebrow">Made with</h2>
		<ul>
			<li><b>Svelte 5 &amp; SvelteKit</b> — UI shell (MIT)</li>
			<li><b>Vite</b> — build tooling (MIT)</li>
			<li><b>TypeScript</b> — language (Apache-2.0)</li>
			<li><b>Tailwind CSS</b> — utility styles (MIT)</li>
			<li><b>Vitest &amp; Playwright</b> — tests, including browser tests (MIT / Apache-2.0)</li>
		</ul>
	</section>

	<section class="panel block">
		<h2 class="eyebrow">Art &amp; audio</h2>
		<p>
			Every image is drawn by the game's own code with Canvas 2D, and every sound and note of music
			is synthesised live with WebAudio. The game ships no third-party art, fonts, samples or music.
		</p>
	</section>

	<section class="panel block">
		<h2 class="eyebrow">AI assistance</h2>
		<p>
			Code, tests and documentation were written with AI assistance (Claude Code by Anthropic). See
			<code>docs/AI_USE_LOG.md</code> in the source for what was generated and how it was checked.
		</p>
	</section>

	<section class="panel block">
		<h2 class="eyebrow">Inspiration</h2>
		<p>
			Cooperating with your recorded past self is a much-loved idea in games; Chronotron and The
			Company of Myself are classic examples. PARADOX RUN's levels, code, art and audio are its own.
		</p>
	</section>
</PageShell>

<style>
	.block {
		padding: 16px 18px;
		margin-bottom: 14px;
		display: grid;
		gap: 8px;
		font-size: 0.9rem;
		color: #c3cbe0;
	}
	.lead {
		font-size: 1rem;
		color: var(--color-text);
	}
	ul {
		display: grid;
		gap: 4px;
	}
	b {
		color: var(--color-text);
	}
	code {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--color-echo);
	}
</style>
