import { audio } from '$lib/game/audio/audio';
import { loadJson, saveJson } from './storage';

export interface SettingsData {
	sfx: number;
	music: number;
	screenShake: boolean;
	haptics: boolean;
	reducedEffects: boolean;
	showFps: boolean;
	muted: boolean;
	reducedFlashing: boolean;
	/** race your own fastest run as a gold ghost */
	bestGhost: boolean;
}

const DEFAULTS: SettingsData = {
	sfx: 0.8,
	music: 0.5,
	screenShake: true,
	haptics: true,
	reducedEffects: false,
	showFps: false,
	muted: false,
	reducedFlashing: false,
	bestGhost: true
};
const VERSION = 1;

class Settings {
	data = $state<SettingsData>({ ...DEFAULTS });

	load(): void {
		const prefersReduced =
			typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
		const stored = loadJson<Partial<SettingsData>>('settings', VERSION, {});
		this.data = sanitize({ ...DEFAULTS, screenShake: !prefersReduced }, stored);
		this.applyAudio();
	}

	private applyAudio(): void {
		const m = this.data.muted ? 0 : 1;
		audio.setVolumes(this.data.sfx * m, this.data.music * m);
	}

	update(patch: Partial<SettingsData>): void {
		this.data = { ...this.data, ...patch };
		saveJson('settings', VERSION, this.data);
		this.applyAudio();
	}
}

export const settings = new Settings();

/** Take each stored field only if it has the right type (and range); otherwise keep the default. */
export function sanitize(defaults: SettingsData, stored: unknown): SettingsData {
	const out = { ...defaults };
	if (!stored || typeof stored !== 'object') return out;
	const s = stored as Record<string, unknown>;
	for (const key of Object.keys(defaults) as (keyof SettingsData)[]) {
		const v = s[key];
		const d = defaults[key];
		if (typeof d === 'number' && typeof v === 'number' && Number.isFinite(v))
			(out[key] as number) = Math.min(1, Math.max(0, v));
		else if (typeof d === 'boolean' && typeof v === 'boolean') (out[key] as boolean) = v;
	}
	return out;
}
