import { TILE } from '../core/constants';
import { CAMPAIGN } from '../levels/campaign';
import type { LevelData } from '../levels/parse';
import type { Body } from '../sim/body';
import type { World } from '../sim/world';
import { ActorLayer, rewindPoint, type GhostView, type RewindView } from './actors';
import { Background } from './background';
import { Camera } from './camera';
import type { DrawContext } from './draw-context';
import { buildGeometry, type LevelGeometry } from './geometry';
import { drawBolts, MechanismLayer } from './mechanisms';
import { OverlayLayer, type LoopBarRect } from './overlays';
import { THEMES, type Theme } from './palette';
import { Particles } from './particles';
import { drawTiles, makePanelPattern } from './tiles';

export type { GhostView, RewindView };

/*
 * Frame orchestrator. Owns the canvas, camera and particle pool, and draws the layers in order:
 *   background (screen/parallax) → tiles → mechanisms → actors → bolts → particles → fractures
 *   → screen overlays (vignette, rewind, flash, loop bar, fade)
 * Each layer lives in its own module; this file only sequences them and handles sizing.
 */

export interface FrameState {
	world: World;
	alpha: number;
	time: number;
	dt: number;
	ghosts: GhostView[];
	loopLimit: number;
	hidePlayer: boolean;
	rewind: RewindView | null;
	rival: Body | null;
	/** tag shown above the rival ghost ("BEST" or a player name) */
	rivalLabel?: string;
	/** 0..1 full-screen flash */
	flash: number;
	/** 0..1 fade to dark (level complete / transitions) */
	fade: number;
	/** draw the loop timeline bar (off for attract mode) */
	showLoopBar?: boolean;
}

const VIEW_TILES_H = 12;
const MIN_TILES_W = 20;
const MIN_TILES_W_PORTRAIT = 16;
/** max canvas pixels (≈0.9 MP) — beyond this, phones spend frame time rasterizing, not playing */
const PIXEL_BUDGET = 900_000;

/** Levels share themes in consecutive pairs; the finale gets the paradox-core theme. */
export function themeFor(levelId: string): Theme {
	const i = CAMPAIGN.findIndex((l) => l.id === levelId);
	if (i < 0) return THEMES[0];
	return THEMES[Math.min(THEMES.length - 1, Math.floor((i * THEMES.length) / CAMPAIGN.length))];
}

export class Renderer {
	readonly ctx: CanvasRenderingContext2D;
	readonly camera = new Camera();
	readonly particles = new Particles();
	private geo!: LevelGeometry;
	private level!: LevelData;
	private theme: Theme = THEMES[0];
	private background = new Background();
	private mechanisms = new MechanismLayer();
	private actors = new ActorLayer();
	private overlays = new OverlayLayer();
	private panel: CanvasPattern | null = null;
	private dpr = 1;
	/** device pixels per world unit */
	private scale = 1;
	private dc: DrawContext | null = null;
	reducedMotion = false;
	/** dim full-screen flashes (accessibility setting) */
	reducedFlashing = false;
	/** device-pixel-ratio ceiling lowered at runtime by the controller's adaptive quality */
	qualityCap = 2;
	/** skip purely decorative layers (parallax architecture, vignette) on struggling devices */
	lite = false;

	constructor(readonly canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext('2d', { alpha: false });
		if (!ctx) throw new Error('Canvas 2D not supported');
		this.ctx = ctx;
		polyfillRoundRect(ctx);
	}

	setLevel(level: LevelData): void {
		this.level = level;
		this.theme = themeFor(level.def.id);
		this.geo = buildGeometry(level);
		this.particles.clear();
		this.overlays.clear();
		this.camera.snap(level.spawn.x, level.spawn.y, level.width, level.height);
	}

	/** Reset per-loop cosmetic state (trails, gate animation) — call when a new loop begins. */
	resetLoop(world: World): void {
		this.actors.reset(world);
		this.mechanisms.reset(this.level, world);
	}

	resize(cssW: number, cssH: number, dpr: number): void {
		const budget = Math.sqrt(PIXEL_BUDGET / Math.max(1, cssW * cssH));
		this.dpr = Math.max(0.75, Math.min(dpr, 2, budget, this.qualityCap));
		this.canvas.width = Math.round(cssW * this.dpr);
		this.canvas.height = Math.round(cssH * this.dpr);
		// fit ~12 tiles vertically (big, readable sprites on phones), but never fewer than 20 horizontally
		// (16 on portrait screens: every level fits vertically there, so trade width for sprite size)
		const minTilesW = cssW < cssH ? MIN_TILES_W_PORTRAIT : MIN_TILES_W;
		this.scale = Math.min(
			this.canvas.height / (VIEW_TILES_H * TILE),
			this.canvas.width / (minTilesW * TILE)
		);
		this.camera.viewW = this.canvas.width / this.scale;
		this.camera.viewH = this.canvas.height / this.scale;
		this.panel = makePanelPattern(this.ctx);
		this.background.build(this.level, this.camera.viewW, this.camera.viewH);
		this.background.resize(this.ctx, this.theme, this.canvas.height);
		this.overlays.resize(this.ctx, this.dpr, cssW);
	}

	/** Place the loop timeline bar (CSS px, canvas-relative); null restores the default spot. */
	setLoopBar(rect: LoopBarRect | null): void {
		this.overlays.loopBar = rect;
	}

	get pixelsPerUnit(): number {
		return this.scale / this.dpr;
	}

	/** Echoes materialising at a world position (loop start). */
	fracture(x: number, y: number): void {
		if (!this.reducedMotion) this.overlays.fracture(x, y);
	}

	render(f: FrameState): void {
		const ctx = this.ctx;
		const cam = this.camera;
		this.particles.update(f.dt);
		cam.updateShake(f.dt, f.time);

		this.background.draw(ctx, cam, this.theme, this.scale, f.time, this.lite);

		const ox = Math.round((cam.x + cam.shakeX) * this.scale) / this.scale;
		const oy = Math.round((cam.y + cam.shakeY) * this.scale) / this.scale;
		ctx.setTransform(this.scale, 0, 0, this.scale, -ox * this.scale, -oy * this.scale);

		const d = this.drawContext(f);
		drawTiles(d, this.geo, this.panel);
		this.mechanisms.drawBehindActors(d);
		this.actors.draw(d, f.ghosts, f.rival, f.rivalLabel ?? 'BEST', f.rewind, f.hidePlayer);
		drawBolts(d);
		this.particles.draw(ctx);
		this.overlays.drawWorld(ctx, f.dt);

		this.overlays.drawScreen(ctx, {
			time: f.time,
			lite: this.lite,
			rewind: f.rewind,
			flash: f.flash,
			fade: f.fade,
			tick: f.world.tick,
			loopLimit: f.loopLimit,
			ghosts: f.ghosts,
			showLoopBar: f.showLoopBar !== false,
			reducedFlashing: this.reducedFlashing
		});
	}

	/** Reuses one context object per renderer: no per-frame allocation. */
	private drawContext(f: FrameState): DrawContext {
		const d = (this.dc ??= {
			ctx: this.ctx,
			camera: this.camera,
			particles: this.particles,
			level: this.level,
			theme: this.theme,
			world: f.world,
			time: 0,
			dt: 0,
			alpha: 1,
			scale: 1,
			lite: false
		});
		d.level = this.level;
		d.theme = this.theme;
		d.world = f.world;
		d.time = f.time;
		d.dt = f.dt;
		d.alpha = f.alpha;
		d.scale = this.scale;
		d.lite = this.lite;
		return d;
	}

	// ─── camera driving (called by controller) ───────────────────────────────

	followBody(b: Body, alpha: number, dt: number): void {
		const x = b.px + (b.x - b.px) * alpha + b.w / 2;
		const y = b.py + (b.y - b.py) * alpha + b.h / 2;
		this.camera.follow(x, y, b.facing, b.vx, dt, this.level.width, this.level.height);
	}

	followPoint(x: number, y: number, dt: number): void {
		this.camera.follow(x, y, 0, 0, dt, this.level.width, this.level.height);
	}

	shake(amount: number): void {
		if (!this.reducedMotion) this.camera.addTrauma(amount);
	}

	rewindPoint(r: RewindView): { x: number; y: number } {
		return rewindPoint(r);
	}
}

/** `roundRect` is missing on older Safari/Firefox; fall back to plain rectangles there. */
function polyfillRoundRect(ctx: CanvasRenderingContext2D): void {
	const proto = Object.getPrototypeOf(ctx) as CanvasRenderingContext2D;
	if (typeof proto.roundRect === 'function') return;
	proto.roundRect = function (
		this: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number
	) {
		this.rect(x, y, w, h);
	} as CanvasRenderingContext2D['roundRect'];
}
