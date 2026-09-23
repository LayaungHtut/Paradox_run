import { TILE } from '../core/constants';
import type { LevelData } from '../levels/parse';
import type { World } from '../sim/world';
import { inView, type DrawContext } from './draw-context';
import { CHANNEL_COLORS, CHANNEL_GLYPHS, PAL, PC } from './palette';

/*
 * Interactive objects. Rules of the visual language:
 *  - every channel object shows its colour AND its letter (never colour alone);
 *  - powered = bright + glow, idle = dim steel;
 *  - hazards are always coral; echo-caused activity gets a cyan temporal link.
 */

const TURRET_CHARGE_TICKS = 48;

export class MechanismLayer {
	/** eased open amount per gate, 0 closed → 1 open (visual only) */
	private gateOpen = new Float32Array(0);

	reset(level: LevelData, world: World): void {
		this.gateOpen = new Float32Array(level.doors.length);
		for (let i = 0; i < world.doors.length; i++) this.gateOpen[i] = world.doors[i].open ? 1 : 0;
	}

	drawBehindActors(d: DrawContext): void {
		drawSigns(d);
		drawExit(d);
		drawShards(d);
		this.drawGates(d);
		drawPlates(d);
		drawRelays(d);
		drawLifts(d);
		drawLasers(d);
		drawLinks(d);
		drawTurrets(d);
	}

	private drawGates(d: DrawContext): void {
		const { ctx, camera: cam, level, world: w } = d;
		for (let i = 0; i < level.doors.length; i++) {
			const g = level.doors[i];
			const target = w.doors[i].open ? 1 : 0;
			this.gateOpen[i] += (target - this.gateOpen[i]) * Math.min(1, d.dt * 16);
			if (!inView(cam, g.x - 4, g.y - 4, g.w + 8, g.h + 8)) continue;
			const col = CHANNEL_COLORS[g.ch];
			const open = this.gateOpen[i];
			// posts
			ctx.fillStyle = PAL.mechDark;
			ctx.fillRect(g.x - 2, g.y, 2, g.h);
			ctx.fillRect(g.x + g.w, g.y, 2, g.h);
			ctx.fillStyle = col;
			ctx.globalAlpha = 0.5 + 0.5 * open;
			ctx.fillRect(g.x - 2, g.y, 2, 2);
			ctx.fillRect(g.x + g.w, g.y, 2, 2);
			// barrier: bright vertical beams + a translucent field, retracting upward when open
			const shown = g.h * (1 - open);
			if (shown > 0.5) {
				ctx.globalAlpha = 0.22;
				ctx.fillRect(g.x, g.y, g.w, shown);
				ctx.globalAlpha = 0.9;
				const phase = (d.time * 30) % 6;
				for (let bx = g.x + 1.5; bx < g.x + g.w - 1; bx += 3.5) ctx.fillRect(bx, g.y, 0.8, shown);
				ctx.globalAlpha = 0.5;
				for (let y = g.y + phase; y < g.y + shown - 1; y += 6) ctx.fillRect(g.x, y, g.w, 0.8);
				ctx.globalAlpha = 1;
				ctx.fillRect(g.x - 1, g.y + shown - 1.2, g.w + 2, 1.2);
			}
			ctx.globalAlpha = 1;
			glyph(ctx, g.ch, g.x + g.w / 2, g.y - 5, open > 0.5);
		}
	}
}

function glyph(
	ctx: CanvasRenderingContext2D,
	ch: number,
	x: number,
	y: number,
	lit: boolean
): void {
	ctx.font = '800 5px ui-sans-serif, system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = CHANNEL_COLORS[ch];
	ctx.globalAlpha = lit ? 1 : 0.65;
	ctx.fillText(CHANNEL_GLYPHS[ch], x, y);
	ctx.globalAlpha = 1;
}

function drawSigns(d: DrawContext): void {
	const { ctx, camera: cam, level } = d;
	if (!level.signs.length) return;
	ctx.font = '600 6px ui-sans-serif, system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	for (const s of level.signs) {
		const x = s.x * TILE + TILE / 2;
		const y = s.y * TILE + TILE / 2;
		if (!inView(cam, x - 90, y - 8, 180, 16)) continue;
		// a holographic plaque: faint accent underline, gently breathing text
		ctx.fillStyle = d.theme.accent;
		ctx.globalAlpha = 0.12;
		const wText = Math.min(170, s.text.length * 3.4);
		ctx.fillRect(x - wText / 2, y + 4, wText, 0.8);
		ctx.globalAlpha = 0.78 + Math.sin(d.time * 1.3 + s.x) * 0.1;
		ctx.fillStyle = PAL.sign;
		ctx.fillText(s.text, x, y);
	}
	ctx.globalAlpha = 1;
}

function drawExit(d: DrawContext): void {
	const { ctx, camera: cam, level, particles } = d;
	const e = level.exit;
	if (!inView(cam, e.x, e.y - 30, e.w, e.h + 30)) return;
	const cx = e.x + e.w / 2;
	const cy = e.y + e.h / 2;
	const pulse = 0.5 + Math.sin(d.time * 3) * 0.5;
	// light well
	ctx.fillStyle = PAL.exit;
	ctx.globalAlpha = 0.08 + pulse * 0.05;
	ctx.fillRect(e.x + 3, e.y - 24, e.w - 6, e.h + 24);
	ctx.globalAlpha = 0.18;
	ctx.fillRect(e.x + 6, e.y, e.w - 12, e.h);
	// rotating ring
	ctx.globalAlpha = 0.85;
	ctx.strokeStyle = PAL.exit;
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	const a = d.time * 1.6;
	ctx.arc(cx, cy, 9, a, a + Math.PI * 1.3);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(cx, cy, 6, -a * 1.4, -a * 1.4 + Math.PI);
	ctx.stroke();
	// frame
	ctx.globalAlpha = 1;
	ctx.fillRect(e.x + 2, e.y, 2, e.h);
	ctx.fillRect(e.x + e.w - 4, e.y, 2, e.h);
	if (Math.random() < 0.3 * particles.budget)
		particles.spawn(
			e.x + 5 + Math.random() * (e.w - 10),
			e.y + e.h,
			0,
			-14 - Math.random() * 10,
			1.4,
			1.2,
			PC.exit
		);
}

function drawShards(d: DrawContext): void {
	const { ctx, camera: cam, level, world } = d;
	for (let i = 0; i < level.shards.length; i++) {
		if (world.shardTaken[i]) continue;
		const s = level.shards[i];
		if (!inView(cam, s.x, s.y, s.w, s.h)) continue;
		const cx = s.x + 4;
		const cy = s.y + 4 + Math.sin(d.time * 2.4 + i) * 1.5;
		const spin = Math.abs(Math.cos(d.time * 1.8 + i));
		ctx.fillStyle = PAL.shard;
		ctx.globalAlpha = 0.18 + 0.08 * Math.sin(d.time * 4 + i);
		ctx.beginPath();
		ctx.arc(cx, cy, 7, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalAlpha = 1;
		ctx.beginPath();
		ctx.moveTo(cx, cy - 5);
		ctx.lineTo(cx + 3.5 * spin + 0.5, cy);
		ctx.lineTo(cx, cy + 5);
		ctx.lineTo(cx - 3.5 * spin - 0.5, cy);
		ctx.closePath();
		ctx.fill();
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(cx - 0.5, cy - 3, 1, 2);
	}
}

function drawPlates(d: DrawContext): void {
	const { ctx, camera: cam, level, world: w } = d;
	for (let i = 0; i < level.plates.length; i++) {
		const p = level.plates[i];
		if (!inView(cam, p.x, p.y - 8, p.w, 12)) continue;
		const on = w.platePressed[i] === 1;
		const col = CHANNEL_COLORS[p.ch];
		// housing
		ctx.fillStyle = PAL.mechDark;
		ctx.fillRect(p.x - 1, p.y + 1, p.w + 2, 3);
		// the plate itself sinks 1.5 units when weighted
		ctx.fillStyle = on ? col : PAL.mechIdle;
		ctx.fillRect(p.x + 1, on ? p.y + 1.5 : p.y, p.w - 2, 2);
		ctx.fillStyle = col;
		if (on) {
			ctx.globalAlpha = 0.16 + 0.05 * Math.sin(d.time * 8);
			ctx.fillRect(p.x, p.y - 10, p.w, 10);
		} else {
			ctx.globalAlpha = 0.7;
			ctx.fillRect(p.x + 2, p.y + 0.5, 2, 1);
			ctx.fillRect(p.x + p.w - 4, p.y + 0.5, 2, 1);
		}
		ctx.globalAlpha = 1;
		glyph(ctx, p.ch, p.x + p.w / 2, p.y - 4, on);
	}
}

function drawRelays(d: DrawContext): void {
	const { ctx, camera: cam, level, world: w } = d;
	for (let i = 0; i < level.relays.length; i++) {
		const r = level.relays[i];
		if (!inView(cam, r.x - 6, r.y - 6, r.w + 12, r.h + 12)) continue;
		const timer = w.relayTimer[i];
		const on = timer !== 0;
		const col = CHANNEL_COLORS[r.ch];
		const cx = r.x + r.w / 2;
		const cy = r.y + 4;
		ctx.fillStyle = PAL.mechDark;
		ctx.fillRect(cx - 1.5, r.y + 6, 3, r.h - 6);
		ctx.fillRect(cx - 4, r.y + r.h - 2, 8, 2);
		ctx.strokeStyle = on ? col : PAL.mechIdle;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
		ctx.stroke();
		if (on) {
			ctx.fillStyle = col;
			ctx.globalAlpha = 0.2;
			ctx.beginPath();
			ctx.arc(cx, cy, 8, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
			ctx.beginPath();
			ctx.arc(cx, cy, 2, 0, Math.PI * 2);
			ctx.fill();
			if (timer > 0) {
				// countdown ring: how long the switch stays on
				ctx.beginPath();
				ctx.arc(cx, cy, 6, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * timer) / r.duration);
				ctx.stroke();
			}
		}
		glyph(ctx, r.ch, cx, r.y - 7, on);
	}
}

function drawLifts(d: DrawContext): void {
	const { ctx, camera: cam, level, world: w, alpha } = d;
	for (let i = 0; i < level.lifts.length; i++) {
		const def = level.lifts[i];
		const s = w.lifts[i];
		const x = s.px + (s.x - s.px) * alpha;
		const y = s.py + (s.y - s.py) * alpha;
		const col = CHANNEL_COLORS[def.ch];
		const powered = w.power[def.ch] === 1;
		// rail showing where the lift will travel
		ctx.strokeStyle = col;
		ctx.globalAlpha = 0.25;
		ctx.lineWidth = 1;
		ctx.setLineDash([2, 3]);
		ctx.beginPath();
		ctx.moveTo(def.x + def.w / 2, def.y + 3);
		ctx.lineTo(def.x + def.dx + def.w / 2, def.y + def.dy + 3);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.globalAlpha = 1;
		if (!inView(cam, x, y - 8, def.w, def.h + 8)) continue;
		ctx.fillStyle = '#2b3754';
		ctx.fillRect(x, y, def.w, def.h);
		ctx.fillStyle = powered ? col : PAL.mechIdle;
		ctx.fillRect(x, y, def.w, 1.5);
		ctx.fillRect(x + 2, y + def.h - 1.5, def.w - 4, 1.5);
		if (powered) {
			ctx.globalAlpha = 0.15;
			ctx.fillRect(x, y + def.h, def.w, 6);
			ctx.globalAlpha = 1;
		}
		glyph(ctx, def.ch, x + def.w / 2, y + def.h / 2 + 0.3, powered);
	}
}

function drawLasers(d: DrawContext): void {
	const { ctx, camera: cam, level, world: w } = d;
	for (let i = 0; i < level.lasers.length; i++) {
		const l = level.lasers[i];
		if (!inView(cam, l.x - 4, l.y - 4, l.w + 8, l.h + 8)) continue;
		const on = w.laserOn[i] === 1;
		ctx.fillStyle = l.ch >= 0 ? CHANNEL_COLORS[l.ch] : PAL.mechIdle;
		if (l.vertical) {
			ctx.fillRect(l.x - 3, l.y, l.w + 6, 3);
			ctx.fillRect(l.x - 3, l.y + l.h - 3, l.w + 6, 3);
		} else {
			ctx.fillRect(l.x, l.y - 3, 3, l.h + 6);
			ctx.fillRect(l.x + l.w - 3, l.y - 3, 3, l.h + 6);
		}
		if (l.ch >= 0)
			glyph(
				ctx,
				l.ch,
				l.vertical ? l.x + l.w / 2 : l.x - 5,
				l.vertical ? l.y - 5 : l.y + l.h / 2,
				!on
			);
		if (on) {
			const flick = 0.75 + Math.sin(d.time * 40 + i) * 0.25;
			ctx.fillStyle = PAL.hazard;
			ctx.globalAlpha = 0.25 * flick;
			if (l.vertical) ctx.fillRect(l.x - 3, l.y, l.w + 6, l.h);
			else ctx.fillRect(l.x, l.y - 3, l.w, l.h + 6);
			ctx.globalAlpha = 1;
			ctx.fillStyle = '#ffd0d5';
			if (l.vertical) ctx.fillRect(l.x + 1.2, l.y, l.w - 2.4, l.h);
			else ctx.fillRect(l.x, l.y + 1.2, l.w, l.h - 2.4);
		} else {
			// warn shortly before a timed beam switches on
			let warn = false;
			if (l.period > 0) {
				const phase = (w.tick + l.phase) % l.period;
				warn = l.period - phase < 24 && (l.ch < 0 || !w.power[l.ch] !== l.invert);
			}
			ctx.fillStyle = PAL.hazard;
			ctx.globalAlpha = warn ? 0.4 + Math.sin(d.time * 50) * 0.3 : 0.12;
			if (l.vertical) for (let y = l.y; y < l.y + l.h; y += 4) ctx.fillRect(l.x + 1.5, y, 1, 2);
			else for (let x = l.x; x < l.x + l.w; x += 4) ctx.fillRect(x, l.y + 1.5, 2, 1);
			ctx.globalAlpha = 1;
		}
	}
}

/** Dashed temporal link from a ghost-powered plate/relay to whatever it controls: "your echo did this". */
function drawLinks(d: DrawContext): void {
	const { ctx, level, world: w } = d;
	ctx.lineWidth = 0.8;
	ctx.setLineDash([3, 3]);
	ctx.lineDashOffset = -d.time * 12;
	ctx.strokeStyle = PAL.ghost;
	for (let i = 0; i < level.plates.length; i++) {
		if (!w.plateGhost[i]) continue;
		const p = level.plates[i];
		linkTargets(d, p.ch, p.x + p.w / 2, p.y);
	}
	for (let i = 0; i < level.relays.length; i++) {
		if (w.relayTimer[i] === 0 || w.relayBy[i] <= 0) continue;
		const r = level.relays[i];
		linkTargets(d, r.ch, r.x + r.w / 2, r.y + 4);
	}
	ctx.setLineDash([]);
	ctx.globalAlpha = 1;
}

function linkTargets(d: DrawContext, ch: number, x: number, y: number): void {
	const { ctx, level } = d;
	ctx.globalAlpha = 0.4 + Math.sin(d.time * 4) * 0.12;
	ctx.beginPath();
	const to = (tx: number, ty: number) => {
		ctx.moveTo(x, y);
		ctx.quadraticCurveTo((x + tx) / 2, Math.min(y, ty) - 24, tx, ty);
	};
	for (const g of level.doors) if (g.ch === ch) to(g.x + g.w / 2, g.y);
	for (const l of level.lifts) if (l.ch === ch) to(l.x + l.w / 2, l.y);
	for (const l of level.lasers) if (l.ch === ch) to(l.x + l.w / 2, l.y);
	ctx.stroke();
}

function drawTurrets(d: DrawContext): void {
	const { ctx, camera: cam, level, world: w } = d;
	for (let i = 0; i < level.turrets.length; i++) {
		const t = level.turrets[i];
		const s = w.turrets[i];
		if (!inView(cam, t.x - t.range, t.y - t.range, t.range * 2, t.range * 2)) continue;
		if (s.mode === 1) {
			// sight line thickens as the shot charges: readable, dodgeable
			const k = 1 - s.timer / TURRET_CHARGE_TICKS;
			ctx.strokeStyle = PAL.hazard;
			ctx.globalAlpha = 0.2 + k * 0.6;
			ctx.lineWidth = 0.6 + k;
			ctx.beginPath();
			ctx.moveTo(t.x, t.y);
			ctx.lineTo(s.aimX, s.aimY);
			ctx.stroke();
			ctx.globalAlpha = 0.25 * k;
			ctx.fillStyle = PAL.hazard;
			ctx.beginPath();
			ctx.arc(s.aimX, s.aimY, 3 + 3 * (1 - k), 0, Math.PI * 2);
			ctx.fill();
		} else if (s.mode === 0) {
			ctx.strokeStyle = PAL.hazard;
			ctx.globalAlpha = 0.08;
			ctx.lineWidth = 1;
			ctx.setLineDash([4, 4]);
			ctx.lineDashOffset = d.time * 6;
			ctx.beginPath();
			ctx.arc(t.x, t.y, t.range, 0, Math.PI * 2);
			ctx.stroke();
			ctx.setLineDash([]);
		}
		ctx.globalAlpha = 1;
		// mount + dome
		ctx.fillStyle = PAL.mechDark;
		ctx.beginPath();
		ctx.arc(t.x, t.y, 6.5, 0, Math.PI * 2);
		ctx.fill();
		const angle =
			s.mode === 1
				? Math.atan2(s.aimY - t.y, s.aimX - t.x)
				: Math.PI / 2 + Math.sin(d.time * 0.8 + i) * 0.6;
		ctx.save();
		ctx.translate(t.x, t.y);
		ctx.rotate(angle);
		ctx.fillStyle = '#2b3754';
		ctx.fillRect(-3, -3, 11, 6);
		ctx.fillStyle = s.mode === 2 ? PAL.mechIdle : PAL.hazard;
		ctx.fillRect(6, -1.5, 3, 3);
		ctx.restore();
		// the eye: coral while hunting or charging, dark while reloading
		ctx.fillStyle = s.mode === 2 ? PAL.mechIdle : PAL.hazard;
		ctx.globalAlpha = s.mode === 1 ? 1 : 0.7;
		ctx.beginPath();
		ctx.arc(t.x, t.y, 2.4, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalAlpha = 1;
	}
}

export function drawBolts(d: DrawContext): void {
	const { ctx, world, alpha } = d;
	for (const b of world.bolts) {
		if (!b.alive) continue;
		const x = b.x - b.vx * (1 - alpha);
		const y = b.y - b.vy * (1 - alpha);
		ctx.strokeStyle = PAL.hazard;
		ctx.globalAlpha = 0.5;
		ctx.lineWidth = 2.2;
		ctx.beginPath();
		ctx.moveTo(x - b.vx * 3, y - b.vy * 3);
		ctx.lineTo(x, y);
		ctx.stroke();
		ctx.globalAlpha = 1;
		ctx.fillStyle = '#ffe0e4';
		ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
	}
}
