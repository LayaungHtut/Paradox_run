import { TICK_MS } from '../core/constants';
import { parseLevel, type LevelData } from '../levels/parse';
import type { LevelDef } from '../levels/types';
import { Renderer, type FrameState, type GhostView } from '../render/renderer';
import { playScripts } from '../testing/bot';
import { SOLUTIONS } from '../testing/solutions';
import { World } from '../sim/world';

/**
 * Title-screen attract mode: replays the winning loop of a real solved timeline, echoes included,
 * so a first-time visitor sees the core idea before reading a word.
 */
export class AttractPlayer {
	private renderer: Renderer;
	private level: LevelData;
	private finalInputs: Uint8Array;
	private ghostInputs: Uint8Array[];
	private ghostViews: GhostView[];
	private world!: World;
	private raf = 0;
	private last = 0;
	private acc = 0;
	private time = 0;
	private hold = 0;
	private resizeObs: ResizeObserver | null = null;

	constructor(
		private canvas: HTMLCanvasElement,
		def: LevelDef
	) {
		this.level = parseLevel(def);
		const { session } = playScripts(def, SOLUTIONS[def.id]);
		const loops = session.loops.map((l) => l.inputs);
		this.finalInputs = loops[loops.length - 1];
		const first = Math.max(0, loops.length - 1 - def.maxGhosts);
		this.ghostInputs = loops.slice(first, -1);
		this.ghostViews = this.ghostInputs.map((g, i) => ({
			label: first + i + 1,
			desync: false,
			endTick: g.length
		}));
		this.renderer = new Renderer(canvas);
		this.renderer.particles.budget = 0.5;
		this.renderer.setLevel(this.level);
		this.reset();
	}

	private reset(): void {
		this.world = new World(this.level, this.ghostInputs);
		this.renderer.resetLoop(this.world);
		this.hold = 0;
	}

	start(): void {
		const parent = this.canvas.parentElement!;
		this.resizeObs = new ResizeObserver(() => this.resize());
		this.resizeObs.observe(parent);
		this.resize();
		this.last = performance.now();
		this.raf = requestAnimationFrame(this.frame);
	}

	stop(): void {
		cancelAnimationFrame(this.raf);
		this.resizeObs?.disconnect();
	}

	private resize(): void {
		const p = this.canvas.parentElement!;
		this.canvas.style.width = `${p.clientWidth}px`;
		this.canvas.style.height = `${p.clientHeight}px`;
		this.renderer.resize(
			p.clientWidth,
			p.clientHeight,
			Math.min(window.devicePixelRatio || 1, 1.5)
		);
	}

	private frame = (now: number): void => {
		this.raf = requestAnimationFrame(this.frame);
		const dt = Math.min(0.1, (now - this.last) / 1000);
		this.last = now;
		this.time += dt;
		const w = this.world;
		const finished = w.exitReached || w.tick >= this.finalInputs.length;
		if (finished) {
			this.hold += dt;
			if (this.hold > 1.5) this.reset();
		} else {
			this.acc += dt * 1000;
			while (this.acc >= TICK_MS && w.tick < this.finalInputs.length && !w.exitReached) {
				this.acc -= TICK_MS;
				w.step(this.finalInputs[w.tick]);
				w.events.clear();
			}
		}
		const alpha = finished ? 1 : this.acc / TICK_MS;
		this.renderer.followBody(w.player, alpha, dt);
		const f: FrameState = {
			world: this.world,
			alpha,
			time: this.time,
			dt,
			ghosts: this.ghostViews,
			loopLimit: this.level.def.loopSeconds * 60,
			hidePlayer: false,
			rewind: null,
			rival: null,
			flash: 0,
			fade: finished ? Math.min(1, this.hold / 1.5) : 0,
			showLoopBar: false
		};
		this.renderer.render(f);
	};
}
