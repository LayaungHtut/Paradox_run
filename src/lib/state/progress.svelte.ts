import { CAMPAIGN } from '$lib/game/levels/campaign';
import type { RunResult, Timeline } from '$lib/game/run/session';
import {
	applyDailyResult,
	applyLevelResult,
	emptyProgress,
	isUnlocked,
	pruneDaily,
	sanitizeProgress,
	unlock,
	type ProgressData,
	type RecordOutcome,
	type RunContext
} from './progress-logic';
import { loadJson, saveJson } from './storage';

export type { DailyRecord, LevelRecord, ProgressData, RecordOutcome } from './progress-logic';

const VERSION = 1;

/** Day key helpers (UTC so every player shares the same daily). */
export const dayKey = (ms = Date.now()): string => new Date(ms).toISOString().slice(0, 10); // eslint-disable-line svelte/prefer-svelte-reactivity -- transient, not state

/**
 * Reactive wrapper around the pure rules in progress-logic.ts: holds the data as Svelte state and
 * persists after every change.
 */
class Progress {
	data = $state<ProgressData>(emptyProgress());

	load(): void {
		this.data = sanitizeProgress(loadJson<unknown>('progress', VERSION, null));
	}

	private save(): void {
		pruneDaily(this.data);
		saveJson('progress', VERSION, $state.snapshot(this.data));
	}

	/** Forget everything (settings page, with confirmation). */
	reset(): void {
		this.data = emptyProgress();
		this.save();
	}

	isUnlocked(levelId: string): boolean {
		return isUnlocked(this.data, CAMPAIGN, levelId);
	}

	/** First level without a clear, or the last level. */
	get nextLevelId(): string {
		for (const l of CAMPAIGN) if (!this.data.levels[l.id]?.clears) return l.id;
		return CAMPAIGN[CAMPAIGN.length - 1].id;
	}

	get totalStars(): number {
		return Object.values(this.data.levels).reduce((a, r) => a + r.stars, 0);
	}

	unlock(id: string): boolean {
		const changed = unlock(this.data, id);
		if (changed) this.save();
		return changed;
	}

	markHint(key: string): boolean {
		if (this.data.hints[key]) return false;
		this.data.hints[key] = true;
		this.save();
		return true;
	}

	recordLevel(result: RunResult, timeline: Timeline, ctx: RunContext): RecordOutcome {
		const out = applyLevelResult(this.data, result, timeline, ctx, CAMPAIGN);
		this.save();
		return out;
	}

	recordDaily(
		key: string,
		result: RunResult,
		timeline: Timeline,
		ctx: RunContext,
		parSeconds: number
	): RecordOutcome {
		const out = applyDailyResult(this.data, key, result, timeline, ctx, parSeconds);
		this.save();
		return out;
	}
}

export const progress = new Progress();
