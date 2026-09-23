<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		eyebrow?: string;
		back?: string;
		wide?: boolean;
		children: Snippet;
		actions?: Snippet;
	}
	let { title, eyebrow, back = '/', wide = false, children, actions }: Props = $props();
</script>

<div class="shell" class:wide>
	<header>
		<a class="back" href={back} aria-label="Back">
			<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"
				><path
					d="M15 5l-7 7 7 7"
					fill="none"
					stroke="currentColor"
					stroke-width="2.4"
					stroke-linecap="round"
					stroke-linejoin="round"
				/></svg
			>
		</a>
		<div class="t">
			{#if eyebrow}<div class="eyebrow">{eyebrow}</div>{/if}
			<h1>{title}</h1>
		</div>
		{#if actions}<div class="actions">{@render actions()}</div>{/if}
	</header>
	<main class="fade-up">{@render children()}</main>
</div>

<style>
	.shell {
		max-width: 880px;
		margin: 0 auto;
		padding: calc(14px + var(--safe-t)) calc(18px + var(--safe-r)) calc(28px + var(--safe-b))
			calc(18px + var(--safe-l));
		min-height: 100dvh;
	}
	.shell.wide {
		max-width: 1100px;
	}
	header {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 16px;
	}
	.back {
		width: 44px;
		height: 44px;
		display: grid;
		place-items: center;
		border-radius: 12px;
		border: 1px solid var(--color-line);
		background: var(--color-panel);
		flex: none;
	}
	.back:hover {
		border-color: #3a4a6e;
	}
	h1 {
		font-size: 1.5rem;
		font-weight: 800;
		letter-spacing: 0.02em;
	}
	.t {
		flex: 1;
		min-width: 0;
	}
	.actions {
		display: flex;
		gap: 8px;
	}
</style>
