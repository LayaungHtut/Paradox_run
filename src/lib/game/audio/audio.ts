/*
 * Procedural audio: every sound is synthesised with WebAudio at runtime — no samples, no licensing,
 * zero download weight. The music is a small generative sequencer whose intensity follows the loop
 * timer, so tension rises as the timeline runs out.
 */

export type Sfx =
	| 'jump'
	| 'land'
	| 'dash'
	| 'death'
	| 'shard'
	| 'plate'
	| 'plateOff'
	| 'relay'
	| 'door'
	| 'ghostSpawn'
	| 'ghostAssist'
	| 'ghostFade'
	| 'rewind'
	| 'success'
	| 'lock'
	| 'fire'
	| 'ui'
	| 'tick';

// A-minor-ish progression (semitone offsets from A2 = 110 Hz)
const PROGRESSION = [
	[0, 3, 7, 10],
	[-4, 0, 3, 7],
	[-7, -3, 0, 5],
	[-2, 2, 5, 9]
];
const hz = (semi: number, base = 110) => base * Math.pow(2, semi / 12);

export class AudioEngine {
	private ctx: BaseAudioContext | null = null;
	/** true when attached to an OfflineAudioContext (tests / analysis) */
	private offline = false;
	private master!: GainNode;
	private sfxBus!: GainNode;
	private musicBus!: GainNode;
	private noise!: AudioBuffer;
	private musicTimer: ReturnType<typeof setInterval> | null = null;
	private nextNoteTime = 0;
	private step = 0;
	private sfxVolume = 0.8;
	private musicVolume = 0.5;
	/** 0 calm → 1 frantic; set from the loop timer */
	intensity = 0;
	private musicOn = false;
	private lastPlayed = new Map<Sfx, number>();

	/**
	 * Must be called from a user gesture (browser autoplay policy). Safe to call repeatedly; if the
	 * browser has no WebAudio (or refuses to create a context) the game simply stays silent.
	 */
	unlock(): void {
		if (typeof window === 'undefined') return;
		if (!this.ctx) {
			const Ctor =
				window.AudioContext ??
				(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (!Ctor) return;
			try {
				this.attach(new Ctor({ latencyHint: 'interactive' }));
			} catch {
				return;
			}
		}
		this.resume();
	}

	/** Build the mixer graph on a context: sfx + music buses → compressor → master → output. */
	attach(ctx: BaseAudioContext, offline = false): void {
		this.ctx = ctx;
		this.offline = offline;
		this.master = ctx.createGain();
		this.master.connect(ctx.destination);
		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = -14;
		comp.ratio.value = 4;
		comp.connect(this.master);
		this.sfxBus = ctx.createGain();
		this.sfxBus.connect(comp);
		this.musicBus = ctx.createGain();
		this.musicBus.connect(comp);
		this.noise = this.makeNoise();
		this.applyVolumes();
	}

	setVolumes(sfx: number, music: number): void {
		this.sfxVolume = sfx;
		this.musicVolume = music;
		this.applyVolumes();
	}

	private applyVolumes(): void {
		if (!this.ctx) return;
		this.sfxBus.gain.value = this.sfxVolume * 0.9;
		this.musicBus.gain.value = this.musicVolume * 0.32;
	}

	/** The live context, if any (offline contexts cannot be suspended or resumed). */
	private live(): AudioContext | null {
		return this.ctx && !this.offline ? (this.ctx as AudioContext) : null;
	}

	suspend(): void {
		void this.live()
			?.suspend?.()
			.catch(() => {});
	}

	resume(): void {
		const ctx = this.live();
		if (ctx?.state === 'suspended') void ctx.resume().catch(() => {});
	}

	// ─── sfx ─────────────────────────────────────────────────────────────────

	play(name: Sfx, strength = 1, pitch = 0): void {
		const ctx = this.ctx;
		if (!ctx || (!this.offline && ctx.state !== 'running') || this.sfxVolume <= 0) return;
		// rate-limit identical sounds (e.g. many ghosts landing on the same tick)
		const now = ctx.currentTime;
		const last = this.lastPlayed.get(name) ?? -1;
		if (now - last < 0.03) return;
		this.lastPlayed.set(name, now);
		const t = now + 0.005;
		switch (name) {
			case 'jump':
				this.tone('square', 290 + pitch * 20, 540 + pitch * 20, t, 0.09, 0.07);
				break;
			case 'land':
				this.noiseHit(t, 0.07, 420, 0.12 * Math.min(1, strength), 'lowpass');
				this.tone('sine', 120, 55, t, 0.08, 0.12 * Math.min(1, strength));
				break;
			case 'dash':
				this.noiseSweep(t, 0.16, 800, 3200, 0.16);
				this.tone('sawtooth', 180, 90, t, 0.12, 0.04);
				break;
			case 'death':
				this.noiseHit(t, 0.35, 1400, 0.3, 'lowpass');
				this.tone('sawtooth', 420, 60, t, 0.42, 0.16);
				this.tone('sine', 90, 30, t, 0.5, 0.3);
				break;
			case 'shard':
				this.tone('sine', 1320, 1320, t, 0.22, 0.12);
				this.tone('sine', 1760, 1760, t + 0.07, 0.3, 0.1);
				this.tone('triangle', 2640, 2640, t + 0.07, 0.2, 0.03);
				break;
			case 'plate':
				this.noiseHit(t, 0.03, 2500, 0.08, 'bandpass');
				this.tone('triangle', 330 + pitch * 40, 440 + pitch * 40, t, 0.14, 0.09);
				break;
			case 'plateOff':
				this.tone('triangle', 330 + pitch * 40, 250 + pitch * 40, t, 0.1, 0.05);
				break;
			case 'relay':
				[0, 4, 7].forEach((s, i) =>
					this.tone('triangle', hz(s + 24 + pitch), hz(s + 24 + pitch), t + i * 0.05, 0.14, 0.08)
				);
				break;
			case 'door':
				this.tone('sawtooth', 80, 140, t, 0.22, 0.06);
				this.noiseSweep(t, 0.2, 300, 900, 0.05);
				break;
			case 'ghostSpawn':
				this.tone('sine', 220, 880, t, 0.55, 0.1, 9);
				this.tone('sine', 330, 1320, t + 0.05, 0.5, 0.05, 7);
				this.noiseSweep(t, 0.5, 4000, 600, 0.05);
				break;
			case 'ghostAssist':
				this.tone('sine', hz(31 + pitch), hz(31 + pitch), t, 0.35, 0.09, 5);
				this.tone('sine', hz(38 + pitch), hz(38 + pitch), t + 0.06, 0.4, 0.07, 5);
				break;
			case 'ghostFade':
				this.tone('sine', 880, 440, t, 0.3, 0.04, 6);
				break;
			case 'rewind':
				this.tone('sawtooth', 900, 120, t, 0.75, 0.06, 28);
				this.noiseSweep(t, 0.75, 5000, 400, 0.08);
				break;
			case 'success':
				[0, 4, 7, 12, 16].forEach((s, i) =>
					this.tone('triangle', hz(s + 24), hz(s + 24), t + i * 0.07, 0.5, 0.09)
				);
				this.tone('sine', hz(12), hz(12), t, 0.9, 0.1);
				break;
			case 'lock':
				this.tone('square', 1200, 1200, t, 0.05, 0.04);
				this.tone('square', 1200, 1200, t + 0.09, 0.05, 0.04);
				break;
			case 'fire':
				this.tone('sawtooth', 1600, 200, t, 0.18, 0.08);
				this.noiseHit(t, 0.08, 3000, 0.06, 'highpass');
				break;
			case 'ui':
				this.tone('triangle', 660, 880, t, 0.06, 0.06);
				break;
			case 'tick':
				// loop countdown: short, bright, pitched up as the loop ends (pitch = seconds left)
				this.tone('square', 1320 - pitch * 110, 1320 - pitch * 110, t, 0.06, 0.09);
				break;
		}
	}

	private tone(
		type: OscillatorType,
		f0: number,
		f1: number,
		t: number,
		dur: number,
		vol: number,
		vibrato = 0
	): void {
		const ctx = this.ctx!;
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(f0, t);
		osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.012, dur / 4));
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		if (vibrato > 0) {
			const lfo = ctx.createOscillator();
			const lg = ctx.createGain();
			lfo.frequency.value = vibrato;
			lg.gain.value = f0 * 0.03;
			lfo.connect(lg).connect(osc.frequency);
			lfo.start(t);
			lfo.stop(t + dur + 0.02);
		}
		osc.connect(g).connect(this.sfxBus);
		osc.start(t);
		osc.stop(t + dur + 0.02);
	}

	private noiseHit(
		t: number,
		dur: number,
		freq: number,
		vol: number,
		type: BiquadFilterType
	): void {
		const ctx = this.ctx!;
		const src = ctx.createBufferSource();
		src.buffer = this.noise;
		const f = ctx.createBiquadFilter();
		f.type = type;
		f.frequency.value = freq;
		const g = ctx.createGain();
		g.gain.setValueAtTime(vol, t);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		src.connect(f).connect(g).connect(this.sfxBus);
		src.start(t, Math.random() * 0.5);
		src.stop(t + dur + 0.02);
	}

	private noiseSweep(t: number, dur: number, f0: number, f1: number, vol: number): void {
		const ctx = this.ctx!;
		const src = ctx.createBufferSource();
		src.buffer = this.noise;
		const f = ctx.createBiquadFilter();
		f.type = 'bandpass';
		f.Q.value = 2;
		f.frequency.setValueAtTime(f0, t);
		f.frequency.exponentialRampToValueAtTime(f1, t + dur);
		const g = ctx.createGain();
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		src.connect(f).connect(g).connect(this.sfxBus);
		src.start(t, Math.random() * 0.5);
		src.stop(t + dur + 0.02);
	}

	private makeNoise(): AudioBuffer {
		const ctx = this.ctx!;
		const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
		return buf;
	}

	// ─── music ───────────────────────────────────────────────────────────────

	startMusic(): void {
		if (!this.ctx || this.musicOn) return;
		this.musicOn = true;
		this.nextNoteTime = this.ctx.currentTime + 0.1;
		this.step = 0;
		this.musicTimer = setInterval(() => this.schedule(), 25);
	}

	stopMusic(): void {
		this.musicOn = false;
		if (this.musicTimer) clearInterval(this.musicTimer);
		this.musicTimer = null;
	}

	private schedule(): void {
		const ctx = this.ctx;
		if (!ctx || (!this.offline && ctx.state !== 'running')) return;
		const bpm = 104 + this.intensity * 24;
		const sixteenth = 60 / bpm / 4;
		while (this.nextNoteTime < ctx.currentTime + 0.12) {
			this.playStep(this.step, this.nextNoteTime, sixteenth);
			this.nextNoteTime += sixteenth;
			this.step = (this.step + 1) % 256;
		}
	}

	private playStep(step: number, t: number, len: number): void {
		const chord = PROGRESSION[Math.floor(step / 32) % PROGRESSION.length];
		const i = this.intensity;
		const s16 = step % 16;
		// bass pulse on eighths
		if (step % 2 === 0) {
			const note = s16 === 0 || s16 === 8 ? chord[0] : s16 % 4 === 0 ? chord[0] + 12 : chord[0];
			this.musicTone('triangle', hz(note - 12), t, len * 1.6, 0.22 + i * 0.05);
		}
		// pad at the start of each bar
		if (step % 32 === 0)
			for (const n of chord) this.musicTone('sine', hz(n + 12), t, len * 30, 0.035);
		// hats: sparse when calm, driving when late in the loop
		if (s16 % (i > 0.6 ? 1 : 2) === 0)
			this.musicNoise(t, 0.03, 7000, s16 % 4 === 2 ? 0.05 : 0.025 + i * 0.02);
		// arpeggio fades in with intensity
		if (i > 0.35 && step % 2 === 1) {
			const n = chord[(step >> 1) % chord.length] + 24;
			this.musicTone('square', hz(n), t, len * 0.8, 0.018 * (i - 0.3) * 2);
		}
		// kick
		if (s16 === 0 || (i > 0.5 && s16 === 8)) this.musicTone('sine', 70, t, 0.18, 0.35, 38);
	}

	private musicTone(
		type: OscillatorType,
		f: number,
		t: number,
		dur: number,
		vol: number,
		fEnd?: number
	): void {
		const ctx = this.ctx!;
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(f, t);
		if (fEnd) osc.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		osc.connect(g).connect(this.musicBus);
		osc.start(t);
		osc.stop(t + dur + 0.02);
	}

	private musicNoise(t: number, dur: number, freq: number, vol: number): void {
		const ctx = this.ctx!;
		const src = ctx.createBufferSource();
		src.buffer = this.noise;
		const f = ctx.createBiquadFilter();
		f.type = 'highpass';
		f.frequency.value = freq;
		const g = ctx.createGain();
		g.gain.setValueAtTime(vol, t);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		src.connect(f).connect(g).connect(this.musicBus);
		src.start(t, Math.random() * 0.5);
		src.stop(t + dur + 0.02);
	}
}

/** One engine per page: the AudioContext is a scarce resource on mobile. */
export const audio = new AudioEngine();

export const SFX_NAMES: Sfx[] = [
	'jump',
	'land',
	'dash',
	'death',
	'shard',
	'plate',
	'plateOff',
	'relay',
	'door',
	'ghostSpawn',
	'ghostAssist',
	'ghostFade',
	'rewind',
	'success',
	'lock',
	'fire',
	'ui',
	'tick'
];

export interface SignalStats {
	peak: number;
	rms: number;
	nonFinite: number;
}

/**
 * Render one sound effect into an OfflineAudioContext and measure it. Used by the browser test
 * suite to verify that every sound actually produces signal, does not clip, and contains no NaNs.
 */
export async function renderSfxOffline(
	name: Sfx,
	seconds = 1.2,
	sampleRate = 44100
): Promise<SignalStats> {
	const ctx = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
	const engine = new AudioEngine();
	engine.attach(ctx, true);
	engine.setVolumes(1, 0);
	engine.play(name);
	const buf = await ctx.startRendering();
	const data = buf.getChannelData(0);
	let peak = 0;
	let sum = 0;
	let nonFinite = 0;
	for (let i = 0; i < data.length; i++) {
		const v = data[i];
		if (!Number.isFinite(v)) {
			nonFinite++;
			continue;
		}
		const a = Math.abs(v);
		if (a > peak) peak = a;
		sum += v * v;
	}
	return { peak, rms: Math.sqrt(sum / data.length), nonFinite };
}
