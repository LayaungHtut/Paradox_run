import { mulberry32, hashString } from '../core/rng';
import type { LevelData } from '../levels/parse';
import type { Camera } from './camera';
import type { Theme } from './palette';

/*
 * Parallax background: two layers of procedurally placed architecture behind the level.
 * Generated once per level from a seed (the level id), so a level always looks the same.
 * Drawn with plain fillRects and culled to the view: a few dozen rects per frame.
 */

interface Slab {
	x: number;
	y: number;
	w: number;
	h: number;
	/** window-light rows (0 = none) */
	lights: number;
}

const FAR_PARALLAX = 0.18;
const MID_PARALLAX = 0.42;

export class Background {
	private far: Slab[] = [];
	private mid: Slab[] = [];
	private sky: CanvasGradient | null = null;

	build(level: LevelData, viewW: number, viewH: number): void {
		const rng = mulberry32(hashString(`bg:${level.def.id}`));
		const span = (p: number) => level.width * p + viewW + 200;
		this.far = [];
		for (let x = -60; x < span(FAR_PARALLAX);) {
			const w = 40 + rng() * 70;
			const h = viewH * (0.35 + rng() * 0.5);
			this.far.push({ x, y: viewH - h, w, h, lights: 0 });
			x += w + 10 + rng() * 60;
		}
		this.mid = [];
		for (let x = -40; x < span(MID_PARALLAX);) {
			const w = 18 + rng() * 30;
			const h = viewH * (0.2 + rng() * 0.45);
			this.mid.push({
				x,
				y: viewH - h,
				w,
				h,
				lights: rng() < 0.55 ? 1 + Math.floor(rng() * 5) : 0
			});
			x += w + 30 + rng() * 90;
		}
	}

	resize(ctx: CanvasRenderingContext2D, theme: Theme, pixelH: number): void {
		this.sky = ctx.createLinearGradient(0, 0, 0, pixelH);
		this.sky.addColorStop(0, theme.skyTop);
		this.sky.addColorStop(1, theme.skyBottom);
	}

	/** Draws in screen space (transform must be identity on entry; left as scale-only on exit). */
	draw(
		ctx: CanvasRenderingContext2D,
		cam: Camera,
		theme: Theme,
		scale: number,
		time: number,
		lite: boolean
	): void {
		const cw = ctx.canvas.width;
		const ch = ctx.canvas.height;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.fillStyle = this.sky ?? theme.skyTop;
		ctx.fillRect(0, 0, cw, ch);
		if (lite) return;

		// horizon glow band behind the architecture
		ctx.globalAlpha = 0.07;
		ctx.fillStyle = theme.accent;
		ctx.fillRect(0, ch * 0.62, cw, ch * 0.08);
		ctx.globalAlpha = 1;

		// kept deliberately faint: background shapes must never read as platforms
		ctx.globalAlpha = 0.55;
		this.layer(ctx, this.far, cam, FAR_PARALLAX, scale, theme.far, null, time);
		ctx.globalAlpha = 0.5;
		this.layer(ctx, this.mid, cam, MID_PARALLAX, scale, theme.mid, theme.accent, time);
		ctx.globalAlpha = 1;
	}

	private layer(
		ctx: CanvasRenderingContext2D,
		slabs: Slab[],
		cam: Camera,
		p: number,
		scale: number,
		color: string,
		lightColor: string | null,
		time: number
	): void {
		// parallax: layer scrolls at p× the camera; vertical offset is damped so tall levels stay calm
		const ox = cam.x * p;
		const oy = cam.y * p * 0.5;
		ctx.setTransform(scale, 0, 0, scale, -ox * scale, -oy * scale);
		const left = ox - 10;
		const right = ox + cam.viewW + 10;
		ctx.fillStyle = color;
		for (const s of slabs)
			if (s.x + s.w > left && s.x < right) ctx.fillRect(s.x, s.y, s.w, s.h + cam.viewH);
		if (!lightColor) return;
		// sparse window lights and a thin roof edge, slowly breathing
		ctx.fillStyle = lightColor;
		for (let i = 0; i < slabs.length; i++) {
			const s = slabs[i];
			if (s.x + s.w <= left || s.x >= right) continue;
			ctx.globalAlpha = 0.07;
			ctx.fillRect(s.x, s.y, s.w, 0.6);
			if (!s.lights) continue;
			ctx.globalAlpha = 0.05 + 0.03 * Math.sin(time * 0.7 + i);
			for (let r = 0; r < s.lights; r++) ctx.fillRect(s.x + 4, s.y + 8 + r * 9, s.w - 8, 1.5);
		}
		ctx.globalAlpha = 1;
	}
}
