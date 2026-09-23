import { LIMITS, SIM_VERSION, TICK_RATE } from '../core/constants';
import type { LevelData } from '../levels/parse';
import { decodeInputs, encodeInputs, InputRecorder } from '../replay/codec';
import { World } from '../sim/world';
import { computeScore, computeStars, popcount, type ScoreBreakdown } from './scoring';

export type LoopEnd = 'death' | 'rewind' | 'timeout' | 'exit';

export interface LoopRecord {
	inputs: Uint8Array;
	end: LoopEnd;
	/** player position every SAMPLE_EVERY ticks — in-memory only, used to detect ghost desync */
	samples: Float32Array;
}

export interface RunResult {
	levelId: string;
	mirrored: boolean;
	totalTicks: number;
	loops: number;
	deaths: number;
	shards: number;
	shardTotal: number;
	syncs: number;
	score: ScoreBreakdown;
	stars: number;
}

/** Serializable form of a whole run: what gets stored locally and submitted for verification. */
export interface Timeline {
	v: number;
	level: string;
	/** level content version (see levelVersion) */
	lv: string;
	mirror: boolean;
	loops: string[];
	ends: LoopEnd[];
}

export type SessionStatus = 'running' | 'loopEnded' | 'complete';

const SAMPLE_EVERY = 6;
const DESYNC_DIST = 6;

/**
 * A run through one level: a sequence of loops. Every finished loop becomes a ghost in the following
 * loops (up to the level's ghost capacity). Pure and DOM-free — the browser plays it live and the
 * server re-plays submitted timelines through it.
 */
export class RunSession {
	readonly loops: LoopRecord[] = [];
	world!: World;
	status: SessionStatus = 'running';
	/** loop indices that are replaying as ghosts in the current loop (ghost body id = position + 1) */
	ghostLoops: number[] = [];
	/** per ghost body id: has it diverged from its recording? */
	desynced: boolean[] = [];
	readonly loopLimit: number;
	readonly maxGhosts: number;
	private completedTicks = 0;
	private shards: Uint8Array;
	private recorder = new InputRecorder();
	private samples = new Float32Array(2 * Math.ceil(LIMITS.maxTicksPerLoop / SAMPLE_EVERY + 2));
	private sampleCount = 0;
	private result: RunResult | null = null;

	constructor(readonly level: LevelData) {
		this.loopLimit = Math.min(level.def.loopSeconds * TICK_RATE, LIMITS.maxTicksPerLoop);
		this.maxGhosts = level.def.maxGhosts;
		this.shards = new Uint8Array(level.shards.length);
		this.beginLoop();
	}

	get loopIndex(): number {
		return this.loops.length;
	}

	get totalTicks(): number {
		return this.completedTicks + (this.status === 'running' ? this.world.tick : 0);
	}

	get deaths(): number {
		let d = 0;
		for (const l of this.loops) if (l.end === 'death') d++;
		return d;
	}

	get shardsCollected(): number {
		let n = 0;
		for (const s of this.world.shardTaken) n += s;
		return n;
	}

	beginLoop(): void {
		const first = Math.max(0, this.loops.length - this.maxGhosts);
		this.ghostLoops = [];
		for (let i = first; i < this.loops.length; i++) this.ghostLoops.push(i);
		this.world = new World(
			this.level,
			this.ghostLoops.map((i) => this.loops[i].inputs),
			this.shards
		);
		this.desynced = new Array(this.ghostLoops.length + 1).fill(false);
		this.recorder.reset();
		this.sampleCount = 0;
		this.status = 'running';
		this.sample();
	}

	/** Advance the current loop by one tick with the given player input. */
	step(input: number): SessionStatus {
		if (this.status !== 'running') return this.status;
		this.recorder.push(input);
		this.world.step(input);
		const w = this.world;
		if (w.tick % SAMPLE_EVERY === 0) {
			this.checkDesync();
			this.sample();
		}
		if (w.exitReached) this.finishLoop('exit');
		else if (!w.player.alive) this.finishLoop('death');
		else if (w.tick >= this.loopLimit) this.finishLoop('timeout');
		return this.status;
	}

	/** Voluntarily end the loop now — the player becomes a ghost from this exact moment. */
	rewind(): void {
		if (this.status !== 'running' || this.world.tick === 0) return;
		this.finishLoop('rewind');
	}

	getResult(): RunResult | null {
		return this.result;
	}

	toTimeline(): Timeline {
		return {
			v: SIM_VERSION,
			level: this.level.def.id,
			lv: this.level.version,
			mirror: this.level.mirrored,
			loops: this.loops.map((l) => encodeInputs(l.inputs)),
			ends: this.loops.map((l) => l.end)
		};
	}

	private finishLoop(end: LoopEnd): void {
		const w = this.world;
		this.shards = w.shardTaken.slice();
		const rec: LoopRecord = {
			inputs: this.recorder.snapshot(),
			end,
			samples: this.samples.slice(0, this.sampleCount * 2)
		};
		this.completedTicks += w.tick;
		this.loops.push(rec);
		if (end === 'exit') {
			this.status = 'complete';
			const shards = this.shards.reduce((a, b) => a + b, 0);
			const deaths = this.deaths;
			const syncs = popcount(w.assistMask);
			this.result = {
				levelId: this.level.def.id,
				mirrored: this.level.mirrored,
				totalTicks: this.completedTicks,
				loops: this.loops.length,
				deaths,
				shards,
				shardTotal: this.level.shards.length,
				syncs,
				score: computeScore({
					totalTicks: this.completedTicks,
					parSeconds: this.level.def.parSeconds,
					shards,
					syncs,
					deaths
				}),
				stars: computeStars(
					this.completedTicks,
					this.level.def.parSeconds,
					shards,
					this.level.shards.length
				)
			};
		} else {
			this.status = 'loopEnded';
		}
	}

	private sample(): void {
		const p = this.world.player;
		if (this.sampleCount * 2 + 1 >= this.samples.length) return;
		this.samples[this.sampleCount * 2] = p.x;
		this.samples[this.sampleCount * 2 + 1] = p.y;
		this.sampleCount++;
	}

	private checkDesync(): void {
		const w = this.world;
		const k = w.tick / SAMPLE_EVERY;
		for (let g = 0; g < this.ghostLoops.length; g++) {
			const body = w.bodies[g + 1];
			if (!body.alive || this.desynced[g + 1]) continue;
			const s = this.loops[this.ghostLoops[g]].samples;
			if (k * 2 + 1 >= s.length) continue;
			if (
				Math.abs(body.x - s[k * 2]) > DESYNC_DIST ||
				Math.abs(body.y - s[k * 2 + 1]) > DESYNC_DIST
			)
				this.desynced[g + 1] = true;
		}
	}
}

export class TimelineInvalid extends Error {}

/**
 * Re-simulate a submitted timeline from scratch and return the authoritative result.
 * Every non-final loop must end exactly where it claims to; the final loop must reach the exit on its
 * last recorded tick. Anything else is rejected.
 */
export function verifyTimeline(level: LevelData, t: Timeline): RunResult {
	if (t.v !== SIM_VERSION) throw new TimelineInvalid('sim version mismatch');
	if (t.level !== level.def.id || t.mirror !== level.mirrored)
		throw new TimelineInvalid('level mismatch');
	if (t.lv !== level.version)
		throw new TimelineInvalid('recorded on an older version of this level');
	if (!Array.isArray(t.loops) || t.loops.length === 0 || t.loops.length > LIMITS.maxLoopsPerRun)
		throw new TimelineInvalid('bad loop count');
	if (!Array.isArray(t.ends) || t.ends.length !== t.loops.length)
		throw new TimelineInvalid('bad loop ends');

	const session = new RunSession(level);
	for (let i = 0; i < t.loops.length; i++) {
		const inputs = decodeInputs(t.loops[i], session.loopLimit);
		const claimed = t.ends[i];
		const last = i === t.loops.length - 1;
		if (last !== (claimed === 'exit'))
			throw new TimelineInvalid(`loop ${i}: exit must be the final loop`);
		for (let k = 0; k < inputs.length; k++) {
			if (session.status !== 'running')
				throw new TimelineInvalid(`loop ${i}: ended early at tick ${k}`);
			session.step(inputs[k]);
		}
		if (claimed === 'rewind') session.rewind();
		const ended = session.loops[session.loops.length - 1];
		if (
			session.status === 'running' ||
			!ended ||
			ended.end !== claimed ||
			session.loops.length !== i + 1
		)
			throw new TimelineInvalid(`loop ${i}: expected ${claimed}`);
		if (!last) session.beginLoop();
	}
	const result = session.getResult();
	if (!result) throw new TimelineInvalid('run did not complete');
	return result;
}
