import { NAME_RE } from '$lib/net/types';
import { loadJson, saveJson } from './storage';

export interface ProfileData {
	/** random anonymous id; lets the server group a player's submissions without an account */
	id: string;
	name: string;
}

const VERSION = 1;

function randomId(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function defaultName(): string {
	const n = new Uint16Array(1);
	crypto.getRandomValues(n);
	return `Runner-${(n[0] % 9000) + 1000}`;
}

class Profile {
	data = $state<ProfileData>({ id: '', name: '' });

	load(): void {
		const stored = loadJson<ProfileData | null>('profile', VERSION, null);
		this.data = stored?.id ? stored : { id: randomId(), name: defaultName() };
		saveJson('profile', VERSION, this.data);
	}

	rename(name: string): boolean {
		const clean = name.trim();
		if (!NAME_RE.test(clean)) return false;
		this.data = { ...this.data, name: clean };
		saveJson('profile', VERSION, this.data);
		return true;
	}
}

export const profile = new Profile();
