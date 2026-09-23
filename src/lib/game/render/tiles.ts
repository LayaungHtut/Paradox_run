import { TILE } from '../core/constants';
import { inView, type DrawContext } from './draw-context';
import type { LevelGeometry } from './geometry';
import { PAL } from './palette';

/*
 * Static level geometry. Merged runs (see geometry.ts) keep this to a few dozen fills per frame.
 * Visual hierarchy: walkable top edges carry the level's accent light (what you can stand on reads
 * first), side walls are dim, interiors are near-black panels.
 */

export function makePanelPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
	const c = document.createElement('canvas');
	c.width = c.height = 32;
	const g = c.getContext('2d');
	if (!g) return null;
	// two 16×16 panels per row, offset every other row (brick bond) with faint bevels
	for (let row = 0; row < 2; row++) {
		for (let col = -1; col < 2; col++) {
			const x = col * 16 + (row % 2) * 8;
			const y = row * 16;
			g.fillStyle = 'rgba(255,255,255,0.014)';
			g.fillRect(x + 1, y + 1, 14, 1);
			g.fillRect(x + 1, y + 1, 1, 14);
			g.fillStyle = 'rgba(0,0,0,0.12)';
			g.fillRect(x + 1, y + 15, 15, 1);
			g.fillRect(x + 15, y + 1, 1, 15);
		}
	}
	return ctx.createPattern(c, 'repeat');
}

export function drawTiles(d: DrawContext, g: LevelGeometry, panel: CanvasPattern | null): void {
	const { ctx, camera: cam, level, theme } = d;

	// bedrock below the level, visible when the camera is padded for touch controls
	ctx.fillStyle = theme.solid;
	if (cam.bottomPad > 0) ctx.fillRect(cam.x - 8, level.height, cam.viewW + 16, cam.bottomPad + 16);

	for (const r of g.solids) if (inView(cam, r.x, r.y, r.w, r.h)) ctx.fillRect(r.x, r.y, r.w, r.h);
	if (panel) {
		ctx.fillStyle = panel;
		for (const r of g.solids) if (inView(cam, r.x, r.y, r.w, r.h)) ctx.fillRect(r.x, r.y, r.w, r.h);
	}

	// dim side and underside edges
	ctx.fillStyle = PAL.edgeSide;
	for (const r of g.sideEdges)
		if (inView(cam, r.x, r.y, r.w, r.h)) ctx.fillRect(r.x, r.y, r.w, r.h);
	for (const r of g.bottomEdges)
		if (inView(cam, r.x, r.y, r.w, r.h)) ctx.fillRect(r.x, r.y, r.w, r.h);

	// walkable top edges: a bright lip plus a soft accent glow bleeding into the block
	for (const r of g.topEdges) {
		if (!inView(cam, r.x, r.y, r.w, r.h)) continue;
		ctx.fillStyle = theme.accent;
		ctx.globalAlpha = 0.1;
		ctx.fillRect(r.x, r.y, r.w, 5);
		ctx.globalAlpha = 0.55;
		ctx.fillRect(r.x, r.y, r.w, 1);
		ctx.globalAlpha = 1;
		ctx.fillStyle = PAL.edgeTop;
		ctx.fillRect(r.x, r.y + 1, r.w, 1);
		// seam notches every three tiles give the surface scale
		ctx.fillStyle = 'rgba(0,0,0,0.35)';
		for (let x = r.x + 3 * TILE; x < r.x + r.w - 4; x += 3 * TILE) ctx.fillRect(x, r.y, 1, 3);
	}

	drawOneways(d, g);
	drawSpikes(d, g);
}

function drawOneways(d: DrawContext, g: LevelGeometry): void {
	const { ctx, camera: cam, theme } = d;
	for (const r of g.oneways) {
		if (!inView(cam, r.x, r.y, r.w, 8)) continue;
		ctx.fillStyle = PAL.oneway;
		ctx.fillRect(r.x, r.y, r.w, 3);
		ctx.fillStyle = theme.accent;
		ctx.globalAlpha = 0.45;
		ctx.fillRect(r.x, r.y, r.w, 0.8);
		ctx.globalAlpha = 0.35;
		ctx.fillStyle = PAL.oneway;
		// grating underneath: you can jump up through it
		for (let x = r.x + 2; x < r.x + r.w - 1; x += 4) ctx.fillRect(x, r.y + 3, 1.5, 3);
		ctx.globalAlpha = 1;
	}
}

function drawSpikes(d: DrawContext, g: LevelGeometry): void {
	const { ctx, camera: cam } = d;
	const flicker = 0.8 + 0.2 * Math.sin(d.time * 5);
	// glow strip under each spike row
	ctx.fillStyle = PAL.hazard;
	ctx.globalAlpha = 0.14 * flicker;
	for (const s of g.spikesUp)
		if (inView(cam, s.x, s.y, TILE, TILE)) ctx.fillRect(s.x, s.y + 6, TILE, TILE - 6);
	for (const s of g.spikesDown)
		if (inView(cam, s.x, s.y, TILE, TILE)) ctx.fillRect(s.x, s.y, TILE, TILE - 6);
	ctx.globalAlpha = 1;
	// crystal shards: dark body, bright leading edge
	for (const pass of [0, 1]) {
		ctx.fillStyle = pass === 0 ? '#a3243a' : PAL.hazard;
		ctx.beginPath();
		for (const s of g.spikesUp) {
			if (!inView(cam, s.x, s.y, TILE, TILE)) continue;
			for (let k = 0; k < 2; k++) {
				const bx = s.x + 1 + k * 7;
				ctx.moveTo(bx, s.y + TILE);
				ctx.lineTo(bx + 3.5, s.y + 7);
				ctx.lineTo(pass === 0 ? bx + 7 : bx + 3.5, s.y + TILE);
			}
		}
		for (const s of g.spikesDown) {
			if (!inView(cam, s.x, s.y, TILE, TILE)) continue;
			for (let k = 0; k < 2; k++) {
				const bx = s.x + 1 + k * 7;
				ctx.moveTo(bx, s.y);
				ctx.lineTo(bx + 3.5, s.y + 9);
				ctx.lineTo(pass === 0 ? bx + 7 : bx + 3.5, s.y);
			}
		}
		ctx.fill();
	}
}
