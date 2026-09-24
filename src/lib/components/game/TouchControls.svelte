<script lang="ts">
	/*
	 * Visual layer only. Touch handling lives in InputManager, which treats the whole left 42% of the
	 * screen as a movement pad and the right side as jump/flick — generous zones beat small buttons.
	 * The DASH button is the one real target (marked data-dash).
	 */
	interface Props {
		showHelp: boolean;
	}
	let { showHelp }: Props = $props();
</script>

<div class="touch" aria-hidden="true">
	<div class="pad" data-pad>
		<div class="arrow l">
			<svg viewBox="0 0 24 24" width="30" height="30"
				><path
					d="M15 5l-7 7 7 7"
					fill="none"
					stroke="currentColor"
					stroke-width="2.6"
					stroke-linecap="round"
					stroke-linejoin="round"
				/></svg
			>
		</div>
		<div class="arrow r">
			<svg viewBox="0 0 24 24" width="30" height="30"
				><path
					d="M9 5l7 7-7 7"
					fill="none"
					stroke="currentColor"
					stroke-width="2.6"
					stroke-linecap="round"
					stroke-linejoin="round"
				/></svg
			>
		</div>
	</div>
	{#if showHelp}
		<div class="help fade-up">
			<span>Slide left thumb to run</span>
			<span>Tap right side to jump · flick to dash</span>
		</div>
	{/if}
	<div class="actions">
		<div class="dash" data-dash>DASH</div>
		<div class="jump">JUMP</div>
	</div>
</div>

<style>
	/* one bottom row: pad · help · actions; the help text wraps into whatever room is left */
	.touch {
		position: absolute;
		left: calc(18px + var(--safe-l));
		right: calc(18px + var(--safe-r));
		bottom: calc(18px + var(--safe-b));
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 12px;
		pointer-events: none;
		z-index: 4;
		user-select: none;
		-webkit-user-select: none;
	}
	.pad {
		display: flex;
		gap: 10px;
	}
	.arrow {
		width: 76px;
		height: 76px;
		border-radius: 22px;
		display: grid;
		place-items: center;
		color: rgba(232, 236, 245, 0.75);
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	.actions {
		display: flex;
		align-items: flex-end;
		gap: 12px;
	}
	.jump,
	.dash {
		display: grid;
		place-items: center;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.16em;
		border-radius: 999px;
	}
	.jump {
		width: 92px;
		height: 92px;
		color: rgba(232, 236, 245, 0.8);
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.14);
	}
	.dash {
		pointer-events: auto;
		width: 64px;
		height: 64px;
		margin-bottom: 64px;
		color: var(--color-echo);
		background: rgba(127, 211, 255, 0.08);
		border: 1px solid rgba(127, 211, 255, 0.35);
		touch-action: none;
	}
	.help {
		flex: 1 1 0;
		min-width: 0;
		margin-bottom: 6px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		font-size: 0.7rem;
		line-height: 1.3;
		letter-spacing: 0.08em;
		color: var(--color-dim);
		text-transform: uppercase;
		text-align: center;
		text-wrap: balance;
	}
	/* portrait: the row is too narrow to share, so the help sits on its own line above the controls */
	@media (orientation: portrait) {
		.help {
			order: -1;
			flex-basis: 100%;
			margin-bottom: 8px;
		}
	}
	@media (max-height: 360px), (max-width: 400px) {
		.arrow {
			width: 64px;
			height: 64px;
		}
		.jump {
			width: 78px;
			height: 78px;
		}
		.dash {
			width: 56px;
			height: 56px;
			margin-bottom: 52px;
		}
	}
</style>
