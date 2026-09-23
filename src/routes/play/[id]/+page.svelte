<script lang="ts">
	import { goto } from '$app/navigation';
	import GameView from '$lib/components/game/GameView.svelte';
	import { RivalReplay } from '$lib/game/client/rival';
	import { progress } from '$lib/state/progress.svelte';
	import { settings } from '$lib/state/settings.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let unlocked = $derived(progress.isUnlocked(data.level.def.id));
	$effect(() => {
		if (!unlocked) void goto('/levels', { replaceState: true });
	});
	// "Next level" appears once this level has been cleared at least once
	let nextHref = $derived(data.nextId ? `/play/${data.nextId}` : null);

	// Your fastest run races beside you as a gold ghost — only if it was recorded on this exact
	// version of the level (otherwise the replay would not be faithful)
	let bestGhost = $derived.by(() => {
		const rec = progress.data.levels[data.level.def.id];
		const t = rec?.bestTimeline;
		if (!settings.data.bestGhost || !t || t.lv !== data.level.version) return null;
		try {
			return new RivalReplay(data.level, t, 'BEST', rec.bestTicks);
		} catch {
			return null;
		}
	});
</script>

<svelte:head><title>{data.level.def.name} · PARADOX RUN</title></svelte:head>

{#if unlocked}
	{#key data.level.def.id}
		<GameView
			level={data.level}
			heading={`${data.index + 1} · ${data.level.def.name}`}
			board={`level:${data.level.def.id}`}
			mode="campaign"
			rival={bestGhost}
			rivalKind="best"
			{nextHref}
			backHref="/levels"
		/>
	{/key}
{/if}
