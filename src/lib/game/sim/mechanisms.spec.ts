import { describe, expect, it } from 'vitest';
import { IN_JUMP, IN_LEFT, IN_RIGHT, TILE } from '../core/constants';
import { parseLevel } from '../levels/parse';
import type { LevelDef } from '../levels/types';
import { RunSession } from '../run/session';
import { World } from './world';

const level = (
	map: string[],
	legend: LevelDef['legend'] = {},
	extra: Partial<LevelDef> = {}
): LevelDef => ({
	id: 't',
	name: 't',
	tagline: '',
	loopSeconds: 20,
	maxGhosts: 3,
	parSeconds: 30,
	map,
	legend,
	...extra
});

const run = (w: World, input: number, ticks: number) => {
	for (let i = 0; i < ticks; i++) w.step(input);
};

describe('replay fidelity', () => {
	it('an echo retraces the recorded loop tick-for-tick', () => {
		const def = level([
			'############',
			'#..........#',
			'#....#.....#',
			'#P...##...X#',
			'############'
		]);
		const inputs = Uint8Array.from(
			{ length: 240 },
			(_, i) => (i < 200 ? IN_RIGHT : 0) | (i % 40 < 12 ? IN_JUMP : 0)
		);
		const lvl = parseLevel(def);
		const original = new World(lvl);
		const path: number[] = [];
		for (const i of inputs) {
			original.step(i);
			path.push(original.player.x, original.player.y);
		}
		// next loop: the echo replays while the player idles at spawn
		const next = new World(lvl, [inputs]);
		const echoPath: number[] = [];
		for (let t = 0; t < inputs.length; t++) {
			next.step(0);
			echoPath.push(next.bodies[1].x, next.bodies[1].y);
		}
		expect(echoPath).toEqual(path);
	});

	it('resetting a level always produces the same initial state', () => {
		const def = level(['########', '#......#', '#P.a.AX#', '########'], {
			a: { type: 'plate', ch: 'A' },
			A: { type: 'door', ch: 'A' }
		});
		const a = new World(parseLevel(def));
		const b = new World(parseLevel(def));
		expect(a.hash()).toBe(b.hash());
		const s = new RunSession(parseLevel(def));
		const initial = s.world.hash();
		for (let i = 0; i < 50; i++) s.step(IN_RIGHT);
		s.rewind();
		s.beginLoop();
		// same geometry and mechanism state; one echo body now exists at spawn
		expect(s.world.tick).toBe(0);
		expect(s.world.bodies[0].x).toBe(new World(parseLevel(def)).player.x);
		expect(s.world.hash().split('|')[0]).toBe(initial.split('|')[0]);
	});

	it('three simultaneous echoes stay deterministic', () => {
		const def = level([
			'################',
			'#..............#',
			'#P...#....#...X#',
			'################'
		]);
		const lvl = parseLevel(def);
		const streams = [0, 1, 2].map((k) =>
			Uint8Array.from(
				{ length: 300 },
				(_, i) => ((i + k * 17) % 50 < 30 ? IN_RIGHT : IN_LEFT) | ((i + k) % 23 === 0 ? IN_JUMP : 0)
			)
		);
		const once = () => {
			const w = new World(lvl, streams);
			run(w, IN_RIGHT, 300);
			return w.hash();
		};
		expect(once()).toBe(once());
	});
});

describe('mechanisms', () => {
	it('a relay powers its channel for exactly its duration', () => {
		const def = level(['#########', '#.......#', '#Pr..A.X#', '#########'], {
			r: { type: 'relay', ch: 'A', duration: 30 },
			A: { type: 'door', ch: 'A', linger: 0 }
		});
		const w = new World(parseLevel(def));
		let firstOn = -1;
		let lastOn = -1;
		for (let t = 0; t < 200; t++) {
			w.step(t < 24 ? IN_RIGHT : 0); // touch the relay and keep going
			if (w.relayTimer[0] !== 0) {
				if (firstOn < 0) firstOn = t;
				lastOn = t;
			}
		}
		expect(firstOn).toBeGreaterThanOrEqual(0);
		// the body stands on the relay briefly (re-arming it) and then it counts down 30 ticks
		expect(lastOn - firstOn).toBeGreaterThanOrEqual(29);
		expect(w.relayTimer[0]).toBe(0);
	});

	it('a lift carries its rider up while powered and lets them jump off', () => {
		const def = level(
			['########', '#......#', '#......#', '#......#', '#.aP..X#', '###LL###', '########'],
			{
				a: { type: 'plate', ch: 'A' },
				L: { type: 'lift', ch: 'A', dx: 0, dy: -2, speed: 1 }
			}
		);
		const lvl = parseLevel(def);
		// echo stands on the plate forever; player steps onto the lift
		const echo = Uint8Array.from({ length: 400 }, (_, i) => (i < 12 ? IN_LEFT : 0)); // step onto the plate and stay
		const w = new World(lvl, [echo]);
		run(w, 0, 70);
		expect(w.lifts[0].y).toBe(lvl.lifts[0].y - 2 * TILE);
		expect(w.player.y + w.player.h).toBe(w.lifts[0].y); // carried all the way up, standing on it
		expect(w.player.onGround).toBe(true);
		w.step(IN_JUMP);
		expect(w.player.vy).toBeLessThan(0);
	});

	it('the Warden locks onto the nearest body — an echo can take the shot', () => {
		const def = level(
			[
				'####################',
				'#..................#',
				'#........t.........#',
				'#..................#',
				'#P................X#',
				'####################'
			],
			{
				t: { type: 'turret', range: 8 }
			}
		);
		const lvl = parseLevel(def);
		// the echo walks towards the Warden; the player stays at spawn out of range
		const w = new World(lvl, [new Uint8Array(400).fill(IN_RIGHT)]);
		let lockedOn = -1;
		for (let t = 0; t < 300 && lockedOn < 0; t++) {
			w.step(0);
			if (w.turrets[0].mode === 1) lockedOn = w.turrets[0].target;
		}
		expect(lockedOn).toBe(1); // body index 1 = the echo
		run(w, 0, 120);
		expect(w.player.alive).toBe(true);
	});

	it('a gate never closes on a body standing in it', () => {
		const def = level(['#########', '#.......#', '#Pa..A.X#', '#########'], {
			a: { type: 'plate', ch: 'A' },
			A: { type: 'door', ch: 'A', linger: 0 }
		});
		const lvl = parseLevel(def);
		// an echo walks onto the plate and leaves again after 60 ticks; the player parks in the doorway
		const echo = Uint8Array.from({ length: 200 }, (_, i) =>
			i < 8 || (i >= 60 && i < 90) ? IN_RIGHT : 0
		);
		const w = new World(lvl, [echo]);
		run(w, 0, 20);
		expect(w.doors[0].open).toBe(true);
		for (let i = 0; i < 200 && w.player.x + w.player.w < lvl.doors[0].x + 4; i++) w.step(IN_RIGHT);
		expect(w.player.x + w.player.w).toBeGreaterThanOrEqual(lvl.doors[0].x + 4);
		run(w, 0, 150); // the echo has long left the plate
		expect(w.platePressed[0]).toBe(0);
		expect(w.doors[0].open).toBe(true); // still open: it would close on the player
	});

	it('jumping into a ceiling corner by a few units slides around it', () => {
		// a 1-tile ledge overhang: the jump clips its corner but should not be stopped
		const def = level([
			'#######',
			'#.....#',
			'#.....#',
			'#..#..#',
			'#.....#',
			'#P...X#',
			'#######'
		]);
		const lvl = parseLevel(def);
		const w = new World(lvl);
		run(w, 0, 20);
		// place the head 3 units under the left edge of the overhang tile (col 3)
		w.player.x = 3 * TILE - w.player.w + 3;
		w.player.px = w.player.x;
		w.step(IN_JUMP);
		let minY = w.player.y;
		for (let i = 0; i < 30; i++) {
			w.step(IN_JUMP);
			minY = Math.min(minY, w.player.y);
		}
		expect(minY).toBeLessThan(4 * TILE - w.player.h); // got past the overhang's underside
	});
});
