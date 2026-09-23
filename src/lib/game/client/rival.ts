import type { LevelData } from '../levels/parse';
import { decodeInputs } from '../replay/codec';
import type { Timeline } from '../run/session';
import type { Body } from '../sim/body';
import { World } from '../sim/world';

/**
 * "Beat this ghost": replays another player's winning loop — including the echoes that helped them —
 * in a private shadow world that runs in lockstep with the current loop. Only their runner is drawn,
 * and it cannot touch the player's world.
 */
export class RivalReplay {
	private finalInputs: Uint8Array;
	private helperInputs: Uint8Array[];
	private world: World;
	readonly totalTicks: number;
	readonly name: string;

	constructor(
		private level: LevelData,
		timeline: Timeline,
		name: string,
		totalTicks: number
	) {
		const loops = timeline.loops.map((l) => decodeInputs(l));
		this.finalInputs = loops[loops.length - 1];
		const helpers = loops.slice(0, -1);
		this.helperInputs = helpers.slice(Math.max(0, helpers.length - level.def.maxGhosts));
		this.world = new World(level, this.helperInputs);
		this.totalTicks = totalTicks;
		this.name = name;
	}

	reset(): void {
		this.world = new World(this.level, this.helperInputs);
	}

	step(): void {
		const w = this.world;
		if (w.exitReached || !w.player.alive || w.tick >= this.finalInputs.length) return;
		w.step(this.finalInputs[w.tick]);
	}

	/** short tag drawn above the ghost */
	get label(): string {
		return this.name.length > 10 ? `${this.name.slice(0, 9)}…` : this.name;
	}

	/** The rival's runner, or null once they have finished / left the loop. */
	get body(): Body | null {
		const w = this.world;
		return w.exitReached || !w.player.alive || w.tick >= this.finalInputs.length ? null : w.player;
	}
}
