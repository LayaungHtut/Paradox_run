<script lang="ts">
	import PageShell from '$lib/components/PageShell.svelte';
	import { ACHIEVEMENTS } from '$lib/state/achievements';
	import { profile } from '$lib/state/profile.svelte';
	import { progress } from '$lib/state/progress.svelte';
	import { settings, type SettingsData } from '$lib/state/settings.svelte';
	import { audio } from '$lib/game/audio/audio';

	let name = $state(profile.data.name);
	let nameMsg = $state<string | null>(null);

	function saveName(e: SubmitEvent) {
		e.preventDefault();
		nameMsg = profile.rename(name)
			? 'Saved. New runs will use this name.'
			: '2–16 letters, numbers, spaces, . _ -';
	}

	const toggles: { key: keyof SettingsData; label: string; hint: string }[] = [
		{ key: 'screenShake', label: 'Screen shake', hint: 'Impact feedback on landings and deaths' },
		{ key: 'haptics', label: 'Vibration', hint: 'Android phones only' },
		{
			key: 'reducedEffects',
			label: 'Reduced effects',
			hint: 'Fewer particles — helps older phones'
		},
		{
			key: 'reducedFlashing',
			label: 'Reduced flashing',
			hint: 'Dims full-screen flashes on death and completion'
		},
		{
			key: 'bestGhost',
			label: 'Race your best ghost',
			hint: 'Your fastest run replays beside you in gold'
		},
		{ key: 'showFps', label: 'Show FPS', hint: 'Performance overlay in the HUD' }
	];

	let confirmReset = $state(false);
	function resetProgress() {
		if (!confirmReset) {
			confirmReset = true;
			return;
		}
		progress.reset();
		confirmReset = false;
	}
	let unlocked = $derived(Object.keys(progress.data.achievements).length);
</script>

<svelte:head><title>Profile & settings · PARADOX RUN</title></svelte:head>

<PageShell title="Profile & settings">
	<section class="panel block">
		<h2 class="eyebrow">Runner name</h2>
		<form onsubmit={saveName} class="name">
			<input bind:value={name} maxlength="16" autocomplete="nickname" aria-label="Runner name" />
			<button class="btn" type="submit">Save</button>
		</form>
		{#if nameMsg}<p class="msg">{nameMsg}</p>{/if}
		<p class="fine">
			No account needed. Your progress lives on this device; leaderboard entries use this name and
			an anonymous id.
		</p>
	</section>

	<section class="panel block">
		<h2 class="eyebrow">Audio</h2>
		<label class="toggle">
			<span><b>Mute all</b><small>Silences music and sound effects</small></span>
			<input
				type="checkbox"
				checked={settings.data.muted}
				onchange={(e) => settings.update({ muted: e.currentTarget.checked })}
			/>
		</label>
		<label class="slider">
			<span>Music</span>
			<input
				type="range"
				min="0"
				max="1"
				step="0.05"
				value={settings.data.music}
				oninput={(e) => settings.update({ music: +e.currentTarget.value })}
			/>
		</label>
		<label class="slider">
			<span>Sound effects</span>
			<input
				type="range"
				min="0"
				max="1"
				step="0.05"
				value={settings.data.sfx}
				oninput={(e) => settings.update({ sfx: +e.currentTarget.value })}
				onchange={() => audio.play('shard')}
			/>
		</label>
	</section>

	<section class="panel block">
		<h2 class="eyebrow">Feel & performance</h2>
		{#each toggles as t (t.key)}
			<label class="toggle">
				<span><b>{t.label}</b><small>{t.hint}</small></span>
				<input
					type="checkbox"
					checked={settings.data[t.key] as boolean}
					onchange={(e) => settings.update({ [t.key]: e.currentTarget.checked })}
				/>
			</label>
		{/each}
	</section>

	<section class="panel block">
		<h2 class="eyebrow">Achievements · {unlocked}/{ACHIEVEMENTS.length}</h2>
		<ul class="ach">
			{#each ACHIEVEMENTS as a (a.id)}
				<li class:got={progress.data.achievements[a.id]}>
					<b>{a.name}</b>
					<span>{a.desc}</span>
				</li>
			{/each}
		</ul>
	</section>

	<section class="panel block">
		<h2 class="eyebrow">Save data</h2>
		<p class="fine">
			Progress, best times, ghosts and achievements are stored only in this browser.
		</p>
		<div class="reset">
			<button class="btn" class:danger={confirmReset} onclick={resetProgress}>
				{confirmReset ? 'Tap again to erase everything' : 'Reset progress'}
			</button>
			{#if confirmReset}<button class="btn" onclick={() => (confirmReset = false)}>Cancel</button
				>{/if}
		</div>
	</section>

	<section class="panel block">
		<h2 class="eyebrow">Controls</h2>
		<dl class="controls">
			<dt>Touch</dt>
			<dd>
				Left thumb: slide to run · Right side: tap to jump (hold for height), flick to dash · ⟲ ends
				the loop early
			</dd>
			<dt>Keyboard</dt>
			<dd>A/D or ←/→ run · Space/W/↑ jump · Shift/X dash · R rewind · Esc pause</dd>
		</dl>
	</section>
</PageShell>

<style>
	.block {
		padding: 16px 18px;
		margin-bottom: 14px;
		display: grid;
		gap: 10px;
	}
	.name {
		display: flex;
		gap: 10px;
	}
	.name input {
		flex: 1;
		min-height: 48px;
		border-radius: 12px;
		background: var(--color-ink);
		border: 1px solid var(--color-line);
		padding: 0 14px;
		color: var(--color-text);
		font-weight: 600;
	}
	.msg {
		font-size: 0.82rem;
		color: var(--color-echo);
	}
	.fine {
		font-size: 0.78rem;
		color: var(--color-dim);
	}
	.slider {
		display: grid;
		grid-template-columns: 120px 1fr;
		align-items: center;
		gap: 12px;
		font-size: 0.9rem;
	}
	input[type='range'] {
		accent-color: var(--color-echo);
	}
	.toggle {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		min-height: 48px;
		cursor: pointer;
	}
	.toggle span {
		display: grid;
	}
	.toggle small {
		font-size: 0.76rem;
		color: var(--color-dim);
	}
	.toggle input {
		width: 22px;
		height: 22px;
		accent-color: var(--color-echo);
	}
	.ach {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 8px;
	}
	.ach li {
		padding: 10px 12px;
		border-radius: 12px;
		border: 1px solid var(--color-line);
		display: grid;
		opacity: 0.45;
		font-size: 0.82rem;
	}
	.ach li.got {
		opacity: 1;
		border-color: rgba(185, 155, 255, 0.45);
		background: rgba(185, 155, 255, 0.07);
	}
	.ach span {
		color: var(--color-dim);
	}
	.controls {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 6px 14px;
		font-size: 0.84rem;
	}
	.reset {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.danger {
		border-color: var(--color-danger);
		color: var(--color-danger);
	}
	.controls dt {
		color: var(--color-dim);
	}
</style>
