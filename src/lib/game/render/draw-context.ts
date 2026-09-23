import type { LevelData } from '../levels/parse';
import type { World } from '../sim/world';
import type { Camera } from './camera';
import type { Theme } from './palette';
import type { Particles } from './particles';

/**
 * Everything a render layer needs for one frame. Layers are plain functions/classes that read this;
 * they never own game state. `alpha` is the fixed-step interpolation factor (0..1).
 */
export interface DrawContext {
	ctx: CanvasRenderingContext2D;
	camera: Camera;
	particles: Particles;
	level: LevelData;
	theme: Theme;
	world: World;
	time: number;
	dt: number;
	alpha: number;
	/** device pixels per world unit */
	scale: number;
	/** degraded-quality mode: skip expensive cosmetic passes */
	lite: boolean;
}

export function inView(c: Camera, x: number, y: number, w: number, h: number, margin = 8): boolean {
	return (
		x + w > c.x - margin &&
		x < c.x + c.viewW + margin &&
		y + h > c.y - margin &&
		y < c.y + c.viewH + margin
	);
}
