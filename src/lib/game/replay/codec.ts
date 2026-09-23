import { IN_MASK, LIMITS } from '../core/constants';

/*
 * Input streams are stored as run-length encoded bytes: [value, varint(runLength)]…, then base64url.
 * Players hold inputs for many ticks at a time, so a 30 s loop is typically well under 100 chars.
 */

export class ReplayDecodeError extends Error {}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_INDEX = new Int16Array(128).fill(-1);
for (let i = 0; i < B64.length; i++) B64_INDEX[B64.charCodeAt(i)] = i;

export function toBase64Url(bytes: Uint8Array): string {
	let out = '';
	for (let i = 0; i < bytes.length; i += 3) {
		const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
		out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
		if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
		if (i + 2 < bytes.length) out += B64[n & 63];
	}
	return out;
}

export function fromBase64Url(s: string): Uint8Array {
	if (s.length % 4 === 1) throw new ReplayDecodeError('bad base64 length');
	const out = new Uint8Array(Math.floor((s.length * 3) / 4));
	let o = 0;
	for (let i = 0; i < s.length; i += 4) {
		let n = 0;
		const chunk = Math.min(4, s.length - i);
		for (let j = 0; j < 4; j++) {
			const code = j < chunk ? s.charCodeAt(i + j) : 65;
			const v = code < 128 ? B64_INDEX[code] : -1;
			if (v < 0) throw new ReplayDecodeError('bad base64 char');
			n = (n << 6) | (j < chunk ? v : 0);
		}
		out[o++] = (n >> 16) & 255;
		if (chunk > 2) out[o++] = (n >> 8) & 255;
		if (chunk > 3) out[o++] = n & 255;
	}
	return out.subarray(0, o);
}

export function encodeInputs(inputs: Uint8Array, length = inputs.length): string {
	const bytes: number[] = [];
	let i = 0;
	while (i < length) {
		const v = inputs[i];
		let run = 1;
		while (i + run < length && inputs[i + run] === v) run++;
		bytes.push(v);
		let r = run;
		while (r >= 0x80) {
			bytes.push((r & 0x7f) | 0x80);
			r >>>= 7;
		}
		bytes.push(r);
		i += run;
	}
	return toBase64Url(Uint8Array.from(bytes));
}

export function decodeInputs(
	encoded: string,
	maxTicks: number = LIMITS.maxTicksPerLoop
): Uint8Array {
	if (encoded.length > LIMITS.maxEncodedLoopChars) throw new ReplayDecodeError('loop too large');
	const bytes = fromBase64Url(encoded);
	const runs: number[] = [];
	let total = 0;
	let i = 0;
	while (i < bytes.length) {
		const v = bytes[i++];
		if ((v & ~IN_MASK) !== 0) throw new ReplayDecodeError('invalid input bits');
		let run = 0;
		let shift = 0;
		for (;;) {
			if (i >= bytes.length) throw new ReplayDecodeError('truncated run');
			const b = bytes[i++];
			run |= (b & 0x7f) << shift;
			if ((b & 0x80) === 0) break;
			shift += 7;
			if (shift > 21) throw new ReplayDecodeError('run too long');
		}
		if (run === 0) throw new ReplayDecodeError('empty run');
		total += run;
		if (total > maxTicks) throw new ReplayDecodeError('loop exceeds tick limit');
		runs.push(v, run);
	}
	const out = new Uint8Array(total);
	let o = 0;
	for (let k = 0; k < runs.length; k += 2) {
		out.fill(runs[k], o, o + runs[k + 1]);
		o += runs[k + 1];
	}
	return out;
}

/** Growable per-tick input log for the loop in progress. */
export class InputRecorder {
	private buf = new Uint8Array(60 * 40);
	length = 0;

	push(input: number): void {
		if (this.length === this.buf.length) {
			const next = new Uint8Array(this.buf.length * 2);
			next.set(this.buf);
			this.buf = next;
		}
		this.buf[this.length++] = input & IN_MASK;
	}

	snapshot(): Uint8Array {
		return this.buf.slice(0, this.length);
	}

	reset(): void {
		this.length = 0;
	}
}
