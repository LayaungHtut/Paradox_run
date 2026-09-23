import { audio } from '../audio/audio';
import { TICK_MS, TICK_RATE } from '../core/constants';
import { InputManager } from '../input/input';
import type { LevelData } from '../levels/parse';
import { PC } from '../render/palette';
import { Renderer, type FrameState, type GhostView, type RewindView } from '../render/renderer';
import { RunSession, type LoopEnd, type RunResult, type Timeline } from '../run/session';
import { DeathCause } from '../sim/body';
import { Ev } from '../sim/events';
import type { RivalReplay } from './rival';

/*
 * Browser-side game driver. Owns the requestAnimationFrame loop and a fixed-step accumulator, feeds
 * sampled input into the pure RunSession, turns SimEvents into sound/particles, and runs the short
 * cinematic phases between loops (death → rewind → echo spawn). Svelte only receives a HUD snapshot
 * ~10×/s and discrete callbacks; it never runs per frame.
 */

export type Phase = 'ready' | 'playing' | 'dying' | 'rewinding' | 'complete' | 'paused';

/** Notable moments the UI turns into one-time hints and achievements. */
export type HintKey = 'firstEcho' | 'holdPlate' | 'desync' | 'decoy';

export interface HudSnapshot {
	phase: Phase;
	loop: number;
	loopTimeLeft: number;
	totalTime: number;
	shards: number;
	shardTotal: number;
	echoes: number;
	maxEchoes: number;
	rivalName: string | null;
	rivalTime: number | null;
}

export interface ControllerSettings {
	screenShake: boolean;
	haptics: boolean;
	reducedEffects: boolean;
	reducedFlashing: boolean;
}

export interface ControllerOptions {
	level: LevelData;
	settings: ControllerSettings;
	rival?: RivalReplay | null;
	onHud(s: HudSnapshot): void;
	onComplete(result: RunResult, timeline: Timeline): void;
	onLoopEnd?(end: LoopEnd, loop: number): void;
	onHint?(key: HintKey): void;
	onFps?(fps: number): void;
}

// Loop transitions are deliberately short: failure should cost about a second, never more.
const DYING_S = 0.3;
const REWIND_S = 0.55;
/** a fresh jump/dash press after this long skips the rest of the death/rewind cinematic */
const SKIP_AFTER_S = 0.12;
const COMPLETE_S = 1.3;
const MAX_STEPS_PER_FRAME = 5;

export class GameController {
	readonly session: RunSession;
	readonly renderer: Renderer;
	readonly input: InputManager;
	private phase: Phase = 'ready';
	private pausedPhase: Phase = 'ready';
	private phaseTime = 0;
	private raf = 0;
	private last = 0;
	private acc = 0;
	private time = 0;
	private flash = 0;
	private path: Float32Array;
	private pathCount = 0;
	private rewindView: RewindView;
	private ghostViews: GhostView[] = [];
	private hudTimer = 0;
	private fpsFrames = 0;
	private fpsTime = 0;
	/** adaptive quality: rolling count of slow frames */
	private slowFrames = 0;
	private qualitySteps = 0;
	private plateStandTicks = 0;
	private pendingEnd: LoopEnd | null = null;
	private destroyed = false;
	/** seconds of frozen frame after a death (hit-stop) */
	private hitStop = 0;
	/** last countdown second announced with a tick */
	private lastTickSecond = -1;
	private resizeObserver: ResizeObserver | null = null;

	constructor(
		private canvas: HTMLCanvasElement,
		private opts: ControllerOptions
	) {
		this.session = new RunSession(opts.level);
		this.renderer = new Renderer(canvas);
		this.renderer.reducedMotion = !opts.settings.screenShake;
		this.renderer.reducedFlashing = opts.settings.reducedFlashing;
		this.renderer.particles.budget = opts.settings.reducedEffects ? 0.4 : 1;
		this.renderer.setLevel(opts.level);
		this.input = new InputManager({
			onRewind: () => this.requestRewind(),
			onPause: () => this.togglePause()
		});
		this.path = new Float32Array((this.session.loopLimit + 2) * 2);
		this.rewindView = { path: this.path, count: 0, t: 0 };
		this.beginLoop(false);
	}

	start(): void {
		this.input.attachKeyboard(window);
		const parent = this.canvas.parentElement!;
		this.input.attachTouch(parent, () => {
			const w = parent.clientWidth;
			return { splitX: w * 0.42, padCenterX: Math.min(150, w * 0.17) };
		});
		this.resizeObserver = new ResizeObserver(() => this.resize());
		this.resizeObserver.observe(parent);
		this.resize();
		this.last = performance.now();
		this.raf = requestAnimationFrame(this.frame);
	}

	destroy(): void {
		this.destroyed = true;
		cancelAnimationFrame(this.raf);
		this.input.detach();
		this.resizeObserver?.disconnect();
		audio.intensity = 0;
	}

	get currentPhase(): Phase {
		return this.phase;
	}

	togglePause(): void {
		if (this.phase === 'complete') return;
		if (this.phase === 'paused') this.resume();
		else this.pause();
	}

	pause(): void {
		if (this.phase === 'paused' || this.phase === 'complete') return;
		this.pausedPhase = this.phase;
		this.phase = 'paused';
		this.input.releaseAll();
		this.pushHud();
	}

	resume(): void {
		if (this.phase !== 'paused') return;
		this.phase = this.pausedPhase;
		this.last = performance.now();
		this.acc = 0;
		this.pushHud();
	}

	/** Player-initiated: end this loop now and hand it to the next loop as an echo. */
	requestRewind(): void {
		if (this.phase !== 'playing' || this.session.world.tick < 10) return;
		this.session.rewind();
		this.onLoopFinished('rewind');
	}

	resize(): void {
		const parent = this.canvas.parentElement!;
		const w = parent.clientWidth;
		const h = parent.clientHeight;
		this.canvas.style.width = `${w}px`;
		this.canvas.style.height = `${h}px`;
		this.renderer.resize(w, h, window.devicePixelRatio || 1);
		// on touch screens the bottom ~quarter is under thumbs: let the camera sink so the floor sits above them
		const touch = matchMedia('(pointer: coarse)').matches;
		this.renderer.camera.bottomPad = touch ? this.renderer.camera.viewH * 0.24 : 0;
		this.renderer.camera.snap(
			this.session.world.player.cx,
			this.session.world.player.cy,
			this.opts.level.width,
			this.opts.level.height
		);
		this.draw(0, 1);
	}

	// ─── main loop ───────────────────────────────────────────────────────────

	private frame = (now: number): void => {
		if (this.destroyed) return;
		this.raf = requestAnimationFrame(this.frame);
		const dt = Math.min(0.1, (now - this.last) / 1000);
		this.last = now;
		if (this.phase === 'paused') return;
		if (this.hitStop > 0) {
			// a few frames of total stillness on death: the impact lands before anything moves
			this.hitStop -= dt;
			this.draw(0, 1);
			return;
		}
		this.time += dt;
		this.phaseTime += dt;
		this.flash = Math.max(0, this.flash - dt * 4);

		switch (this.phase) {
			case 'ready':
				// time is frozen until the player moves — then the loop (and every echo) starts together
				if (this.input.anyHeld) this.setPhase('playing');
				else this.input.sample(); // discard stray latches
				this.acc = 0;
				break;
			case 'playing':
				this.stepSim(dt);
				break;
			case 'dying':
				if (this.skipRequested()) this.beginLoop(true);
				else if (this.phaseTime >= DYING_S) this.setPhase('rewinding');
				break;
			case 'rewinding':
				this.rewindView.t = Math.min(1, this.phaseTime / REWIND_S);
				if (this.phaseTime >= REWIND_S || this.skipRequested()) this.beginLoop(true);
				break;
			case 'complete':
				if (this.phaseTime >= COMPLETE_S && this.pendingEnd === 'exit') {
					this.pendingEnd = null;
					const result = this.session.getResult();
					if (result) this.opts.onComplete(result, this.session.toTimeline());
				}
				break;
		}

		const alpha = this.phase === 'playing' ? this.acc / TICK_MS : 1;
		this.draw(dt, alpha);

		this.hudTimer += dt;
		if (this.hudTimer >= 0.1) {
			this.hudTimer = 0;
			this.pushHud();
		}
		this.adaptQuality(dt);
		this.fpsFrames++;
		this.fpsTime += dt;
		if (this.fpsTime >= 1) {
			this.opts.onFps?.(Math.round(this.fpsFrames / this.fpsTime));
			this.fpsFrames = 0;
			this.fpsTime = 0;
		}
	};

	/**
	 * If frames are persistently slow while playing, step the canvas resolution down (max 3 steps).
	 * It never steps back up, so quality cannot oscillate mid-run.
	 */
	private adaptQuality(dt: number): void {
		if (this.phase !== 'playing' || this.qualitySteps >= 3) return;
		this.slowFrames = dt > 0.021 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 2);
		if (this.slowFrames < 45) return;
		this.slowFrames = 0;
		this.qualitySteps++;
		// step 1: drop decorative layers (cheap to lose, big raster saving); steps 2–3: resolution
		if (this.qualitySteps >= 1) this.renderer.lite = true;
		if (this.qualitySteps >= 2)
			this.renderer.qualityCap = Math.max(0.75, 1.75 - (this.qualitySteps - 1) * 0.4);
		if (this.qualitySteps >= 2)
			this.renderer.particles.budget = Math.min(this.renderer.particles.budget, 0.5);
		console.info(
			`[quality] frames slow — step ${this.qualitySteps}: lite=${this.renderer.lite} cap=${this.renderer.qualityCap}`
		);
		this.resize();
	}

	/** True when the player tapped jump/dash during a transition: they want to play, not watch. */
	private skipRequested(): boolean {
		const pressed = this.input.consumePress();
		return pressed && this.phaseTime >= SKIP_AFTER_S;
	}

	private stepSim(dt: number): void {
		this.acc += dt * 1000;
		let steps = 0;
		while (this.acc >= TICK_MS && this.phase === 'playing') {
			if (++steps > MAX_STEPS_PER_FRAME) {
				this.acc = 0; // too far behind (tab stall): drop time rather than spiral
				break;
			}
			this.acc -= TICK_MS;
			const input = this.input.sample();
			const status = this.session.step(input);
			this.opts.rival?.step();
			const p = this.session.world.player;
			if (this.pathCount * 2 + 1 < this.path.length) {
				this.path[this.pathCount * 2] = p.x;
				this.path[this.pathCount * 2 + 1] = p.y;
				this.pathCount++;
			}
			this.handleEvents();
			this.checkHints();
			if (status === 'loopEnded')
				this.onLoopFinished(this.session.loops[this.session.loops.length - 1].end);
			else if (status === 'complete') this.onComplete();
		}
		const w = this.session.world;
		audio.intensity = Math.min(1, Math.max(0, (w.tick / this.session.loopLimit - 0.45) / 0.5));
		// audible countdown for the final three seconds of the loop
		const secondsLeft = Math.ceil((this.session.loopLimit - w.tick) / TICK_RATE);
		if (this.phase === 'playing' && secondsLeft <= 3 && secondsLeft !== this.lastTickSecond) {
			this.lastTickSecond = secondsLeft;
			if (secondsLeft > 0) audio.play('tick', 1, secondsLeft);
		}
	}

	private beginLoop(afterRewind: boolean): void {
		if (afterRewind) this.session.beginLoop();
		const s = this.session;
		this.opts.rival?.reset();
		this.pathCount = 0;
		this.plateStandTicks = 0;
		this.lastTickSecond = -1;
		this.ghostViews = s.ghostLoops.map((loopIdx) => ({
			label: loopIdx + 1,
			desync: false,
			endTick: s.loops[loopIdx].inputs.length
		}));
		this.renderer.resetLoop(s.world);
		this.setPhase('ready');
		const spawn = s.level.spawn;
		if (s.ghostLoops.length > 0) {
			audio.play('ghostSpawn');
			this.renderer.particles.burst(spawn.x + 5, spawn.y + 7, 40, PC.ghost, 60, 0.9, 1.6);
			this.renderer.fracture(spawn.x + 5, spawn.y + 7);
			this.flash = 0.25;
			if (s.loops.length === 1) this.opts.onHint?.('firstEcho');
		}
		this.pushHud();
	}

	private onLoopFinished(end: LoopEnd): void {
		const loopNo = this.session.loops.length;
		this.opts.onLoopEnd?.(end, loopNo);
		this.rewindView.count = this.pathCount;
		this.rewindView.t = 0;
		if (end === 'death') {
			this.setPhase('dying');
		} else {
			this.flash = 0.35;
			this.setPhase('rewinding');
		}
	}

	private onComplete(): void {
		this.pendingEnd = 'exit';
		this.setPhase('complete');
		audio.play('success');
		audio.intensity = 0;
		const p = this.session.world.player;
		this.renderer.particles.burst(p.cx, p.cy, 70, PC.exit, 110, 1.3, 2);
		this.renderer.particles.burst(p.cx, p.cy, 30, PC.visor, 70, 1, 1.5);
		this.flash = 0.6;
		this.haptic(30);
	}

	private setPhase(p: Phase): void {
		this.phase = p;
		this.phaseTime = 0;
		if (p === 'rewinding') audio.play('rewind');
		this.pushHud();
	}

	// ─── events → feedback ───────────────────────────────────────────────────

	private handleEvents(): void {
		const w = this.session.world;
		const ev = w.events;
		const parts = this.renderer.particles;
		for (let i = 0; i < ev.count; i++) {
			const e = ev.items[i];
			const isPlayer = e.body === 0;
			const isGhost = e.body > 0;
			switch (e.type) {
				case Ev.Jump:
					if (isPlayer) {
						audio.play('jump');
						parts.burst(e.x, e.y, 6, PC.dust, 30, 0.35, 1.3);
					}
					break;
				case Ev.Land:
					if (isPlayer && e.data > 20) {
						const k = Math.min(1, e.data / 55);
						audio.play('land', k);
						parts.burst(e.x, e.y, 4 + Math.round(8 * k), PC.dust, 25 + 30 * k, 0.4, 1.3);
						if (k > 0.8) this.renderer.shake(0.12);
					}
					break;
				case Ev.Dash:
					if (isPlayer) {
						audio.play('dash');
						parts.burst(e.x, e.y, 10, PC.player, 50, 0.35, 1.2);
						this.haptic(8);
					}
					break;
				case Ev.Death:
					if (isPlayer) {
						audio.play('death');
						this.hitStop = 0.07;
						parts.burst(e.x, e.y, 60, PC.player, 140, 0.9, 2.2, 60);
						parts.burst(
							e.x,
							e.y,
							30,
							e.data === DeathCause.Spike ? PC.hazard : PC.visor,
							100,
							0.7,
							1.8,
							40
						);
						this.renderer.shake(0.55);
						this.flash = 0.5;
						this.haptic(60);
					} else {
						// an echo destroyed — often exactly what the player wanted (decoy)
						parts.burst(e.x, e.y, 36, PC.ghost, 90, 0.8, 1.8, 20);
						audio.play('ghostFade');
						if (e.data === DeathCause.Bolt) this.opts.onHint?.('decoy');
					}
					break;
				case Ev.GhostExpire:
					parts.burst(e.x, e.y, 18, PC.ghost, 25, 1.1, 1.4, -25);
					audio.play('ghostFade');
					break;
				case Ev.PlateOn:
					if (isGhost) {
						audio.play('ghostAssist', 1, this.lvlChannel('plate', e.data));
						parts.burst(e.x, e.y, 16, PC.ghost, 40, 0.7, 1.4);
					} else audio.play('plate', 1, this.lvlChannel('plate', e.data));
					break;
				case Ev.PlateOff:
					audio.play('plateOff', 1, this.lvlChannel('plate', e.data));
					break;
				case Ev.RelayOn:
					audio.play(isGhost ? 'ghostAssist' : 'relay', 1, this.lvlChannel('relay', e.data));
					parts.burst(e.x, e.y, 14, isGhost ? PC.ghost : PC.mint, 45, 0.6, 1.4);
					break;
				case Ev.DoorOpen:
				case Ev.DoorClose:
					if (this.nearCamera(e.x, e.y)) audio.play('door');
					break;
				case Ev.Shard:
					audio.play('shard');
					parts.burst(e.x, e.y, 24, PC.shard, 70, 0.8, 1.6);
					this.haptic(12);
					break;
				case Ev.TurretLock:
					if (this.nearCamera(e.x, e.y)) audio.play('lock');
					break;
				case Ev.TurretFire:
					if (this.nearCamera(e.x, e.y)) audio.play('fire');
					break;
				case Ev.BoltHit:
					parts.burst(e.x, e.y, 6, PC.hazard, 40, 0.3, 1.2);
					break;
			}
		}
		ev.clear();
		// desync bookkeeping for rendering
		const ds = this.session.desynced;
		for (let g = 0; g < this.ghostViews.length; g++) {
			if (ds[g + 1] && !this.ghostViews[g].desync) {
				this.ghostViews[g].desync = true;
				this.opts.onHint?.('desync');
			}
		}
	}

	private checkHints(): void {
		const s = this.session;
		const w = s.world;
		// standing alone on a plate: teach that an echo can hold it for you
		let onPlate = false;
		for (let i = 0; i < w.platePressed.length; i++)
			if (w.platePressed[i] && !w.plateGhost[i] && w.plateBy[i] === 0) onPlate = true;
		this.plateStandTicks = onPlate && w.player.onGround ? this.plateStandTicks + 1 : 0;
		if (this.plateStandTicks === TICK_RATE * 2) this.opts.onHint?.('holdPlate');
	}

	private lvlChannel(kind: 'plate' | 'relay', idx: number): number {
		const lvl = this.opts.level;
		return (kind === 'plate' ? lvl.plates[idx]?.ch : lvl.relays[idx]?.ch) ?? 0;
	}

	private nearCamera(x: number, y: number): boolean {
		const c = this.renderer.camera;
		return x > c.x - 40 && x < c.x + c.viewW + 40 && y > c.y - 40 && y < c.y + c.viewH + 40;
	}

	private haptic(ms: number): void {
		if (this.opts.settings.haptics && typeof navigator !== 'undefined' && 'vibrate' in navigator)
			navigator.vibrate(ms);
	}

	// ─── drawing ─────────────────────────────────────────────────────────────

	private frameState: FrameState | null = null;

	private draw(dt: number, alpha: number): void {
		const s = this.session;
		const w = s.world;
		const r = this.renderer;
		const rewinding = this.phase === 'rewinding';
		if (rewinding) {
			const pt = r.rewindPoint(this.rewindView);
			r.followPoint(pt.x, pt.y, dt);
		} else if (this.phase !== 'dying') r.followBody(w.player, alpha, dt);

		const f = (this.frameState ??= {
			world: w,
			alpha,
			time: 0,
			dt: 0,
			ghosts: this.ghostViews,
			loopLimit: s.loopLimit,
			hidePlayer: false,
			rewind: null,
			rival: null,
			flash: 0,
			fade: 0
		});
		f.world = w;
		f.alpha = alpha;
		f.time = this.time;
		f.dt = dt;
		f.ghosts = this.ghostViews;
		f.hidePlayer = this.phase === 'dying';
		f.rewind = rewinding ? this.rewindView : null;
		f.rival = this.opts.rival?.body ?? null;
		f.rivalLabel = this.opts.rival?.label;
		f.flash = this.flash;
		f.fade =
			this.phase === 'complete'
				? Math.max(0, (this.phaseTime - 0.6) / (COMPLETE_S - 0.6)) * 0.85
				: 0;
		r.render(f);
	}

	private pushHud(): void {
		const s = this.session;
		const w = s.world;
		const running =
			this.phase === 'playing' ||
			this.phase === 'ready' ||
			(this.phase === 'paused' && this.pausedPhase === 'playing');
		this.opts.onHud({
			phase: this.phase,
			loop: s.loops.length + (s.status === 'running' ? 1 : 0),
			loopTimeLeft: running ? (s.loopLimit - w.tick) / TICK_RATE : 0,
			totalTime: s.totalTicks / TICK_RATE,
			shards: s.shardsCollected,
			shardTotal: s.level.shards.length,
			echoes: s.ghostLoops.length,
			maxEchoes: s.maxGhosts,
			rivalName: this.opts.rival?.name ?? null,
			rivalTime: this.opts.rival ? this.opts.rival.totalTicks / TICK_RATE : null
		});
	}
}
