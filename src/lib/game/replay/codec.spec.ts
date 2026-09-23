import { describe, expect, it } from 'vitest';
import { decodeInputs, encodeInputs, fromBase64Url, ReplayDecodeError, toBase64Url } from './codec';

describe('replay codec', () => {
	it('base64url round-trips arbitrary bytes', () => {
		for (let n = 0; n < 20; n++) {
			const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 97 + n) & 255);
			expect(Array.from(fromBase64Url(toBase64Url(bytes)))).toEqual(Array.from(bytes));
		}
	});

	it('input streams round-trip, including long runs', () => {
		const inputs = new Uint8Array(3000);
		for (let i = 0; i < inputs.length; i++)
			inputs[i] = i < 400 ? 2 : i < 410 ? 6 : i % 300 < 150 ? 1 : 0;
		const enc = encodeInputs(inputs);
		expect(enc.length).toBeLessThan(120);
		expect(Array.from(decodeInputs(enc))).toEqual(Array.from(inputs));
	});

	it('rejects invalid bits, garbage and over-long loops', () => {
		expect(() => decodeInputs(encodeInputs(Uint8Array.of(64)))).toThrow(ReplayDecodeError);
		expect(() => decodeInputs('!!!!')).toThrow(ReplayDecodeError);
		expect(() => decodeInputs(encodeInputs(new Uint8Array(500)), 100)).toThrow(ReplayDecodeError);
	});
});
