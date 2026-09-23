import { describe, expect, it } from 'vitest';
import { IN_DASH, IN_JUMP, IN_RIGHT, TILE } from '../core/constants';
import { parseLevel } from '../levels/parse';
import type { LevelDef } from '../levels/types';
import { World } from './world';

const flat = (extra: Partial<LevelDef> = {}, map?: string[]): LevelDef => ({
	id: 'test',
	name: 'test',
	tagline: '',
	loopSeconds: 20,
	maxGhosts: 2,
	parSeconds: 30,
	map: map ?? [
		'####################',
		'#..................#',
		'#..................#',
		'#..................#',
		'#.P..............X.#',
		'####################'
	],
	...extra
});

const settle = (w: World, input = 0, n = 30) => {
	for (let i = 0; i < n; i++) w.step(input);
};

describe('world physics', () => {
	it('player lands on the floor and rests exactly on it', () => {
		const w = new World(parseLevel(flat()));
		settle(w);
		expect(w.player.onGround).toBe(true);
		expect(w.player.y + w.player.h).toBe(5 * TILE);
	});

	it('running right accelerates to run speed and is stopped by walls', () => {
		const w = new World(parseLevel(flat({}, ['#######', '#.....#', '#P...X#', '#######'])));
		settle(w, IN_RIGHT, 200);
		expect(w.player.x + w.player.w).toBe(6 * TILE);
		expect(w.exitReached).toBe(true);
		expect(w.player.vx).toBe(0);
	});

	it('jump reaches roughly three tiles; tap-jump is much lower', () => {
		const measure = (holdTicks: number) => {
			const w = new World(parseLevel(flat()));
			settle(w);
			const floorY = w.player.y;
			let minY = floorY;
			for (let i = 0; i < 60; i++) {
				w.step(i < holdTicks ? IN_JUMP : 0);
				minY = Math.min(minY, w.player.y);
			}
			return floorY - minY;
		};
		const full = measure(40);
		const tap = measure(1);
		expect(full).toBeGreaterThan(2.7 * TILE);
		expect(full).toBeLessThan(3.2 * TILE);
		expect(tap).toBeLessThan(full * 0.6);
	});

	it('dash covers about three tiles without falling', () => {
		const w = new World(parseLevel(flat()));
		settle(w);
		const x0 = w.player.x;
		w.step(IN_DASH | IN_RIGHT);
		for (let i = 0; i < 8; i++) w.step(IN_RIGHT);
		expect(w.player.x - x0).toBeGreaterThan(2.5 * TILE);
	});

	it('spikes kill; falling into the void kills', () => {
		const spikes = flat({}, ['#######', '#.....#', '#P.^^X#', '#######']);
		const w = new World(parseLevel(spikes));
		settle(w, IN_RIGHT, 60);
		expect(w.player.alive).toBe(false);

		const pit = flat({}, ['#######', '#.....#', '#P...X#', '##..###']);
		const w2 = new World(parseLevel(pit));
		for (let i = 0; i < 200 && w2.player.alive; i++) w2.step(i < 12 ? IN_RIGHT : 0);
		expect(w2.player.alive).toBe(false);
	});
});

describe('mechanisms', () => {
	const plateLevel = flat(
		{ legend: { a: { type: 'plate', ch: 'A' }, A: { type: 'door', ch: 'A', linger: 0 } } },
		['##########', '#........#', '#....A...#', '#P.a.A..X#', '##########']
	);

	it('plate opens its door only while weighted', () => {
		const w = new World(parseLevel(plateLevel));
		expect(w.doors[0].open).toBe(false);
		settle(w, IN_RIGHT, 14);
		// walk until standing on the plate (tile 3)
		while (w.player.x < 3 * TILE) w.step(IN_RIGHT);
		settle(w, 0, 20);
		expect(w.platePressed[0]).toBe(1);
		expect(w.doors[0].open).toBe(true);
	});

	it('a ghost holds the plate so the player can pass', () => {
		// record a loop: walk onto the plate and stay
		const lvl = parseLevel(plateLevel);
		const rec: number[] = [];
		const w1 = new World(lvl);
		while (w1.player.x < 3 * TILE + 2) {
			rec.push(IN_RIGHT);
			w1.step(IN_RIGHT);
		}
		for (let i = 0; i < 400; i++) {
			rec.push(0);
			w1.step(0);
		}
		// next loop: ghost replays; player walks straight to the exit
		const w2 = new World(lvl, [Uint8Array.from(rec)]);
		for (let i = 0; i < 400 && !w2.exitReached; i++) w2.step(IN_RIGHT);
		expect(w2.exitReached).toBe(true);
		expect(w2.assistMask).toBe(1);
	});

	it('the ghost expires when its recording ends', () => {
		const lvl = parseLevel(plateLevel);
		const w = new World(lvl, [new Uint8Array(10)]);
		settle(w, 0, 12);
		expect(w.bodies[1].alive).toBe(false);
	});
});

describe('determinism', () => {
	it('identical inputs produce identical state', () => {
		const lvl = parseLevel(flat());
		const inputs = Array.from(
			{ length: 600 },
			(_, i) =>
				((i * 7919) % 13 < 6 ? IN_RIGHT : 0) |
				(i % 37 === 0 ? IN_JUMP : 0) |
				(i % 91 === 0 ? IN_DASH : 0)
		);
		const run = () => {
			const w = new World(lvl, [Uint8Array.from(inputs.slice(0, 300))]);
			for (const i of inputs) w.step(i);
			return w.hash();
		};
		expect(run()).toBe(run());
	});
});
