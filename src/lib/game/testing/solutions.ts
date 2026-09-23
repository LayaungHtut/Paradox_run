import { IN_RIGHT } from '../core/constants';
import type { RunSession } from '../run/session';
import { idle, runTo, wait, waitFor, waitUntil, type LoopScript } from './bot';

/**
 * A known-good timeline for every campaign level, expressed as closed-loop scripts (one per loop).
 * Coordinates are world units (16 per tile) in unmirrored level space.
 */
export const SOLUTIONS: Record<string, LoopScript[]> = {
	'first-echo': [
		// loop 1: reach the plate and stand on it until the loop collapses
		function* (s) {
			yield* runTo(s, 540, { jumps: [120, 215, 340] });
			yield* idle();
		},
		// loop 2: the echo holds the plate; walk through the open gate
		function* (s) {
			yield* runTo(s, 900, { jumps: [120, 215, 340] });
		}
	],
	relay: [
		// loop 1: jump the gap, climb to the relay, trip it, rewind
		function* (s) {
			yield* runTo(s, 52, { jumps: [372, 222, 192, 142] });
			return 'rewind';
		},
		// loop 2: go straight to the gate; the echo trips the relay while we wait there
		function* (s) {
			yield* runTo(s, 620, { jumps: [455] });
			yield* waitUntil(s, 1);
			while (!s.world.doors[0].open) yield 0;
			yield* runTo(s, 830);
		}
	],
	overdrive: [
		// loop 1: stand on the plate that raises the stepping stone, then rewind
		function* (s) {
			yield* runTo(s, 168);
			yield* waitUntil(s, 400);
			return 'rewind';
		},
		// loop 2: jump-dash onto the stone the echo raised, then jump-dash to the far side
		function* (s) {
			yield* waitFor(s, () => s.world.lifts[0].y <= s.level.lifts[0].y - 48, IN_RIGHT);
			yield* runTo(s, 660, { jumps: [304, 434], dashes: [332, 462] });
		}
	],
	counterweight: [
		// loop 1: walk to the plate, hold it a while, rewind
		function* (s) {
			yield* runTo(s, 70);
			yield* waitUntil(s, 420);
			return 'rewind';
		},
		// loop 2: wait on the lift while the echo weighs the plate, ride up, run to the exit
		function* (s) {
			yield* runTo(s, 395);
			while (s.world.lifts[0].y > s.level.lifts[0].y - 112) yield 0;
			yield* runTo(s, 710, { jumps: [505] });
		}
	],
	decoy: [
		// loop 1: sprint into the Warden's room and get shot — this loop becomes the decoy
		function* (s) {
			yield* runTo(s, 780, { jumps: [270] });
		},
		// loop 2: let the echo walk in first, then cross while the Warden reloads
		function* (s) {
			yield* wait(40);
			yield* runTo(s, 755, { jumps: [270] });
		}
	],
	'two-of-me': [
		// loop 1: hold the lift plate
		function* (s) {
			yield* runTo(s, 55);
			yield* waitUntil(s, 600);
			return 'rewind';
		},
		// loop 2: ride the lift, then hold the gate plate
		function* (s) {
			yield* runTo(s, 395);
			while (s.world.lifts[0].y > s.level.lifts[0].y - 128) yield 0;
			yield* runTo(s, 485);
			yield* waitUntil(s, 480);
			return 'rewind';
		},
		// loop 3: ride with echo 2, walk through the gate it holds open
		function* (s) {
			yield* runTo(s, 395);
			while (s.world.lifts[0].y > s.level.lifts[0].y - 128) yield 0;
			yield* runTo(s, 730);
		}
	],
	crossfire: [
		// loop 1: die in the first Warden room (decoy #1)
		function* (s) {
			yield* runTo(s, 1150, { jumps: [225, 500, 810] });
		},
		// loop 2: trail echo 1 through room 1, die in room 2 (decoy #2)
		function* (s) {
			yield* wait(30);
			yield* runTo(s, 1150, { jumps: [225, 500, 810] });
		},
		// loop 3: trail both echoes through both rooms
		function* (s) {
			yield* wait(55);
			yield* runTo(s, 1170, { jumps: [225, 500, 810] });
		}
	],
	synchrony: [
		// loop 1: climb, cross the bridge (jumping the gap), trip the relay
		function* (s) {
			yield* runTo(s, 740, { jumps: [110, 140, 185, 225, 470] });
			return 'rewind';
		},
		// loop 2: floor route, waiting out each pulsing beam, then wait at the curtain
		function* (s) {
			yield* runTo(s, 322, { jumps: [110, 140, 185] });
			yield* waitFor(s, () => !s.world.laserOn[0] && (s.world.tick + 0) % 150 >= 80);
			yield* runTo(s, 510);
			yield* waitFor(s, () => !s.world.laserOn[1] && (s.world.tick + 40) % 150 >= 80);
			yield* runTo(s, 720);
			yield* waitFor(s, () => !s.world.laserOn[2]);
			yield* runTo(s, 935);
		}
	],
	'paradox-engine': (() => {
		const liftUp = (s: RunSession) => s.world.lifts[0].y <= s.level.lifts[0].y - 128;
		return [
			// loop 1: weigh the lift plate for most of the loop
			function* (s) {
				yield* runTo(s, 55);
				yield* waitUntil(s, 500);
				return 'rewind';
			},
			// loop 2: ride up, walk into the Warden's room — decoy
			function* (s) {
				yield* runTo(s, 290);
				yield* waitFor(s, () => liftUp(s));
				yield* runTo(s, 1300);
			},
			// loop 3: ride, trail the decoy, drop into the sealed chamber and trip the relay
			function* (s) {
				yield* runTo(s, 290);
				yield* waitFor(s, () => liftUp(s));
				yield* wait(30);
				yield* runTo(s, 946);
				return 'rewind';
			},
			// loop 4: ride, trail both, jump the hole, pass the curtain while the trapped echo holds it open
			function* (s) {
				yield* runTo(s, 290);
				yield* waitFor(s, () => liftUp(s));
				yield* wait(50);
				yield* runTo(s, 1350, { jumps: [812] });
			}
		] satisfies LoopScript[];
	})()
};

const liftUp = (s: RunSession, i = 0) =>
	s.world.lifts[i].y <= s.level.lifts[i].y + s.level.lifts[i].dy;

/**
 * Three-star routes: every shard collected and the whole timeline under par. CI replays these so no
 * level ever ships with an unreachable shard or an unbeatable par.
 */
export const PERFECT_SOLUTIONS: Record<string, LoopScript[]> = {
	'first-echo': [
		// detour over the ledge for the shard, then hold the plate
		function* (s) {
			yield* runTo(s, 540, { jumps: [120, 215, 340, 386] });
			yield* waitUntil(s, 560);
			return 'rewind';
		},
		SOLUTIONS['first-echo'][1]
	],
	relay: [
		function* (s) {
			yield* runTo(s, 52, { jumps: [372, 222, 192, 142] });
			yield* runTo(s, 115, { jumps: [76] }); // double back for the shard above the relay
			return 'rewind';
		},
		SOLUTIONS.relay[1]
	],
	overdrive: [
		SOLUTIONS.overdrive[0],
		function* (s) {
			yield* waitFor(s, () => liftUp(s));
			// jump early off the stone so the rise passes through the shard, dash late
			yield* runTo(s, 660, { jumps: [304, 418], dashes: [332, 456] });
		}
	],
	counterweight: SOLUTIONS.counterweight,
	decoy: [
		SOLUTIONS.decoy[0],
		function* (s) {
			yield* wait(40);
			yield* runTo(s, 755, { jumps: [270, 432] });
		}
	],
	'two-of-me': [
		SOLUTIONS['two-of-me'][0],
		SOLUTIONS['two-of-me'][1],
		function* (s) {
			yield* runTo(s, 395);
			yield* waitFor(s, () => liftUp(s));
			yield* runTo(s, 318, { jumps: [392] }); // hop onto the shard ledge from the raised lift
			yield* runTo(s, 730, { jumps: [505] });
		}
	],
	crossfire: [
		SOLUTIONS.crossfire[0],
		SOLUTIONS.crossfire[1],
		function* (s) {
			yield* wait(55);
			yield* runTo(s, 1170, { jumps: [225, 366, 500, 672, 810] });
		}
	],
	synchrony: [
		function* (s) {
			yield* runTo(s, 740, { jumps: [110, 140, 185, 225, 354, 470] });
			return 'rewind';
		},
		SOLUTIONS.synchrony[1]
	],
	'paradox-engine': [
		SOLUTIONS['paradox-engine'][0],
		SOLUTIONS['paradox-engine'][1],
		SOLUTIONS['paradox-engine'][2],
		function* (s) {
			yield* runTo(s, 290);
			yield* waitFor(s, () => liftUp(s));
			yield* wait(50);
			yield* runTo(s, 1350, { jumps: [641, 809] });
		}
	]
};
