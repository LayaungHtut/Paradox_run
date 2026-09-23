import { hashString, mulberry32 } from '../core/rng';
import { playScripts } from '../testing/bot';
import { SOLUTIONS } from '../testing/solutions';
import { CAMPAIGN } from './campaign';
import { parseLevel, type LevelData } from './parse';
import type { LevelDef } from './types';

/*
 * Daily Paradox: one deterministic challenge per UTC day, derived purely from the date string, so
 * every player (and the server verifier) builds the identical variant without any network.
 *
 * Honest scope: a daily is a campaign level (after the tutorial) remixed with modifiers, not new
 * procedural content. Modifiers that could break solvability (Short Fuse) are validated by
 * replaying the level's scripted solution under the variant; if it fails, the modifier is dropped.
 *
 * Time zone: days roll over at 00:00 UTC for everyone.
 */

export interface DailyModifier {
	id: 'mirror' | 'short-fuse' | 'par-blitz';
	name: string;
	desc: string;
}

export const MODIFIERS: Record<DailyModifier['id'], DailyModifier> = {
	mirror: { id: 'mirror', name: 'Mirror World', desc: 'The whole level is flipped left-to-right.' },
	'short-fuse': { id: 'short-fuse', name: 'Short Fuse', desc: 'Every loop is 20% shorter.' },
	'par-blitz': { id: 'par-blitz', name: 'Par Blitz', desc: 'Par time is 25% tighter.' }
};

export interface DailyConfig {
	key: string;
	/** the variant definition (same id as the campaign level; different content version) */
	def: LevelDef;
	baseId: string;
	mirror: boolean;
	modifiers: DailyModifier[];
	/** display number: days since launch */
	number: number;
}

const LAUNCH = Date.UTC(2026, 8, 1);
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Levels eligible for the daily: everything after the tutorial. */
export const dailyPool = (): LevelDef[] => (CAMPAIGN.length > 1 ? CAMPAIGN.slice(1) : CAMPAIGN);

const cache = new Map<string, DailyConfig>();

export function dailyConfig(key: string): DailyConfig {
	if (!DAY_RE.test(key)) throw new Error(`bad day key ${key}`);
	const hit = cache.get(key);
	if (hit) return hit;

	const rng = mulberry32(hashString(`paradox-daily:${key}`));
	const pool = dailyPool();
	const base = pool[Math.floor(rng() * pool.length)];
	const mirror = rng() < 0.5;
	const roll = rng();
	const modifiers: DailyModifier[] = [];
	if (mirror) modifiers.push(MODIFIERS.mirror);
	let def: LevelDef = { ...base };
	if (roll < 0.45) {
		const shorter = { ...def, loopSeconds: Math.max(6, Math.round(def.loopSeconds * 0.8)) };
		if (solvable(shorter, mirror)) {
			def = shorter;
			modifiers.push(MODIFIERS['short-fuse']);
		}
	} else if (roll < 0.85) {
		def = { ...def, parSeconds: Math.max(5, Math.round(def.parSeconds * 0.75)) };
		modifiers.push(MODIFIERS['par-blitz']);
	}
	const number = Math.floor((Date.parse(`${key}T00:00:00Z`) - LAUNCH) / 86400000) + 1;
	const cfg: DailyConfig = { key, def, baseId: base.id, mirror, modifiers, number };
	if (cache.size > 64) cache.clear();
	cache.set(key, cfg);
	return cfg;
}

/** Replay the level's known solution under the variant rules; true if it still wins. */
function solvable(def: LevelDef, mirror: boolean): boolean {
	const scripts = SOLUTIONS[def.id];
	if (!scripts) return false;
	try {
		return playScripts(def, scripts, mirror).session.status === 'complete';
	} catch {
		return false;
	}
}

export function dailyLevel(key: string): { config: DailyConfig; level: LevelData } {
	const config = dailyConfig(key);
	return { config, level: parseLevel(config.def, config.mirror) };
}

/** UTC day keys a server should accept submissions for (today, plus yesterday for late finishes). */
export function acceptedDailyKeys(now = Date.now()): string[] {
	const today = new Date(now).toISOString().slice(0, 10);
	const yesterday = new Date(now - 86400000).toISOString().slice(0, 10);
	return [today, yesterday];
}
