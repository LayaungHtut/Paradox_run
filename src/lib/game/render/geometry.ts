import { TILE } from '../core/constants';
import {
	T_ONEWAY,
	T_SOLID,
	T_SPIKE_DOWN,
	T_SPIKE_UP,
	type LevelData,
	type Rect
} from '../levels/parse';

/**
 * Static level geometry, merged into as few rectangles/segments as possible once at load time so each
 * frame issues a handful of draw calls instead of one per tile.
 */
export interface LevelGeometry {
	solids: Rect[];
	topEdges: Rect[];
	sideEdges: Rect[];
	bottomEdges: Rect[];
	oneways: Rect[];
	spikesUp: { x: number; y: number }[];
	spikesDown: { x: number; y: number }[];
}

export function buildGeometry(lvl: LevelData): LevelGeometry {
	const { cols, rows, tiles } = lvl;
	const t = (c: number, r: number) =>
		c < 0 || c >= cols || r < 0 || r >= rows ? T_SOLID : tiles[r * cols + c];
	const g: LevelGeometry = {
		solids: [],
		topEdges: [],
		sideEdges: [],
		bottomEdges: [],
		oneways: [],
		spikesUp: [],
		spikesDown: []
	};

	for (let r = 0; r < rows; r++) {
		let c = 0;
		while (c < cols) {
			const kind = tiles[r * cols + c];
			if (kind === T_SOLID || kind === T_ONEWAY) {
				let e = c;
				while (e + 1 < cols && tiles[r * cols + e + 1] === kind) e++;
				(kind === T_SOLID ? g.solids : g.oneways).push({
					x: c * TILE,
					y: r * TILE,
					w: (e - c + 1) * TILE,
					h: kind === T_SOLID ? TILE : 4
				});
				c = e + 1;
				continue;
			}
			if (kind === T_SPIKE_UP) g.spikesUp.push({ x: c * TILE, y: r * TILE });
			if (kind === T_SPIKE_DOWN) g.spikesDown.push({ x: c * TILE, y: r * TILE });
			c++;
		}
		// exposed top / bottom faces, merged horizontally
		for (const [list, dr] of [
			[g.topEdges, -1],
			[g.bottomEdges, 1]
		] as const) {
			let start = -1;
			for (let cc = 0; cc <= cols; cc++) {
				const exposed =
					cc < cols &&
					t(cc, r) === T_SOLID &&
					t(cc, r + dr) !== T_SOLID &&
					r + dr >= 0 &&
					r + dr < rows;
				if (exposed && start < 0) start = cc;
				if (!exposed && start >= 0) {
					list.push({
						x: start * TILE,
						y: dr < 0 ? r * TILE : (r + 1) * TILE - 2,
						w: (cc - start) * TILE,
						h: 2
					});
					start = -1;
				}
			}
		}
	}
	// exposed side faces, merged vertically
	for (let c = 0; c < cols; c++) {
		for (const dc of [-1, 1]) {
			let start = -1;
			for (let r = 0; r <= rows; r++) {
				const exposed =
					r < rows &&
					t(c, r) === T_SOLID &&
					t(c + dc, r) !== T_SOLID &&
					c + dc >= 0 &&
					c + dc < cols;
				if (exposed && start < 0) start = r;
				if (!exposed && start >= 0) {
					g.sideEdges.push({
						x: dc < 0 ? c * TILE : (c + 1) * TILE - 1.5,
						y: start * TILE,
						w: 1.5,
						h: (r - start) * TILE
					});
					start = -1;
				}
			}
		}
	}
	return g;
}
