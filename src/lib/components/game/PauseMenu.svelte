<script lang="ts">
	import { settings } from '$lib/state/settings.svelte';

	interface Props {
		title: string;
		tagline: string;
		onResume: () => void;
		onRestart: () => void;
		onQuit: () => void;
	}
	let { title, tagline, onResume, onRestart, onQuit }: Props = $props();
</script>

<div class="overlay" data-ui role="dialog" aria-modal="true" aria-label="Paused">
	<div class="panel card fade-up">
		<div class="eyebrow">Paused</div>
		<h2>{title}</h2>
		<p class="tag">{tagline}</p>

		<div class="rules">
			<p><b>Every loop you finish becomes an echo</b> that replays your exact moves next loop.</p>
			<p>
				Echoes press plates, trip relays and draw fire. You can't touch them — plan around them.
			</p>
			<p><b>Rewind</b> ends the loop early; the echo keeps everything up to that moment.</p>
		</div>

		<div class="toggles">
			<label>
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
			<label>
				<span>Sound</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					value={settings.data.sfx}
					oninput={(e) => settings.update({ sfx: +e.currentTarget.value })}
				/>
			</label>
		</div>

		<div class="actions">
			<button class="btn btn-primary" onclick={onResume}>Resume</button>
			<button class="btn" onclick={onRestart}>Restart level</button>
			<button class="btn" onclick={onQuit}>Quit</button>
		</div>
	</div>
</div>

<style>
	.overlay {
		position: absolute;
		inset: 0;
		z-index: 20;
		display: grid;
		place-items: center;
		background: rgba(4, 6, 12, 0.6);
		padding: calc(12px + var(--safe-t)) 16px calc(12px + var(--safe-b));
		overflow-y: auto;
	}
	.card {
		width: min(520px, 100%);
		padding: 22px 22px 20px;
	}
	h2 {
		font-size: 1.5rem;
		font-weight: 800;
		letter-spacing: 0.02em;
		margin-top: 4px;
	}
	.tag {
		color: var(--color-dim);
		font-size: 0.9rem;
		margin-top: 2px;
	}
	.rules {
		margin: 14px 0;
		display: grid;
		gap: 6px;
		font-size: 0.85rem;
		color: #c3cbe0;
	}
	.rules b {
		color: var(--color-echo);
		font-weight: 650;
	}
	.toggles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-bottom: 16px;
	}
	.toggles label {
		display: grid;
		gap: 4px;
		font-size: 0.72rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-dim);
	}
	input[type='range'] {
		accent-color: var(--color-echo);
		width: 100%;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.actions .btn {
		flex: 1 1 140px;
	}
	@media (max-height: 420px) {
		.rules {
			display: none;
		}
		.card {
			padding: 16px;
		}
	}
</style>
