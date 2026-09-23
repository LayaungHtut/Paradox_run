import { describe, expect, it } from 'vitest';
import { renderSfxOffline, SFX_NAMES } from './audio';

/*
 * Runs in a real Chromium (Vitest browser mode). Every sound is synthesised into an
 * OfflineAudioContext and measured: it must be audible, must not clip, and must be numerically sane.
 * (This verifies the signal, not taste — mixing by ear is still a manual check.)
 */
describe('procedural sound effects', () => {
	for (const name of SFX_NAMES) {
		it(`${name} renders an audible, non-clipping signal`, async () => {
			const s = await renderSfxOffline(name);
			expect(s.nonFinite).toBe(0);
			expect(s.peak).toBeGreaterThan(0.01);
			expect(s.peak).toBeLessThanOrEqual(1);
			expect(s.rms).toBeGreaterThan(0.0005);
		});
	}
});
