import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { RunResult } from '$lib/game/run/session';
import Results from './Results.svelte';

const result: RunResult = {
	levelId: 'first-echo',
	mirrored: false,
	totalTicks: 1200,
	loops: 2,
	deaths: 0,
	shards: 1,
	shardTotal: 1,
	syncs: 1,
	score: { base: 1000, time: 300, shards: 250, sync: 200, clean: 300, total: 2050 },
	stars: 3
};
const noop = () => {};

describe('Results screen', () => {
	it('shows time, the score breakdown and a new-record badge', async () => {
		render(Results, {
			heading: '1 · First Echo',
			result,
			outcome: {
				newBest: true,
				newBestTime: true,
				previousBest: { bestScore: 1500, bestTicks: 1500 },
				unlocked: ['clean']
			},
			submission: { state: 'off' },
			nextHref: '/play/relay',
			rival: null,
			onRetry: noop,
			onMenu: noop,
			onBoard: noop
		});
		await expect.element(page.getByText('Best time 20.00s')).toBeInTheDocument();
		await expect.element(page.getByText('New record · was 25.00s')).toBeInTheDocument();
		await expect.element(page.getByText('Echo sync ×1')).toBeInTheDocument();
		await expect.element(page.getByText('No Death Clear')).toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'Next level' })).toBeInTheDocument();
	});

	it('shows the ending after the final level and reports racing your own ghost', async () => {
		render(Results, {
			heading: '9 · Paradox Engine',
			result,
			outcome: {
				newBest: false,
				newBestTime: false,
				previousBest: { bestScore: 9000, bestTicks: 900 },
				unlocked: []
			},
			submission: { state: 'error', message: 'offline — queued' },
			nextHref: null,
			rival: { name: 'your best', ticks: 900 },
			ending: true,
			onRetry: noop,
			onMenu: noop,
			onBoard: noop
		});
		await expect.element(page.getByText('Timeline closed.')).toBeInTheDocument();
		await expect.element(page.getByText(/Your best ghost was 5.00s faster/)).toBeInTheDocument();
		await expect.element(page.getByText(/Your result is saved on this device/)).toBeInTheDocument();
	});
});
