import { TILE } from '../core/constants';
import { hashString } from '../core/rng';
import type { ChannelName, EntitySpec, LevelDef, SignDef } from './types';

export const T_EMPTY = 0;
export const T_SOLID = 1;
export const T_ONEWAY = 2;
export const T_SPIKE_UP = 3;
export const T_SPIKE_DOWN = 4;

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface PlateData extends Rect {
	ch: number;
}
export interface RelayData extends Rect {
	ch: number;
	duration: number;
}
export interface DoorData extends Rect {
	ch: number;
	invert: boolean;
	linger: number;
}
export interface LiftData extends Rect {
	ch: number;
	/** travel in world units when powered */
	dx: number;
	dy: number;
	speed: number;
}
export interface LaserData extends Rect {
	ch: number;
	invert: boolean;
	period: number;
	on: number;
	phase: number;
	vertical: boolean;
}
export interface TurretData {
	/** muzzle centre */
	x: number;
	y: number;
	range: number;
}

export interface LevelData {
	def: LevelDef;
	/**
	 * Content hash of everything that affects play (map, legend, loop length, echo capacity, par).
	 * Replays recorded on a different version of a level are rejected rather than mis-scored.
	 */
	version: string;
	mirrored: boolean;
	cols: number;
	rows: number;
	width: number;
	height: number;
	tiles: Uint8Array;
	spawn: { x: number; y: number };
	exit: Rect;
	shards: Rect[];
	plates: PlateData[];
	relays: RelayData[];
	doors: DoorData[];
	lifts: LiftData[];
	lasers: LaserData[];
	turrets: TurretData[];
	signs: SignDef[];
}

const CHANNELS: ChannelName[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
export const channelIndex = (c: ChannelName): number => CHANNELS.indexOf(c);
export const CHANNEL_COUNT = CHANNELS.length;

const FIXED: Record<string, number> = {
	'#': T_SOLID,
	'=': T_ONEWAY,
	'^': T_SPIKE_UP,
	v: T_SPIKE_DOWN
};

export class LevelParseError extends Error {}

/**
 * Parse an ASCII level. `mirror` flips it horizontally (used by daily variants); physics is
 * left/right symmetric so a mirrored level stays solvable.
 */
export function parseLevel(def: LevelDef, mirror = false): LevelData {
	const rows = def.map.length;
	const cols = Math.max(...def.map.map((r) => r.length));
	const grid: string[][] = def.map.map((r) => {
		const cells = r.padEnd(cols, '.').split('');
		return mirror ? cells.reverse() : cells;
	});
	const at = (c: number, r: number) =>
		r >= 0 && r < rows && c >= 0 && c < cols ? grid[r][c] : '#';

	const tiles = new Uint8Array(cols * rows);
	const used = new Uint8Array(cols * rows);
	const data: LevelData = {
		def,
		version: levelVersion(def),
		mirrored: mirror,
		cols,
		rows,
		width: cols * TILE,
		height: rows * TILE,
		tiles,
		spawn: { x: 0, y: 0 },
		exit: { x: 0, y: 0, w: 0, h: 0 },
		shards: [],
		plates: [],
		relays: [],
		doors: [],
		lifts: [],
		lasers: [],
		turrets: [],
		signs: (def.signs ?? []).map((s) => (mirror ? { ...s, x: cols - 1 - s.x } : s))
	};
	let spawnFound = false;
	let exitFound = false;

	/** Collect a maximal run of `glyph` starting at (c,r) in the given direction, marking it used. */
	const run = (c: number, r: number, glyph: string, dc: number, dr: number): number => {
		let n = 0;
		while (at(c + dc * n, r + dr * n) === glyph && !used[(r + dr * n) * cols + c + dc * n]) {
			used[(r + dr * n) * cols + c + dc * n] = 1;
			n++;
		}
		return n;
	};

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const g = grid[r][c];
			const idx = r * cols + c;
			if (g in FIXED) {
				tiles[idx] = FIXED[g];
				continue;
			}
			if (g === '.' || g === ' ' || used[idx]) continue;
			const x = c * TILE;
			const y = r * TILE;
			if (g === 'P') {
				data.spawn = { x: x + 3, y: y + 2 };
				spawnFound = true;
			} else if (g === 'X') {
				data.exit = { x: x - 4, y: y - TILE, w: TILE + 8, h: TILE * 2 };
				exitFound = true;
			} else if (g === '*') {
				data.shards.push({ x: x + 4, y: y + 4, w: 8, h: 8 });
			} else {
				const spec: EntitySpec | undefined = def.legend?.[g];
				if (!spec) throw new LevelParseError(`${def.id}: unknown glyph '${g}' at ${c},${r}`);
				addEntity(data, spec, g, c, r, run, at);
			}
		}
	}
	if (!spawnFound) throw new LevelParseError(`${def.id}: missing spawn 'P'`);
	if (!exitFound) throw new LevelParseError(`${def.id}: missing exit 'X'`);
	if (mirror) for (const l of data.lifts) l.dx = -l.dx;
	return data;
}

function addEntity(
	data: LevelData,
	spec: EntitySpec,
	glyph: string,
	c: number,
	r: number,
	run: (c: number, r: number, glyph: string, dc: number, dr: number) => number,
	at: (c: number, r: number) => string
) {
	const x = c * TILE;
	const y = r * TILE;
	switch (spec.type) {
		case 'plate': {
			const n = run(c, r, glyph, 1, 0);
			data.plates.push({
				x: x + 1,
				y: y + TILE - 4,
				w: n * TILE - 2,
				h: 4,
				ch: channelIndex(spec.ch)
			});
			break;
		}
		case 'relay':
			run(c, r, glyph, 1, 0);
			data.relays.push({
				x: x + 3,
				y: y + 2,
				w: TILE - 6,
				h: TILE - 2,
				ch: channelIndex(spec.ch),
				duration: spec.duration
			});
			break;
		case 'door': {
			const n = run(c, r, glyph, 0, 1);
			data.doors.push({
				x: x + 3,
				y,
				w: TILE - 6,
				h: n * TILE,
				ch: channelIndex(spec.ch),
				invert: spec.invert ?? false,
				linger: spec.linger ?? 10
			});
			break;
		}
		case 'lift': {
			const n = run(c, r, glyph, 1, 0);
			data.lifts.push({
				x,
				y,
				w: n * TILE,
				h: 6,
				ch: channelIndex(spec.ch),
				dx: spec.dx * TILE,
				dy: spec.dy * TILE,
				speed: spec.speed ?? 1.2
			});
			break;
		}
		case 'laser': {
			const vertical = at(c, r + 1) === glyph;
			const n = vertical ? run(c, r, glyph, 0, 1) : run(c, r, glyph, 1, 0);
			data.lasers.push({
				x: vertical ? x + 6 : x,
				y: vertical ? y : y + 6,
				w: vertical ? 4 : n * TILE,
				h: vertical ? n * TILE : 4,
				ch: spec.ch ? channelIndex(spec.ch) : -1,
				invert: spec.invert ?? false,
				period: spec.period ?? 0,
				on: spec.on ?? 0,
				phase: spec.phase ?? 0,
				vertical
			});
			break;
		}
		case 'turret':
			run(c, r, glyph, 1, 0);
			data.turrets.push({ x: x + TILE / 2, y: y + TILE / 2, range: spec.range * TILE });
			break;
	}
}

export function levelVersion(def: LevelDef): string {
	const playable = [def.map, def.legend ?? {}, def.loopSeconds, def.maxGhosts, def.parSeconds];
	return hashString(JSON.stringify(playable)).toString(16).padStart(8, '0');
}

export const tileAt = (lvl: LevelData, c: number, r: number): number =>
	c < 0 || c >= lvl.cols
		? T_SOLID
		: r < 0
			? T_EMPTY
			: r >= lvl.rows
				? T_EMPTY
				: lvl.tiles[r * lvl.cols + c];
