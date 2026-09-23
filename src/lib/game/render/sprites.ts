/**
 * Procedural runner sprite, drawn from a few rounded shapes so it scales crisply at any resolution.
 * Coordinates are world units; (x, y) is the hitbox top-left (10×14). The silhouette is chunky on
 * purpose: at phone size it must read instantly, including mid-jump and mid-dash.
 */
export interface RunnerLook {
	body: string;
	shade: string;
	visor: string;
	alpha: number;
}

export interface RunnerPose {
	facing: number;
	/** 0..1 landing squash, negative for jump stretch */
	squash: number;
	/** running cycle phase in radians; NaN = standing */
	stride: number;
	airborne: boolean;
	dashing: boolean;
}

/** Local-space anchor (relative to hitbox top-left) where the scarf attaches, for a given facing. */
export const scarfAnchor = (facing: number): { x: number; y: number } => ({
	x: 5 - facing * 3,
	y: 5
});

export function drawRunner(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	look: RunnerLook,
	pose: RunnerPose
): void {
	const sx = 1 + pose.squash * 0.28;
	const sy = 1 - pose.squash * 0.24;
	const f = pose.facing;
	ctx.save();
	ctx.globalAlpha = look.alpha;
	ctx.translate(x + 5, y + 14);
	ctx.scale(sx, sy);
	if (pose.dashing) ctx.transform(1, 0, -0.3 * f, 1, 0, 0);

	// legs
	ctx.fillStyle = look.shade;
	if (pose.airborne) {
		ctx.beginPath();
		ctx.roundRect(-3.8, -5, 3, 3.2, 1);
		ctx.roundRect(0.8, -4.2, 3, 3.2, 1);
		ctx.fill();
	} else {
		const a = Number.isNaN(pose.stride) ? 0 : Math.sin(pose.stride) * 2.3;
		ctx.beginPath();
		ctx.roundRect(-3.6 + a, -4.2, 3, 4.2, 1);
		ctx.roundRect(0.6 - a, -4.2, 3, 4.2, 1);
		ctx.fill();
	}
	// torso
	ctx.fillStyle = look.body;
	ctx.beginPath();
	ctx.roundRect(-4.6, -10.5, 9.2, 7, 2.2);
	ctx.fill();
	// helmet, leaning into the direction of travel
	ctx.beginPath();
	ctx.roundRect(-4.4 + f * 0.6, -15.2, 8.8, 6.2, 2.8);
	ctx.fill();
	// visor band with a hot core
	ctx.fillStyle = look.visor;
	ctx.beginPath();
	ctx.roundRect(f > 0 ? -0.6 : -4.6, -13.2, 5.2, 2.2, 1.1);
	ctx.fill();
	ctx.globalAlpha = look.alpha * 0.9;
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(f > 0 ? 2.6 : -3.6, -12.8, 1, 1);
	// chest core
	ctx.fillStyle = look.visor;
	ctx.globalAlpha = look.alpha * 0.85;
	ctx.fillRect(-0.9 + f * 0.8, -8, 1.8, 1.8);
	ctx.restore();
}
