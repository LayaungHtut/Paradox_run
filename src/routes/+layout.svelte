<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { audio } from '$lib/game/audio/audio';
	import { flushQueue } from '$lib/net/queue';
	import { profile } from '$lib/state/profile.svelte';
	import { progress } from '$lib/state/progress.svelte';
	import { settings } from '$lib/state/settings.svelte';

	let { children } = $props();

	// ssr is disabled, so this runs once in the browser before any page renders
	settings.load();
	profile.load();
	progress.load();
	void flushQueue();

	function unlockAudio() {
		audio.unlock();
	}

	/** Soft click on every menu button — one delegated listener instead of one per button. */
	function uiClick(e: MouseEvent) {
		const el = (e.target as HTMLElement | null)?.closest?.('button, a.btn, a.card');
		if (el && !el.closest('[data-silent]')) audio.play('ui');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>PARADOX RUN</title>
</svelte:head>

<svelte:window
	onclick={uiClick}
	onpointerdown={unlockAudio}
	onkeydown={unlockAudio}
	ononline={() => void flushQueue()}
/>
<svelte:document onvisibilitychange={() => (document.hidden ? audio.suspend() : audio.resume())} />

{@render children()}
