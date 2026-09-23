import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Timeline } from '$lib/game/run/session';
import type { BoardKey, EntrySummary } from '$lib/net/types';

/*
 * Leaderboard persistence: an in-memory index backed by a single JSON file, written atomically
 * (temp file + rename) and debounced. Suitable for a single Node process with a writable disk
 * (adapter-node, a VPS, a container with a volume). Swap `LeaderboardStore` for a DB/KV backend to
 * run on serverless hosts — see docs/DEPLOYMENT.md.
 */

export interface StoredEntry {
	id: string;
	board: BoardKey;
	playerId: string;
	name: string;
	score: number;
	ticks: number;
	loops: number;
	shards: number;
	createdAt: number;
	timeline: Timeline;
}

interface DbFile {
	v: 1;
	entries: StoredEntry[];
}

const MAX_PER_BOARD = 1000;

/** Ranking order: higher score first, then faster, then earlier. */
const better = (a: StoredEntry, b: StoredEntry) =>
	b.score - a.score || a.ticks - b.ticks || a.createdAt - b.createdAt;

export const summarize = (e: StoredEntry, you = false): EntrySummary => ({
	id: e.id,
	name: e.name,
	score: e.score,
	ticks: e.ticks,
	loops: e.loops,
	shards: e.shards,
	createdAt: e.createdAt,
	...(you ? { you: true } : {})
});

export class LeaderboardStore {
	private boards = new Map<string, StoredEntry[]>();
	private byId = new Map<string, StoredEntry>();
	private file: string | null;
	private writeTimer: ReturnType<typeof setTimeout> | null = null;

	/** @param dir data directory, or null for a purely in-memory store (tests) */
	constructor(dir: string | null) {
		this.file = dir ? join(dir, 'leaderboard.json') : null;
		if (dir) {
			mkdirSync(dir, { recursive: true });
			this.load();
		}
	}

	private load(): void {
		let raw: string;
		try {
			raw = readFileSync(this.file!, 'utf8');
		} catch {
			return; // first run
		}
		const db = JSON.parse(raw) as DbFile;
		for (const e of db.entries) this.index(e);
		for (const list of this.boards.values()) list.sort(better);
	}

	private index(e: StoredEntry): void {
		let list = this.boards.get(e.board);
		if (!list) this.boards.set(e.board, (list = []));
		list.push(e);
		this.byId.set(e.id, e);
	}

	private scheduleWrite(): void {
		if (!this.file || this.writeTimer) return;
		this.writeTimer = setTimeout(() => {
			this.writeTimer = null;
			this.flush();
		}, 250);
	}

	flush(): void {
		if (!this.file) return;
		const db: DbFile = { v: 1, entries: [...this.byId.values()] };
		const tmp = `${this.file}.${process.pid}.tmp`;
		writeFileSync(tmp, JSON.stringify(db));
		renameSync(tmp, this.file);
	}

	/**
	 * Insert a verified run. Keeps only each player's best entry per board.
	 * Returns the player's standing entry (new or previous best) and whether it improved.
	 */
	submit(input: Omit<StoredEntry, 'id' | 'createdAt'>): {
		entry: StoredEntry;
		improved: boolean;
		rank: number;
		total: number;
	} {
		const list = this.boards.get(input.board) ?? [];
		const prevIdx = list.findIndex((e) => e.playerId === input.playerId);
		const candidate: StoredEntry = {
			...input,
			id: randomBytes(9).toString('base64url'),
			createdAt: Date.now()
		};
		let entry = candidate;
		let improved = true;
		if (prevIdx >= 0) {
			const prev = list[prevIdx];
			if (better(candidate, prev) < 0) {
				list.splice(prevIdx, 1);
				this.byId.delete(prev.id);
			} else {
				entry = prev;
				improved = false;
				if (prev.name !== input.name) prev.name = input.name; // keep display name current
			}
		}
		if (improved) {
			this.index(candidate);
			const sorted = this.boards.get(input.board)!;
			sorted.sort(better);
			while (sorted.length > MAX_PER_BOARD) this.byId.delete(sorted.pop()!.id);
		}
		this.scheduleWrite();
		const board = this.boards.get(input.board)!;
		return { entry, improved, rank: board.indexOf(entry) + 1, total: board.length };
	}

	top(board: BoardKey, limit: number): StoredEntry[] {
		return (this.boards.get(board) ?? []).slice(0, limit);
	}

	count(board: BoardKey): number {
		return this.boards.get(board)?.length ?? 0;
	}

	playerBest(board: BoardKey, playerId: string): { entry: StoredEntry; rank: number } | null {
		const list = this.boards.get(board) ?? [];
		const i = list.findIndex((e) => e.playerId === playerId);
		return i < 0 ? null : { entry: list[i], rank: i + 1 };
	}

	get(id: string): StoredEntry | undefined {
		return this.byId.get(id);
	}
}
