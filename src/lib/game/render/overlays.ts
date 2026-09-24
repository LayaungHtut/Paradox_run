import { TICK_RATE } from '../core/constants';
import { easeInOut, type GhostView, type RewindView } from './actors';
import type { Camera } from './camera';
import { PAL } from './palette';

/*
 * Screen-space effects: vignette, rewind VHS treatment, flash/fade, the time-fracture burst when
 * echoes materialise, and the loop timeline bar (current loop progress + where each echo runs out).
 */

const FRACTURE_S = 0.6;

export interface LoopBarRect {
	x: number;
	y: number;
	w: number;
}

interface Fracture {
	x: number;
	y: number;
	age: number;
	seed: number;
}

export class OverlayLayer {
	private vignette: CanvasGradient | null = null;
	private scan: CanvasPattern | null = null;
	private fractures: Fracture[] = [];
	private dpr = 1;
	private cssW = 1;
	/** where the HUD wants the loop bar, in CSS px (null: default top-centre placement) */
	loopBar: LoopBarRect | null = null;

	resize(ctx: CanvasRenderingContext2D, dpr: number, cssW: number): void {
		this.dpr = dpr;
		this.cssW = cssW;
		const cw = ctx.canvas.width;
		const ch = ctx.canvas.height;
		this.vignette = ctx.createRadialGradient(
			cw / 2,
			ch / 2,
			ch * 0.35,
			cw / 2,
			ch / 2,
			Math.max(cw, ch) * 0.75
		);
		this.vignette.addColorStop(0, 'rgba(0,0,0,0)');
		this.vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
		const c = document.createElement('canvas');
		c.width = 1;
		c.height = Math.max(3, Math.round(4 * dpr));
		const g = c.getContext('2d');
		if (g) {
			g.fillStyle = 'rgba(0,0,0,0.5)';
			g.fillRect(0, 0, 1, Math.max(1, 1.5 * dpr));
			this.scan = ctx.createPattern(c, 'repeat');
		}
	}

	/** Echoes materialising: a ring and radial cracks at a world position. */
	fracture(x: number, y: number): void {
		if (this.fractures.length < 8) this.fractures.push({ x, y, age: 0, seed: Math.random() * 10 });
	}

	clear(): void {
		this.fractures.length = 0;
	}

	/** World-space part: fractures live in the world so they stick to the spawn point. */
	drawWorld(ctx: CanvasRenderingContext2D, dt: number): void {
		for (let i = this.fractures.length - 1; i >= 0; i--) {
			const f = this.fractures[i];
			f.age += dt;
			if (f.age >= FRACTURE_S) {
				this.fractures.splice(i, 1);
				continue;
			}
			const k = f.age / FRACTURE_S;
			const r = 6 + easeInOut(k) * 34;
			ctx.strokeStyle = PAL.ghost;
			ctx.globalAlpha = (1 - k) * 0.8;
			ctx.lineWidth = 1.5 * (1 - k) + 0.3;
			ctx.beginPath();
			ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
			ctx.stroke();
			// jagged cracks radiating outward
			ctx.strokeStyle = '#d9f3ff';
			ctx.lineWidth = 0.7;
			ctx.beginPath();
			for (let c = 0; c < 7; c++) {
				const a = f.seed + (c / 7) * Math.PI * 2;
				const inner = r * 0.3;
				const mid = r * 0.65;
				ctx.moveTo(f.x + Math.cos(a) * inner, f.y + Math.sin(a) * inner);
				ctx.lineTo(f.x + Math.cos(a + 0.18) * mid, f.y + Math.sin(a + 0.18) * mid);
				ctx.lineTo(f.x + Math.cos(a - 0.05) * r, f.y + Math.sin(a - 0.05) * r);
			}
			ctx.stroke();
			ctx.globalAlpha = 1;
		}
	}

	drawScreen(
		ctx: CanvasRenderingContext2D,
		opts: {
			time: number;
			lite: boolean;
			rewind: RewindView | null;
			flash: number;
			fade: number;
			tick: number;
			loopLimit: number;
			ghosts: GhostView[];
			showLoopBar: boolean;
			reducedFlashing: boolean;
		}
	): void {
		const cw = ctx.canvas.width;
		const ch = ctx.canvas.height;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		if (!opts.lite && this.vignette) {
			ctx.fillStyle = this.vignette;
			ctx.fillRect(0, 0, cw, ch);
		}
		if (opts.rewind) this.drawRewind(ctx, opts.rewind.t, opts.time);
		if (opts.flash > 0) {
			ctx.globalAlpha = opts.flash * (opts.reducedFlashing ? 0.18 : 0.5);
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(0, 0, cw, ch);
			ctx.globalAlpha = 1;
		}
		if (opts.showLoopBar) this.drawLoopBar(ctx, opts);
		if (opts.fade > 0) {
			ctx.globalAlpha = opts.fade;
			ctx.fillStyle = PAL.bgTop;
			ctx.fillRect(0, 0, cw, ch);
			ctx.globalAlpha = 1;
		}
	}

	private drawRewind(ctx: CanvasRenderingContext2D, t: number, time: number): void {
		const cw = ctx.canvas.width;
		const ch = ctx.canvas.height;
		const strength = Math.sin(t * Math.PI);
		ctx.fillStyle = `rgba(40,70,150,${0.3 * strength})`;
		ctx.fillRect(0, 0, cw, ch);
		if (this.scan) {
			ctx.globalAlpha = 0.5 * strength;
			ctx.fillStyle = this.scan;
			ctx.fillRect(0, 0, cw, ch);
			ctx.globalAlpha = 1;
		}
		// tracking-error bands sweeping upward: time running backwards
		ctx.fillStyle = 'rgba(160,200,255,0.07)';
		for (let k = 0; k < 3; k++) {
			const y = ch - (((time * 900 + k * 317) % (ch + 60)) - 30);
			ctx.fillRect(0, y, cw, 7 * this.dpr);
		}
		// REWIND glyph ◀◀ in the corner
		ctx.globalAlpha = strength * 0.8;
		ctx.fillStyle = PAL.ghost;
		const s = 10 * this.dpr;
		const x0 = cw - 70 * this.dpr;
		const y0 = ch - 34 * this.dpr;
		for (let i = 0; i < 2; i++) {
			ctx.beginPath();
			ctx.moveTo(x0 + i * s, y0);
			ctx.lineTo(x0 + i * s + s, y0 - s * 0.7);
			ctx.lineTo(x0 + i * s + s, y0 + s * 0.7);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}

	private drawLoopBar(
		ctx: CanvasRenderingContext2D,
		o: {
			time: number;
			rewind: RewindView | null;
			tick: number;
			loopLimit: number;
			ghosts: GhostView[];
		}
	): void {
		const d = this.dpr;
		const slot = this.loopBar;
		const barW = (slot ? slot.w : Math.min(360, this.cssW * 0.38)) * d;
		const barH = 4 * d;
		const x = slot ? slot.x * d : (ctx.canvas.width - barW) / 2;
		const y = (slot ? slot.y : 18) * d;
		const tick = o.rewind ? o.tick * (1 - easeInOut(o.rewind.t)) : o.tick;
		const k = Math.min(1, tick / o.loopLimit);
		const remaining = (o.loopLimit - tick) / TICK_RATE;
		ctx.fillStyle = 'rgba(255,255,255,0.1)';
		ctx.fillRect(x, y, barW, barH);
		const danger = remaining < 3 && !o.rewind;
		ctx.fillStyle = danger ? PAL.hazard : o.rewind ? PAL.ghost : PAL.player;
		ctx.globalAlpha = danger ? 0.7 + Math.sin(o.time * 16) * 0.3 : 1;
		ctx.fillRect(x, y, barW * k, barH);
		ctx.globalAlpha = 1;
		// echo expiry markers: when does each echo run out of recorded past?
		ctx.font = `700 ${9 * d}px ui-sans-serif, system-ui, sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		for (const g of o.ghosts) {
			const gx = x + barW * Math.min(1, g.endTick / o.loopLimit);
			const expired = tick >= g.endTick;
			ctx.fillStyle = g.desync ? PAL.desync : PAL.ghost;
			ctx.globalAlpha = expired ? 0.35 : 1;
			ctx.fillRect(gx - d, y - 3 * d, 2 * d, barH + 6 * d);
			ctx.fillText(String(g.label), gx, y + barH + 4 * d);
		}
		ctx.globalAlpha = 1;
	}
}

export type { Camera };
