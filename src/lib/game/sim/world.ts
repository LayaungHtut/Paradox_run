import { IN_DASH, IN_JUMP, IN_LEFT, IN_RIGHT, PHYS, TILE } from '../core/constants';
import {
	CHANNEL_COUNT,
	T_ONEWAY,
	T_SOLID,
	T_SPIKE_DOWN,
	T_SPIKE_UP,
	tileAt,
	type LevelData,
	type Rect
} from '../levels/parse';
import { Body, DeathCause } from './body';
import { Ev, EventBuffer } from './events';

/*
 * The deterministic world simulation.
 *
 * Determinism contract (see docs/ARCHITECTURE.md D2): only IEEE-exact arithmetic, fixed iteration
 * order, no wall clock, no Math.random. Given the same level, ghost inputs and player inputs,
 * `step()` produces bit-identical state on every machine — which is what lets ghosts replay and the
 * server verify runs.
 */

const EPS = 0.001;
/** max horizontal overlap (world units) corrected when a jump clips a ceiling corner */
const CORNER_NUDGE = 4;
const TURRET_CHARGE = 48;
const TURRET_COOLDOWN = 66;
const BOLT_SPEED = 5;
const BOLT_LIFE = 200;
const MAX_BOLTS = 24;
/** ticks after crossing into the void before a fall counts as death */
const FALL_MARGIN = 48;

export interface DoorState {
	open: boolean;
	closeTimer: number;
}
export interface LiftState {
	x: number;
	y: number;
	px: number;
	py: number;
}
export interface TurretState {
	mode: 0 | 1 | 2; // idle, charging, cooldown
	timer: number;
	target: number;
	aimX: number;
	aimY: number;
}
export interface Bolt {
	alive: boolean;
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
}

const approach = (v: number, target: number, step: number): number =>
	v < target ? Math.min(v + step, target) : Math.max(v - step, target);

const overlaps = (a: Rect, bx: number, by: number, bw: number, bh: number): boolean =>
	a.x < bx + bw && a.x + a.w > bx && a.y < by + bh && a.y + a.h > by;

export class World {
	tick = 0;
	readonly bodies: Body[] = [];
	readonly player: Body;
	readonly events = new EventBuffer();

	readonly power = new Uint8Array(CHANNEL_COUNT);
	readonly platePressed: Uint8Array;
	/** body that pressed the plate most recently (for "your echo did this" feedback) */
	readonly plateBy: Int16Array;
	/** is any ghost standing on the plate right now */
	readonly plateGhost: Uint8Array;
	readonly relayTimer: Int32Array;
	readonly relayBy: Int16Array;
	readonly doors: DoorState[];
	readonly lifts: LiftState[];
	readonly laserOn: Uint8Array;
	readonly turrets: TurretState[];
	readonly bolts: Bolt[] = [];
	readonly shardTaken: Uint8Array;

	exitReached = false;
	/**
	 * Coordination bits for scoring: bit ch (0–7) = a ghost powered channel ch while the player used it;
	 * bit 8+i = turret i fired at a ghost while the player was within its reach (a decoy).
	 */
	assistMask = 0;

	/**
	 * @param ghostInputs recorded input streams, oldest first. Ghost i gets body id i+1.
	 * @param shardsTaken shards already collected in earlier loops of this run
	 */
	constructor(
		readonly level: LevelData,
		readonly ghostInputs: readonly Uint8Array[] = [],
		shardsTaken?: Uint8Array
	) {
		const { spawn } = level;
		this.player = new Body(0, false, spawn.x, spawn.y);
		this.bodies.push(this.player);
		ghostInputs.forEach((_, i) => this.bodies.push(new Body(i + 1, true, spawn.x, spawn.y)));

		this.platePressed = new Uint8Array(level.plates.length);
		this.plateBy = new Int16Array(level.plates.length).fill(-1);
		this.plateGhost = new Uint8Array(level.plates.length);
		this.relayTimer = new Int32Array(level.relays.length);
		this.relayBy = new Int16Array(level.relays.length).fill(-1);
		this.doors = level.doors.map(() => ({ open: false, closeTimer: 0 }));
		this.lifts = level.lifts.map((l) => ({ x: l.x, y: l.y, px: l.x, py: l.y }));
		this.laserOn = new Uint8Array(level.lasers.length);
		this.turrets = level.turrets.map(() => ({ mode: 0, timer: 0, target: -1, aimX: 0, aimY: 0 }));
		for (let i = 0; i < MAX_BOLTS; i++)
			this.bolts.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
		this.shardTaken = shardsTaken ? shardsTaken.slice() : new Uint8Array(level.shards.length);

		// Resolve mechanism state for tick 0 so the first frame renders correctly.
		this.updatePower();
		this.updateDoors(true);
		this.updateLasers();
	}

	/** Advance one tick. `playerInput` is the live (or replayed) input bitmask for the player. */
	step(playerInput: number): void {
		const bodies = this.bodies;
		for (let i = 0; i < bodies.length; i++) {
			bodies[i].px = bodies[i].x;
			bodies[i].py = bodies[i].y;
		}
		this.updatePower();
		this.updateDoors(false);
		this.updateLasers();
		this.updateLifts();

		for (let i = 0; i < bodies.length; i++) {
			const b = bodies[i];
			if (!b.alive) continue;
			if (b.isGhost) {
				const rec = this.ghostInputs[b.id - 1];
				if (this.tick >= rec.length) {
					this.kill(b, DeathCause.Expired);
					continue;
				}
				b.input = rec[this.tick];
			} else {
				b.input = playerInput;
			}
			this.stepBody(b);
		}

		this.updateHazards();
		this.updatePlatesAndRelays();
		this.updateTurrets();
		this.updateBolts();
		this.updatePlayerPickups();
		this.tick++;
	}

	// ─── mechanisms ──────────────────────────────────────────────────────────

	private updatePower(): void {
		const { plates, relays } = this.level;
		this.power.fill(0);
		for (let i = 0; i < plates.length; i++) if (this.platePressed[i]) this.power[plates[i].ch] = 1;
		for (let i = 0; i < relays.length; i++)
			if (this.relayTimer[i] !== 0) this.power[relays[i].ch] = 1;
	}

	private updateDoors(initial: boolean): void {
		const defs = this.level.doors;
		for (let i = 0; i < defs.length; i++) {
			const d = defs[i];
			const s = this.doors[i];
			const wantOpen = (this.power[d.ch] === 1) !== d.invert;
			if (initial) {
				s.open = wantOpen;
				continue;
			}
			if (wantOpen) {
				if (!s.open) this.events.push(Ev.DoorOpen, d.x + d.w / 2, d.y + d.h / 2, -1, i);
				s.open = true;
				s.closeTimer = d.linger;
			} else if (s.open) {
				if (s.closeTimer > 0) s.closeTimer--;
				else if (!this.anyBodyIn(d)) {
					s.open = false;
					this.events.push(Ev.DoorClose, d.x + d.w / 2, d.y + d.h / 2, -1, i);
				}
			}
		}
	}

	private updateLasers(): void {
		const defs = this.level.lasers;
		for (let i = 0; i < defs.length; i++) {
			const l = defs[i];
			let on = true;
			if (l.period > 0) on = (this.tick + l.phase) % l.period < l.on;
			if (l.ch >= 0) {
				const powered = this.power[l.ch] === 1;
				on = on && (l.invert ? powered : !powered);
			}
			this.laserOn[i] = on ? 1 : 0;
		}
	}

	private updateLifts(): void {
		const defs = this.level.lifts;
		for (let i = 0; i < defs.length; i++) {
			const d = defs[i];
			const s = this.lifts[i];
			s.px = s.x;
			s.py = s.y;
			const powered = this.power[d.ch] === 1;
			const tx = powered ? d.x + d.dx : d.x;
			const ty = powered ? d.y + d.dy : d.y;
			s.x = approach(s.x, tx, d.speed);
			s.y = approach(s.y, ty, d.speed);
			const dx = s.x - s.px;
			const dy = s.y - s.py;
			if (dx === 0 && dy === 0) continue;
			// carry riders
			for (let j = 0; j < this.bodies.length; j++) {
				const b = this.bodies[j];
				if (!b.alive || b.lift !== i) continue;
				if (dx !== 0) this.moveX(b, dx);
				if (dy < 0) {
					// moveY clears ground state; a rider is still grounded (keeps jump/coyote valid)
					const grounded = b.onGround;
					this.moveY(b, dy);
					b.onGround = grounded;
					b.lift = i;
				} else if (dy > 0) b.y += dy; // follow downward; physics re-lands on the lift this tick
			}
		}
	}

	private updatePlatesAndRelays(): void {
		const { plates, relays } = this.level;
		for (let i = 0; i < plates.length; i++) {
			const p = plates[i];
			let by = -1;
			let ghost = 0;
			for (let j = 0; j < this.bodies.length; j++) {
				const b = this.bodies[j];
				if (b.alive && overlaps(p, b.x, b.y, b.w, b.h)) {
					if (by < 0 || b.isGhost) by = b.id;
					if (b.isGhost) ghost = 1;
				}
			}
			this.plateGhost[i] = ghost;
			const pressed = by >= 0 ? 1 : 0;
			if (pressed !== this.platePressed[i]) {
				this.events.push(pressed ? Ev.PlateOn : Ev.PlateOff, p.x + p.w / 2, p.y, by, i);
				this.plateBy[i] = by;
			}
			this.platePressed[i] = pressed;
		}
		for (let i = 0; i < relays.length; i++) {
			const r = relays[i];
			if (this.relayTimer[i] > 0) this.relayTimer[i]--;
			for (let j = 0; j < this.bodies.length; j++) {
				const b = this.bodies[j];
				if (!b.alive || !overlaps(r, b.x, b.y, b.w, b.h)) continue;
				if (this.relayTimer[i] === 0) {
					this.events.push(Ev.RelayOn, r.x + r.w / 2, r.y + r.h / 2, b.id, i);
					this.relayBy[i] = b.id;
				}
				this.relayTimer[i] = r.duration === 0 ? -1 : r.duration;
				break;
			}
		}
		// Coordination score: a channel counts as "assisted" when a ghost powers it while the player is
		// within reach of a door/lift/laser on that channel.
		this.accumulateAssists();
	}

	private accumulateAssists(): void {
		const p = this.player;
		if (!p.alive) return;
		const near = 5 * TILE;
		const { doors, lifts, lasers, plates, relays } = this.level;
		for (let ch = 0; ch < CHANNEL_COUNT; ch++) {
			if (!this.power[ch] || this.assistMask & (1 << ch)) continue;
			let ghostPowered = false;
			for (let i = 0; i < plates.length; i++)
				if (plates[i].ch === ch && this.plateGhost[i]) ghostPowered = true;
			for (let i = 0; i < relays.length; i++)
				if (relays[i].ch === ch && this.relayTimer[i] !== 0 && this.relayBy[i] > 0)
					ghostPowered = true;
			if (!ghostPowered) continue;
			const nearTo = (r: Rect) =>
				Math.abs(r.x + r.w / 2 - p.cx) < near + r.w / 2 &&
				Math.abs(r.y + r.h / 2 - p.cy) < near + r.h / 2;
			let benefits = false;
			for (const d of doors) if (d.ch === ch && nearTo(d)) benefits = true;
			for (const l of lifts) if (l.ch === ch && nearTo(l)) benefits = true;
			for (const l of lasers) if (l.ch === ch && nearTo(l)) benefits = true;
			if (benefits) this.assistMask |= 1 << ch;
		}
	}

	// ─── bodies ──────────────────────────────────────────────────────────────

	private stepBody(b: Body): void {
		const input = b.input;
		const dir = (input & IN_RIGHT ? 1 : 0) - (input & IN_LEFT ? 1 : 0);
		const jumpPressed = (input & IN_JUMP) !== 0 && (b.prevInput & IN_JUMP) === 0;
		const dashPressed = (input & IN_DASH) !== 0 && (b.prevInput & IN_DASH) === 0;
		b.prevInput = input;
		if (dir !== 0) b.facing = dir as 1 | -1;

		if (b.onGround) {
			b.coyote = PHYS.coyoteTicks;
			if (b.dashTicks === 0) b.dashReady = true;
		} else if (b.coyote > 0) b.coyote--;
		if (jumpPressed) b.jumpBuffer = PHYS.jumpBufferTicks;
		else if (b.jumpBuffer > 0) b.jumpBuffer--;
		if (b.dashCooldown > 0) b.dashCooldown--;

		if (dashPressed && b.dashReady && b.dashTicks === 0 && b.dashCooldown === 0) {
			b.dashTicks = PHYS.dashTicks;
			b.dashDir = dir !== 0 ? (dir as 1 | -1) : b.facing;
			b.facing = b.dashDir;
			b.dashReady = false;
			b.dashCooldown = PHYS.dashCooldown;
			this.events.push(Ev.Dash, b.cx, b.cy, b.id, b.dashDir);
		}

		if (b.dashTicks > 0) {
			b.vx = b.dashDir * PHYS.dashSpeed;
			b.vy = 0;
			b.dashTicks--;
			if (b.dashTicks === 0) b.vx = b.dashDir * PHYS.dashExitSpeed;
		} else {
			const target = dir * PHYS.runSpeed;
			if (dir !== 0) {
				// keep dash momentum briefly instead of snapping to run speed
				const over = Math.abs(b.vx) > PHYS.runSpeed && Math.sign(b.vx) === dir;
				const accel = over ? PHYS.airDecel : b.onGround ? PHYS.groundAccel : PHYS.airAccel;
				b.vx = approach(b.vx, target, accel);
			} else {
				b.vx = approach(b.vx, 0, b.onGround ? PHYS.groundDecel : PHYS.airDecel);
			}
			let g = PHYS.gravity;
			if (b.vy < 0 && (input & IN_JUMP) === 0) g *= PHYS.lowJumpGravityMul;
			b.vy = Math.min(b.vy + g, PHYS.maxFall);
		}

		if (b.jumpBuffer > 0 && (b.onGround || b.coyote > 0)) {
			b.vy = PHYS.jumpVelocity;
			b.jumpBuffer = 0;
			b.coyote = 0;
			b.onGround = false;
			b.lift = -1;
			b.jumpTick = this.tick;
			if (b.dashTicks > 0) {
				b.dashTicks = 0;
				b.vx = b.dashDir * PHYS.dashExitSpeed;
			}
			this.events.push(Ev.Jump, b.cx, b.y + b.h, b.id);
		}

		const wasGround = b.onGround;
		const fallSpeed = b.vy;
		this.moveX(b, b.vx);
		this.moveY(b, b.vy);
		if (b.onGround && !wasGround) {
			b.landTick = this.tick;
			this.events.push(Ev.Land, b.cx, b.y + b.h, b.id, Math.round(fallSpeed * 10));
		}
		if (b.y > this.level.height + FALL_MARGIN) this.kill(b, DeathCause.Fall);
	}

	private solidTile(c: number, r: number): boolean {
		return tileAt(this.level, c, r) === T_SOLID;
	}

	private moveX(b: Body, dx: number): void {
		if (dx === 0) return;
		b.x += dx;
		const r0 = Math.floor(b.y / TILE);
		const r1 = Math.floor((b.y + b.h - EPS) / TILE);
		if (dx > 0) {
			const c = Math.floor((b.x + b.w - EPS) / TILE);
			for (let r = r0; r <= r1; r++)
				if (this.solidTile(c, r)) {
					b.x = c * TILE - b.w;
					b.vx = 0;
					break;
				}
		} else {
			const c = Math.floor(b.x / TILE);
			for (let r = r0; r <= r1; r++)
				if (this.solidTile(c, r)) {
					b.x = (c + 1) * TILE;
					b.vx = 0;
					break;
				}
		}
		const doors = this.level.doors;
		for (let i = 0; i < doors.length; i++) {
			if (this.doors[i].open) continue;
			const d = doors[i];
			if (!overlaps(d, b.x, b.y, b.w, b.h)) continue;
			b.x = dx > 0 ? d.x - b.w : d.x + d.w;
			b.vx = 0;
		}
	}

	private moveY(b: Body, dy: number): void {
		const prevBottom = b.y + b.h;
		b.y += dy;
		b.onGround = false;
		b.lift = -1;
		const c0 = Math.floor(b.x / TILE);
		const c1 = Math.floor((b.x + b.w - EPS) / TILE);
		if (dy >= 0) {
			const bottom = b.y + b.h;
			const r = Math.floor((bottom - EPS) / TILE);
			for (let c = c0; c <= c1; c++) {
				const t = tileAt(this.level, c, r);
				if (t === T_SOLID || (t === T_ONEWAY && prevBottom <= r * TILE + EPS)) {
					this.land(b, r * TILE);
					break;
				}
			}
			// probe one unit below when not moving (e.g. dashing along the floor)
			if (dy === 0 && !b.onGround) {
				const rb = Math.floor((bottom + 0.5) / TILE);
				for (let c = c0; c <= c1; c++) {
					const t = tileAt(this.level, c, rb);
					if ((t === T_SOLID || t === T_ONEWAY) && Math.abs(rb * TILE - bottom) < 0.5)
						b.onGround = true;
				}
			}
			const doors = this.level.doors;
			for (let i = 0; i < doors.length; i++) {
				const d = doors[i];
				if (!this.doors[i].open && overlaps(d, b.x, b.y, b.w, b.h)) this.land(b, d.y);
			}
			const lifts = this.level.lifts;
			for (let i = 0; i < lifts.length; i++) {
				const l = this.lifts[i];
				const w = lifts[i].w;
				if (b.x >= l.x + w || b.x + b.w <= l.x) continue;
				const bottomNow = b.y + b.h;
				if (prevBottom <= Math.max(l.y, l.py) + EPS && bottomNow >= l.y) {
					this.land(b, l.y);
					b.lift = i;
				}
			}
		} else {
			const r = Math.floor(b.y / TILE);
			const hitLeft = this.solidTile(c0, r);
			const hitRight = c1 !== c0 && this.solidTile(c1, r);
			// Corner correction: if only one edge of the head clips a ceiling corner by a few units,
			// slide the body sideways instead of killing the jump. Forgiving controls, same levels.
			const leftOverlap = (c0 + 1) * TILE - b.x;
			const rightOverlap = b.x + b.w - c1 * TILE;
			if (
				hitLeft &&
				!hitRight &&
				c1 !== c0 &&
				leftOverlap <= CORNER_NUDGE &&
				!this.solidTile(c1, r)
			) {
				b.x = (c0 + 1) * TILE;
			} else if (hitRight && !hitLeft && rightOverlap <= CORNER_NUDGE) {
				b.x = c1 * TILE - b.w;
			} else if (hitLeft || hitRight) {
				b.y = (r + 1) * TILE;
				b.vy = 0;
			}
			const doors = this.level.doors;
			for (let i = 0; i < doors.length; i++) {
				const d = doors[i];
				if (!this.doors[i].open && overlaps(d, b.x, b.y, b.w, b.h)) {
					b.y = d.y + d.h;
					b.vy = 0;
				}
			}
		}
	}

	private land(b: Body, surfaceY: number): void {
		b.y = surfaceY - b.h;
		b.vy = 0;
		b.onGround = true;
	}

	private anyBodyIn(r: Rect): boolean {
		for (let j = 0; j < this.bodies.length; j++) {
			const b = this.bodies[j];
			if (b.alive && overlaps(r, b.x, b.y, b.w, b.h)) return true;
		}
		return false;
	}

	kill(b: Body, cause: DeathCause): void {
		if (!b.alive) return;
		b.alive = false;
		b.cause = cause;
		b.deathTick = this.tick;
		this.events.push(
			cause === DeathCause.Expired ? Ev.GhostExpire : Ev.Death,
			b.cx,
			b.cy,
			b.id,
			cause
		);
	}

	// ─── hazards & enemies ───────────────────────────────────────────────────

	private updateHazards(): void {
		const lvl = this.level;
		for (let j = 0; j < this.bodies.length; j++) {
			const b = this.bodies[j];
			if (!b.alive) continue;
			// spikes: smaller hitbox than the tile so near-misses feel fair
			const c0 = Math.floor(b.x / TILE);
			const c1 = Math.floor((b.x + b.w - EPS) / TILE);
			const r0 = Math.floor(b.y / TILE);
			const r1 = Math.floor((b.y + b.h - EPS) / TILE);
			outer: for (let r = r0; r <= r1; r++)
				for (let c = c0; c <= c1; c++) {
					const t = tileAt(lvl, c, r);
					if (t !== T_SPIKE_UP && t !== T_SPIKE_DOWN) continue;
					const hy = t === T_SPIKE_UP ? r * TILE + 9 : r * TILE;
					if (
						b.x < c * TILE + TILE - 3 &&
						b.x + b.w > c * TILE + 3 &&
						b.y < hy + 7 &&
						b.y + b.h > hy
					) {
						this.kill(b, DeathCause.Spike);
						break outer;
					}
				}
			if (!b.alive) continue;
			for (let i = 0; i < lvl.lasers.length; i++) {
				if (this.laserOn[i] && overlaps(lvl.lasers[i], b.x + 1, b.y + 1, b.w - 2, b.h - 2)) {
					this.kill(b, DeathCause.Laser);
					break;
				}
			}
		}
	}

	/** Deterministic line-of-sight: sample the segment every 4 units against solid tiles and closed doors. */
	lineOfSight(ax: number, ay: number, bx: number, by: number): boolean {
		const dx = bx - ax;
		const dy = by - ay;
		const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4);
		const doors = this.level.doors;
		for (let i = 1; i < steps; i++) {
			const x = ax + (dx * i) / steps;
			const y = ay + (dy * i) / steps;
			if (this.solidTile(Math.floor(x / TILE), Math.floor(y / TILE))) return false;
			for (let d = 0; d < doors.length; d++) {
				const r = doors[d];
				if (!this.doors[d].open && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
					return false;
			}
		}
		return true;
	}

	private updateTurrets(): void {
		const defs = this.level.turrets;
		for (let i = 0; i < defs.length; i++) {
			const d = defs[i];
			const s = this.turrets[i];
			if (s.mode === 0) {
				// acquire the nearest visible body — ghosts included, which is what makes decoys work
				let best = -1;
				let bestD = d.range * d.range;
				for (let j = 0; j < this.bodies.length; j++) {
					const b = this.bodies[j];
					if (!b.alive) continue;
					const dx = b.cx - d.x;
					const dy = b.cy - d.y;
					const dist = dx * dx + dy * dy;
					if (dist < bestD && this.lineOfSight(d.x, d.y, b.cx, b.cy)) {
						bestD = dist;
						best = j;
					}
				}
				if (best >= 0) {
					s.mode = 1;
					s.timer = TURRET_CHARGE;
					s.target = best;
					s.aimX = this.bodies[best].cx;
					s.aimY = this.bodies[best].cy;
					this.events.push(Ev.TurretLock, d.x, d.y, this.bodies[best].id, i);
				}
			} else if (s.mode === 1) {
				const b = this.bodies[s.target];
				const dx = b.cx - d.x;
				const dy = b.cy - d.y;
				const lost =
					!b.alive ||
					dx * dx + dy * dy > d.range * d.range * 1.44 ||
					!this.lineOfSight(d.x, d.y, b.cx, b.cy);
				if (lost) {
					s.mode = 0;
					s.target = -1;
					continue;
				}
				// lead the target by the bolt's flight time: running in a straight line is not enough,
				// changing pace or jumping at the right moment is
				const flight = Math.sqrt(dx * dx + dy * dy) / BOLT_SPEED;
				s.aimX = b.cx + b.vx * flight;
				s.aimY = b.cy;
				if (--s.timer <= 0) {
					this.fireBolt(d.x, d.y, s.aimX, s.aimY);
					this.events.push(Ev.TurretFire, d.x, d.y, b.id, i);
					// an echo drawing fire while the player is in the Warden's reach counts as coordination
					const p = this.player;
					const px = p.cx - d.x;
					const py = p.cy - d.y;
					if (b.isGhost && p.alive && px * px + py * py < d.range * d.range * 2.25)
						this.assistMask |= 1 << (8 + Math.min(i, 15));
					s.mode = 2;
					s.timer = TURRET_COOLDOWN;
				}
			} else if (--s.timer <= 0) {
				s.mode = 0;
				s.target = -1;
			}
		}
	}

	private fireBolt(x: number, y: number, tx: number, ty: number): void {
		const dx = tx - x;
		const dy = ty - y;
		const len = Math.sqrt(dx * dx + dy * dy) || 1;
		for (const bolt of this.bolts) {
			if (bolt.alive) continue;
			bolt.alive = true;
			bolt.x = x;
			bolt.y = y;
			bolt.vx = (dx / len) * BOLT_SPEED;
			bolt.vy = (dy / len) * BOLT_SPEED;
			bolt.life = BOLT_LIFE;
			return;
		}
	}

	private updateBolts(): void {
		const doors = this.level.doors;
		for (const bolt of this.bolts) {
			if (!bolt.alive) continue;
			bolt.x += bolt.vx;
			bolt.y += bolt.vy;
			let hit =
				--bolt.life <= 0 || this.solidTile(Math.floor(bolt.x / TILE), Math.floor(bolt.y / TILE));
			for (let d = 0; d < doors.length && !hit; d++) {
				const r = doors[d];
				if (
					!this.doors[d].open &&
					bolt.x >= r.x &&
					bolt.x < r.x + r.w &&
					bolt.y >= r.y &&
					bolt.y < r.y + r.h
				)
					hit = true;
			}
			if (hit) {
				bolt.alive = false;
				this.events.push(Ev.BoltHit, bolt.x, bolt.y, -1);
				continue;
			}
			for (let j = 0; j < this.bodies.length; j++) {
				const b = this.bodies[j];
				if (!b.alive) continue;
				if (
					bolt.x > b.x - 2 &&
					bolt.x < b.x + b.w + 2 &&
					bolt.y > b.y - 2 &&
					bolt.y < b.y + b.h + 2
				) {
					bolt.alive = false;
					this.kill(b, DeathCause.Bolt);
					break;
				}
			}
		}
	}

	private updatePlayerPickups(): void {
		const p = this.player;
		if (!p.alive) return;
		const shards = this.level.shards;
		for (let i = 0; i < shards.length; i++) {
			if (this.shardTaken[i] || !overlaps(shards[i], p.x, p.y, p.w, p.h)) continue;
			this.shardTaken[i] = 1;
			this.events.push(Ev.Shard, shards[i].x + 4, shards[i].y + 4, 0, i);
		}
		if (!this.exitReached && overlaps(this.level.exit, p.x, p.y, p.w, p.h)) {
			this.exitReached = true;
			this.events.push(Ev.Exit, p.cx, p.cy, 0);
		}
	}

	/** Cheap state fingerprint for determinism tests. */
	hash(): string {
		let s = `${this.tick}|`;
		for (const b of this.bodies) s += `${b.x},${b.y},${b.vx},${b.vy},${b.alive ? 1 : 0};`;
		s += Array.from(this.power).join('');
		s += `|${this.assistMask}`;
		return s;
	}
}
