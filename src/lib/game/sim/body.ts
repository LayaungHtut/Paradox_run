import { BODY_H, BODY_W } from '../core/constants';

export const DeathCause = {
	None: 0,
	Spike: 1,
	Laser: 2,
	Bolt: 3,
	Fall: 4,
	/** ghost ran out of recorded input — not a death, the echo simply ends */
	Expired: 5
} as const;
export type DeathCause = (typeof DeathCause)[keyof typeof DeathCause];

/** A physical actor. The player and every ghost are Bodies driven by the same physics. */
export class Body {
	x = 0;
	y = 0;
	/** position at the start of the current tick — used for render interpolation */
	px = 0;
	py = 0;
	readonly w = BODY_W;
	readonly h = BODY_H;
	vx = 0;
	vy = 0;
	facing: 1 | -1 = 1;
	onGround = false;
	coyote = 0;
	jumpBuffer = 0;
	dashTicks = 0;
	dashDir: 1 | -1 = 1;
	dashReady = true;
	dashCooldown = 0;
	/** lift index this body is standing on, -1 if none */
	lift = -1;
	input = 0;
	prevInput = 0;
	alive = true;
	cause: DeathCause = DeathCause.None;
	deathTick = -1;
	/** tick of last landing (render squash) */
	landTick = -1000;
	jumpTick = -1000;

	constructor(
		readonly id: number,
		readonly isGhost: boolean,
		x: number,
		y: number
	) {
		this.x = this.px = x;
		this.y = this.py = y;
	}

	get cx(): number {
		return this.x + this.w / 2;
	}
	get cy(): number {
		return this.y + this.h / 2;
	}
}
