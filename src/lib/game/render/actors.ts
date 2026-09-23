import type { Body } from '../sim/body';
import type { World } from '../sim/world';
import { type DrawContext } from './draw-context';
import { PAL, PC } from './palette';
import { drawRunner, scarfAnchor, type RunnerLook, type RunnerPose } from './sprites';

/*
 * Player, echoes, rival ghost and the rewind runner.
 *
 *  - Player: solid, brightest object on screen, amber scarf that trails motion.
 *  - Echo: a hologram of the same runner — rendered to a small offscreen canvas, cut with scanlines,
 *    drawn with a violet chromatic fringe and a numbered tag. It can never be mistaken for you.
 *  - Desynced echo: shifts pink, glitches harder, tag shows "?".
 *  - Rival / best ghost: gold hologram tagged BEST.
 */

export interface GhostView {
	/** 1-based echo number shown to the player */
	label: number;
	desync: boolean;
	/** tick at which this echo's recording ends */
	endTick: number;
}

export interface RewindView {
	path: Float32Array;
	count: number;
	/** 0 → 1 progress of the rewind animation */
	t: number;
}

const TRAIL_LEN = 12;
const SCARF_POINTS = 6;
const SCARF_SEG = 2.3;

const LOOK_PLAYER: RunnerLook = {
	body: PAL.player,
	shade: PAL.playerShade,
	visor: PAL.visor,
	alpha: 1
};
const HOLO_ECHO: RunnerLook = {
	body: PAL.ghost,
	shade: '#4fa3cf',
	visor: PAL.ghostVisor,
	alpha: 1
};
const HOLO_DESYNC: RunnerLook = { body: PAL.desync, shade: '#c24f7a', visor: '#ffe3ee', alpha: 1 };
const HOLO_RIVAL: RunnerLook = { body: PAL.rival, shade: '#c79a45', visor: '#fff4d6', alpha: 1 };
const FRINGE: RunnerLook = { body: '#b99bff', shade: '#b99bff', visor: '#b99bff', alpha: 0.22 };
const REWIND_LOOK: RunnerLook = { ...HOLO_ECHO, alpha: 0.8 };

export const easeInOut = (t: number): number =>
	t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export class ActorLayer {
	private trails: Float32Array[] = [];
	private trailHead: number[] = [];
	private stride: number[] = [];
	private scarves: Float32Array[] = [];
	private holo: HTMLCanvasElement | null = null;
	private holoCtx: CanvasRenderingContext2D | null = null;
	private holoScale = 0;
	/** extra slot for the rival ghost's cosmetic state */
	static readonly RIVAL_ID = 99;

	reset(world: World): void {
		this.trails = [];
		this.trailHead = [];
		this.stride = [];
		this.scarves = [];
		for (const b of world.bodies) this.initBody(b.id, b.x, b.y);
		this.initBody(ActorLayer.RIVAL_ID, world.player.x, world.player.y);
	}

	private initBody(id: number, x: number, y: number): void {
		this.trails[id] = new Float32Array(TRAIL_LEN * 2).fill(Number.NaN);
		this.trailHead[id] = 0;
		this.stride[id] = 0;
		const s = new Float32Array(SCARF_POINTS * 2);
		for (let i = 0; i < SCARF_POINTS; i++) {
			s[i * 2] = x;
			s[i * 2 + 1] = y + 5;
		}
		this.scarves[id] = s;
	}

	draw(
		d: DrawContext,
		ghosts: GhostView[],
		rival: Body | null,
		rivalLabel: string,
		rewind: RewindView | null,
		hidePlayer: boolean
	): void {
		const w = d.world;
		// echoes first so the player stays visually dominant
		for (let i = 1; i < w.bodies.length; i++) {
			const b = w.bodies[i];
			if (b.alive) this.drawEcho(d, b, ghosts[b.id - 1]);
		}
		if (rival)
			this.drawHologram(d, rival, HOLO_RIVAL, rivalLabel, ActorLayer.RIVAL_ID, 0.42, false);
		if (rewind) this.drawRewindRunner(d, rewind);
		else if (!hidePlayer && w.player.alive) this.drawPlayer(d, w.player);
	}

	// ─── player ──────────────────────────────────────────────────────────────

	private drawPlayer(d: DrawContext, b: Body): void {
		const { x, y } = lerpPos(b, d.alpha);
		this.pushTrail(b.id, x, y);
		if (b.dashTicks > 0) this.drawTrail(d, b.id, PAL.player, 0.35, b.w, b.h);
		this.drawScarf(d, b, x, y, PAL.visor, 1);
		drawRunner(d.ctx, x, y, LOOK_PLAYER, this.pose(d, b));
	}

	// ─── echoes ──────────────────────────────────────────────────────────────

	private drawEcho(d: DrawContext, b: Body, info: GhostView | undefined): void {
		const desync = info?.desync ?? false;
		const label = info ? (desync ? `${info.label}?` : String(info.label)) : '';
		this.drawHologram(d, b, desync ? HOLO_DESYNC : HOLO_ECHO, label, b.id, 0.62, desync);
		// temporal motes shed by the echo
		if (Math.random() < 0.3 * d.particles.budget) {
			const { x, y } = lerpPos(b, d.alpha);
			d.particles.spawn(
				x + Math.random() * b.w,
				y + Math.random() * b.h,
				0,
				-6,
				0.7,
				1,
				desync ? PC.desync : PC.ghost
			);
		}
	}

	private drawHologram(
		d: DrawContext,
		b: Body,
		look: RunnerLook,
		label: string,
		id: number,
		opacity: number,
		glitch: boolean
	): void {
		const ctx = d.ctx;
		const { x, y } = lerpPos(b, d.alpha);
		this.pushTrail(id, x, y);
		this.drawTrail(d, id, look.body, 0.07, b.w, b.h);
		const pose = this.pose(d, b, id);
		// glitch: occasional horizontal tear, stronger when desynced
		const tearRate = glitch ? 0.35 : 0.04;
		const tear =
			Math.sin(d.time * 13 + id * 3.1) > 1 - tearRate * 2
				? Math.sin(d.time * 97 + id) * (glitch ? 2.2 : 1)
				: 0;
		const shimmer = Math.sin(d.time * 23 + id * 2.1) * (glitch ? 1 : 0.4);

		// chromatic fringe: a violet copy offset opposite to the shimmer
		drawRunner(ctx, x - shimmer - 0.8, y, FRINGE, pose);
		this.drawScarf(d, b, x, y, look.body, 0.45, id);

		// lite mode: skip the offscreen scanline pass (the costliest part of a hologram)
		const holo = d.lite ? null : this.holoCanvas(d.scale);
		if (holo) {
			const hc = this.holoCtx!;
			const size = holo.width;
			hc.setTransform(1, 0, 0, 1, 0, 0);
			hc.clearRect(0, 0, size, size);
			// runner centred in the offscreen canvas (world box 30×30 around the hitbox)
			hc.setTransform(d.scale, 0, 0, d.scale, 10 * d.scale, 10 * d.scale);
			drawRunner(hc, 0, 0, look, pose);
			// scanlines cut out of the body
			hc.setTransform(1, 0, 0, 1, 0, 0);
			hc.globalCompositeOperation = 'destination-out';
			hc.fillStyle = 'rgba(0,0,0,0.55)';
			const step = Math.max(2, Math.round(d.scale * 1.1));
			const off = Math.floor(d.time * 30) % step;
			for (let sy = off; sy < size; sy += step) hc.fillRect(0, sy, size, Math.max(1, step / 2.5));
			hc.globalCompositeOperation = 'source-over';
			ctx.globalAlpha = opacity;
			ctx.drawImage(holo, x - 10 + shimmer + tear, y - 10, 30, 30);
			ctx.globalAlpha = 1;
		} else {
			drawRunner(ctx, x + shimmer, y, { ...look, alpha: opacity }, pose);
		}
		if (label) drawTag(ctx, label, x + b.w / 2, y - 5, look.body);
	}

	/** Lazily sized offscreen canvas for hologram rendering; null where canvases are unavailable. */
	private holoCanvas(scale: number): HTMLCanvasElement | null {
		if (typeof document === 'undefined') return null;
		const size = Math.ceil(30 * scale);
		if (!this.holo || this.holoScale !== scale) {
			this.holo ??= document.createElement('canvas');
			this.holo.width = this.holo.height = size;
			this.holoCtx = this.holo.getContext('2d');
			this.holoScale = scale;
		}
		return this.holoCtx ? this.holo : null;
	}

	// ─── shared pieces ───────────────────────────────────────────────────────

	private pose(d: DrawContext, b: Body, id = b.id): RunnerPose {
		const tick = d.world.tick;
		const sinceLand = tick - b.landTick;
		const sinceJump = tick - b.jumpTick;
		let squash = 0;
		if (sinceLand >= 0 && sinceLand < 7) squash = (1 - sinceLand / 7) * 0.9;
		else if (sinceJump >= 0 && sinceJump < 8 && !b.onGround) squash = -(1 - sinceJump / 8) * 0.8;
		const moving = b.onGround && Math.abs(b.vx) > 0.3;
		if (moving) this.stride[id] = (this.stride[id] ?? 0) + Math.abs(b.vx) * d.dt * 11;
		return {
			facing: b.facing,
			squash,
			stride: moving ? this.stride[id] : Number.NaN,
			airborne: !b.onGround,
			dashing: b.dashTicks > 0
		};
	}

	/** A short spring chain from the back of the helmet: cheap, and it makes motion legible. */
	private drawScarf(
		d: DrawContext,
		b: Body,
		x: number,
		y: number,
		color: string,
		alpha: number,
		id = b.id
	): void {
		const s = this.scarves[id];
		if (!s) return;
		const a = scarfAnchor(b.facing);
		s[0] = x + a.x;
		s[1] = y + a.y;
		const flutter = Math.sin(d.time * 14 + id) * 0.6;
		for (let i = 1; i < SCARF_POINTS; i++) {
			// drift backwards and slightly down, then constrain segment length to the previous point
			s[i * 2] += -b.facing * 0.35;
			s[i * 2 + 1] += 0.25 + flutter * 0.2;
			const dx = s[i * 2] - s[(i - 1) * 2];
			const dy = s[i * 2 + 1] - s[(i - 1) * 2 + 1];
			const len = Math.hypot(dx, dy) || 1;
			s[i * 2] = s[(i - 1) * 2] + (dx / len) * SCARF_SEG;
			s[i * 2 + 1] = s[(i - 1) * 2 + 1] + (dy / len) * SCARF_SEG;
		}
		const ctx = d.ctx;
		ctx.strokeStyle = color;
		ctx.globalAlpha = alpha;
		ctx.lineCap = 'round';
		for (let i = 1; i < SCARF_POINTS; i++) {
			ctx.lineWidth = 2.2 * (1 - i / (SCARF_POINTS + 1));
			ctx.beginPath();
			ctx.moveTo(s[(i - 1) * 2], s[(i - 1) * 2 + 1]);
			ctx.lineTo(s[i * 2], s[i * 2 + 1]);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
	}

	private pushTrail(id: number, x: number, y: number): void {
		const tr = this.trails[id];
		if (!tr) return;
		const h = this.trailHead[id];
		tr[h * 2] = x;
		tr[h * 2 + 1] = y;
		this.trailHead[id] = (h + 1) % TRAIL_LEN;
	}

	private drawTrail(
		d: DrawContext,
		id: number,
		color: string,
		alpha: number,
		bw: number,
		bh: number
	): void {
		const tr = this.trails[id];
		if (!tr) return;
		const ctx = d.ctx;
		ctx.fillStyle = color;
		const head = this.trailHead[id];
		for (let k = 1; k < TRAIL_LEN; k++) {
			const idx = (head + k) % TRAIL_LEN;
			const x = tr[idx * 2];
			if (Number.isNaN(x)) continue;
			const y = tr[idx * 2 + 1];
			const t = k / TRAIL_LEN;
			ctx.globalAlpha = alpha * t * t;
			// soft, narrow afterimages (rounded) rather than blocky full-hitbox rectangles
			const s = 0.45 + t * 0.4;
			ctx.beginPath();
			ctx.roundRect(x + (bw * (1 - s)) / 2, y + bh * (1 - s) + 1, bw * s, bh * s - 1, 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	private drawRewindRunner(d: DrawContext, r: RewindView): void {
		if (r.count < 1) return;
		const ctx = d.ctx;
		const pos = (r.count - 1) * (1 - easeInOut(r.t));
		const i = Math.floor(pos);
		const x = r.path[i * 2];
		const y = r.path[i * 2 + 1];
		// streak through the path just unwound
		ctx.strokeStyle = PAL.ghost;
		ctx.lineWidth = 2;
		ctx.lineCap = 'round';
		const span = 48;
		for (let k = 0; k < span; k += 4) {
			const j = Math.min(r.count - 1, i + k);
			const j2 = Math.min(r.count - 1, i + k + 4);
			ctx.globalAlpha = 0.55 * (1 - k / span);
			ctx.beginPath();
			ctx.moveTo(r.path[j * 2] + 5, r.path[j * 2 + 1] + 7);
			ctx.lineTo(r.path[j2 * 2] + 5, r.path[j2 * 2 + 1] + 7);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
		drawRunner(ctx, x, y, REWIND_LOOK, {
			facing: -1,
			squash: 0,
			stride: Number.NaN,
			airborne: true,
			dashing: false
		});
	}
}

export function rewindPoint(r: RewindView): { x: number; y: number } {
	const pos = (r.count - 1) * (1 - easeInOut(r.t));
	const i = Math.max(0, Math.floor(pos));
	return { x: r.path[i * 2] + 5, y: r.path[i * 2 + 1] + 7 };
}

const lerpPos = (b: Body, alpha: number) => ({
	x: b.px + (b.x - b.px) * alpha,
	y: b.py + (b.y - b.py) * alpha
});

/** Small rounded tag above an echo: its loop number (or "?" when desynced, "BEST" for the rival). */
function drawTag(
	ctx: CanvasRenderingContext2D,
	text: string,
	cx: number,
	y: number,
	color: string
): void {
	ctx.font = '800 5px ui-sans-serif, system-ui, sans-serif';
	const w = Math.max(6, ctx.measureText(text).width + 4);
	ctx.globalAlpha = 0.85;
	ctx.fillStyle = 'rgba(6,10,20,0.75)';
	ctx.beginPath();
	ctx.roundRect(cx - w / 2, y - 4, w, 6.5, 2);
	ctx.fill();
	ctx.fillStyle = color;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(text, cx, y - 0.6);
	ctx.globalAlpha = 1;
}
