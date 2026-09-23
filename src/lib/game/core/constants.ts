/**
 * Global simulation constants. Changing any value that affects physics MUST bump SIM_VERSION,
 * because stored replays and leaderboard entries are only valid for the version that produced them.
 */
export const SIM_VERSION = 2;

/** Simulation ticks per second. The sim never sees wall-clock time. */
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;

/** World units per tile. */
export const TILE = 16;

/** Player / ghost hitbox. */
export const BODY_W = 10;
export const BODY_H = 14;

export const PHYS = {
	gravity: 0.3,
	/** Extra gravity multiplier while rising without holding jump (variable jump height). */
	lowJumpGravityMul: 2.2,
	maxFall: 5.5,
	runSpeed: 2.1,
	groundAccel: 0.32,
	groundDecel: 0.42,
	airAccel: 0.2,
	airDecel: 0.08,
	jumpVelocity: -5.4,
	coyoteTicks: 6,
	jumpBufferTicks: 7,
	dashSpeed: 5,
	dashTicks: 9,
	/** ticks from dash start until the next dash is allowed — stops ground-dash spam outrunning puzzles */
	dashCooldown: 32,
	/** Speed kept after a dash ends. */
	dashExitSpeed: 2.6
} as const;

/** Input bitmask — one byte per tick is recorded. */
export const IN_LEFT = 1;
export const IN_RIGHT = 2;
export const IN_JUMP = 4;
export const IN_DASH = 8;
export const IN_MASK = IN_LEFT | IN_RIGHT | IN_JUMP | IN_DASH;

/** Hard limits used by the replay codec and the server verifier. */
export const LIMITS = {
	maxLoopsPerRun: 60,
	maxTicksPerLoop: TICK_RATE * 60,
	maxEncodedLoopChars: 8000
} as const;
