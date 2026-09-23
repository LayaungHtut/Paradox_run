<script lang="ts">
	import GameView from '$lib/components/game/GameView.svelte';
	import { dailyLevel } from '$lib/game/levels/daily';
	import { dayKey } from '$lib/state/progress.svelte';

	// The day is fixed when the page opens: a run that crosses midnight still belongs to its start day
	// (the server accepts yesterday's board for exactly this reason).
	const key = dayKey();
	const { config, level } = dailyLevel(key);
</script>

<svelte:head><title>Daily Paradox #{config.number} · PARADOX RUN</title></svelte:head>

<GameView
	{level}
	heading={`Daily #${config.number} · ${config.def.name}${config.mirror ? ' ⇄' : ''}`}
	board={`daily:${key}`}
	mode="daily"
	dailyKey={key}
	backHref="/daily"
/>
