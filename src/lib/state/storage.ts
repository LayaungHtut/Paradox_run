/**
 * Versioned localStorage wrapper. Every read is defensive: storage can be unavailable (private
 * mode, quota, disabled) and stored data can be from an older schema — the game must still start.
 */
const PREFIX = 'paradox-run:';

export function loadJson<T>(key: string, version: number, fallback: T): T {
	try {
		const raw = localStorage.getItem(PREFIX + key);
		if (!raw) return fallback;
		const parsed = JSON.parse(raw) as { v: number; data: T };
		if (parsed?.v !== version || parsed.data === undefined) return fallback;
		return parsed.data;
	} catch {
		return fallback;
	}
}

export function saveJson<T>(key: string, version: number, data: T): boolean {
	try {
		localStorage.setItem(PREFIX + key, JSON.stringify({ v: version, data }));
		return true;
	} catch {
		return false;
	}
}
