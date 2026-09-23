import { IN_DASH, IN_JUMP, IN_LEFT, IN_RIGHT } from '../core/constants';
import { parseLevel } from '../levels/parse';
import type { LevelDef } from '../levels/types';
import { RunSession } from '../run/session';
import type { Body } from '../sim/body';

/*
 * Closed-loop scripted players. A script is a generator that yields one input bitmask per tick and
 * reads the live simulation to decide what to press — exactly like a human, so the resulting input
 * recording is an ordinary, verifiable timeline. Used to prove every level is solvable.
 */

export type LoopScript = (s: RunSession) => Generator<number, 'rewind' | void, void>;

const player = (s: RunSession): Body => s.world.player;

/** Player x in the level's unmirrored ("logical") coordinates, so scripts work on mirrored variants. */
export const logicalX = (s: RunSession): number => {
	const p = player(s);
	return s.level.mirrored ? s.level.width - p.x - p.w : p.x;
};

export function* wait(ticks: number): Generator<number, void, void> {
	for (let i = 0; i < ticks; i++) yield 0;
}

export function* waitUntil(s: RunSession, tick: number): Generator<number, void, void> {
	while (s.world.tick < tick) yield 0;
}

export function* hold(input: number, ticks: number): Generator<number, void, void> {
	for (let i = 0; i < ticks; i++) yield input;
}

/**
 * Run horizontally until the player's left edge passes `x`. Jumps (holding for `jumpHold` ticks)
 * whenever the player crosses one of `jumpXs` while grounded; dashes at `dashXs`.
 */
export function* runTo(
	s: RunSession,
	x: number,
	opts: { jumps?: number[]; dashes?: number[]; jumpHold?: number } = {}
): Generator<number, void, void> {
	const jumps = [...(opts.jumps ?? [])];
	const dashes = [...(opts.dashes ?? [])];
	const hold = opts.jumpHold ?? 14;
	let jumpLeft = 0;
	const right = x > logicalX(s);
	const dir = right ? IN_RIGHT : IN_LEFT;
	const passed = (px: number, t: number) => (right ? px >= t : px <= t);
	let guard = 0;
	while (!passed(logicalX(s), x)) {
		if (++guard > 3000)
			throw new Error(`runTo(${x}) stuck at ${logicalX(s)} (loop ${s.loopIndex})`);
		const p = player(s);
		const px = logicalX(s);
		let input = dir;
		if (!p.alive) return;
		if (jumps.length && passed(px, jumps[0]) && (p.onGround || p.coyote > 0)) {
			jumps.shift();
			jumpLeft = hold;
		}
		if (jumpLeft > 0) {
			input |= IN_JUMP;
			jumpLeft--;
		}
		if (dashes.length && passed(px, dashes[0])) {
			dashes.shift();
			input |= IN_DASH;
		}
		yield input;
	}
}

/** Stand still until a predicate holds. */
export function* waitFor(
	s: RunSession,
	pred: () => boolean,
	input = 0
): Generator<number, void, void> {
	let guard = 0;
	while (!pred()) {
		if (++guard > 4000) throw new Error('waitFor timed out');
		yield input;
	}
}

/** Idle until the loop runs out (timeout). */
export function* idle(): Generator<number, void, void> {
	for (;;) yield 0;
}

export interface BotRun {
	session: RunSession;
	/** status after each scripted loop */
	ends: string[];
}

/** Play a level with one script per loop. Returns the session (complete if the final loop exits). */
export function playScripts(def: LevelDef, scripts: LoopScript[], mirror = false): BotRun {
	const session = new RunSession(parseLevel(def, mirror));
	const ends: string[] = [];
	scripts.forEach((script, i) => {
		const gen = script(session);
		for (;;) {
			const r = gen.next();
			if (r.done) {
				if (r.value === 'rewind') session.rewind();
				else while (session.status === 'running') session.step(0);
				break;
			}
			// mirrored levels swap left/right so the same script works
			let input = r.value;
			if (mirror)
				input =
					(input & ~(IN_LEFT | IN_RIGHT)) |
					(input & IN_LEFT ? IN_RIGHT : 0) |
					(input & IN_RIGHT ? IN_LEFT : 0);
			if (session.step(input) !== 'running') break;
		}
		ends.push(session.status === 'complete' ? 'exit' : session.loops[session.loops.length - 1].end);
		if (session.status === 'loopEnded' && i < scripts.length - 1) session.beginLoop();
	});
	return { session, ends };
}
