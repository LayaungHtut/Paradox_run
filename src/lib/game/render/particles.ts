import { PARTICLE_COLORS } from './palette';

/**
 * Fixed-capacity particle pool in typed arrays: no per-frame allocation, one fillStyle change per
 * colour. Particles are purely cosmetic and run on render time, never on sim ticks.
 */
export class Particles {
	readonly cap: number;
	count = 0;
	private x: Float32Array;
	private y: Float32Array;
	private vx: Float32Array;
	private vy: Float32Array;
	private life: Float32Array;
	private max: Float32Array;
	private size: Float32Array;
	private grav: Float32Array;
	private color: Uint8Array;
	/** 0 → particle budget scaled by settings (reduced effects) */
	budget = 1;

	constructor(cap = 900) {
		this.cap = cap;
		this.x = new Float32Array(cap);
		this.y = new Float32Array(cap);
		this.vx = new Float32Array(cap);
		this.vy = new Float32Array(cap);
		this.life = new Float32Array(cap);
		this.max = new Float32Array(cap);
		this.size = new Float32Array(cap);
		this.grav = new Float32Array(cap);
		this.color = new Uint8Array(cap);
	}

	spawn(
		x: number,
		y: number,
		vx: number,
		vy: number,
		life: number,
		size: number,
		color: number,
		grav = 0
	): void {
		if (this.count >= this.cap) return;
		const i = this.count++;
		this.x[i] = x;
		this.y[i] = y;
		this.vx[i] = vx;
		this.vy[i] = vy;
		this.life[i] = this.max[i] = life;
		this.size[i] = size;
		this.grav[i] = grav;
		this.color[i] = color;
	}

	/** Radial burst. `speed` in world units / second. */
	burst(
		x: number,
		y: number,
		n: number,
		color: number,
		speed: number,
		life: number,
		size = 1.5,
		grav = 0
	): void {
		const count = Math.max(1, Math.round(n * this.budget));
		for (let k = 0; k < count; k++) {
			const a = Math.random() * Math.PI * 2;
			const s = speed * (0.35 + Math.random() * 0.65);
			this.spawn(
				x,
				y,
				Math.cos(a) * s,
				Math.sin(a) * s,
				life * (0.6 + Math.random() * 0.4),
				size * (0.6 + Math.random() * 0.7),
				color,
				grav
			);
		}
	}

	update(dt: number): void {
		let i = 0;
		while (i < this.count) {
			this.life[i] -= dt;
			if (this.life[i] <= 0) {
				// swap-remove
				const last = --this.count;
				this.x[i] = this.x[last];
				this.y[i] = this.y[last];
				this.vx[i] = this.vx[last];
				this.vy[i] = this.vy[last];
				this.life[i] = this.life[last];
				this.max[i] = this.max[last];
				this.size[i] = this.size[last];
				this.grav[i] = this.grav[last];
				this.color[i] = this.color[last];
				continue;
			}
			this.vy[i] += this.grav[i] * dt;
			const drag = 1 - 2.2 * dt;
			this.vx[i] *= drag;
			this.vy[i] *= drag;
			this.x[i] += this.vx[i] * dt;
			this.y[i] += this.vy[i] * dt;
			i++;
		}
	}

	draw(ctx: CanvasRenderingContext2D): void {
		for (let c = 0; c < PARTICLE_COLORS.length; c++) {
			let styled = false;
			for (let i = 0; i < this.count; i++) {
				if (this.color[i] !== c) continue;
				if (!styled) {
					ctx.fillStyle = PARTICLE_COLORS[c];
					styled = true;
				}
				const t = this.life[i] / this.max[i];
				ctx.globalAlpha = t < 0.5 ? t * 2 : 1;
				const s = this.size[i] * (0.4 + 0.6 * t);
				ctx.fillRect(this.x[i] - s / 2, this.y[i] - s / 2, s, s);
			}
		}
		ctx.globalAlpha = 1;
	}

	clear(): void {
		this.count = 0;
	}
}
