/** Smoothed follow camera with look-ahead and trauma-based screen shake. Cosmetic only. */
export class Camera {
	x = 0;
	y = 0;
	viewW = 400;
	viewH = 224;
	private lookAhead = 0;
	private trauma = 0;
	shakeX = 0;
	shakeY = 0;
	shakeScale = 1;
	/** extra world units the camera may show below the level (keeps the floor above touch controls) */
	bottomPad = 0;

	snap(tx: number, ty: number, levelW: number, levelH: number): void {
		this.lookAhead = 0;
		this.x = this.clampX(tx - this.viewW / 2, levelW);
		this.y = this.clampY(ty - this.viewH / 2, levelH);
	}

	follow(
		tx: number,
		ty: number,
		facing: number,
		vx: number,
		dt: number,
		levelW: number,
		levelH: number
	): void {
		const wantAhead = facing * Math.min(56, 24 + Math.abs(vx) * 14);
		this.lookAhead += (wantAhead - this.lookAhead) * Math.min(1, dt * 2.2);
		const gx = this.clampX(tx + this.lookAhead - this.viewW / 2, levelW);
		const gy = this.clampY(ty - this.viewH * 0.55, levelH);
		const k = Math.min(1, dt * 7);
		this.x += (gx - this.x) * k;
		this.y += (gy - this.y) * Math.min(1, dt * 5);
	}

	addTrauma(amount: number): void {
		this.trauma = Math.min(1, this.trauma + amount);
	}

	updateShake(dt: number, time: number): void {
		this.trauma = Math.max(0, this.trauma - dt * 1.8);
		const s = this.trauma * this.trauma * 5 * this.shakeScale;
		// smooth pseudo-noise from summed sines — deterministic enough and allocation-free
		this.shakeX = s * (Math.sin(time * 71.3) * 0.6 + Math.sin(time * 43.1) * 0.4);
		this.shakeY = s * (Math.sin(time * 59.7) * 0.6 + Math.sin(time * 37.9) * 0.4);
	}

	private clampX(x: number, levelW: number): number {
		if (levelW <= this.viewW) return (levelW - this.viewW) / 2;
		return Math.max(0, Math.min(levelW - this.viewW, x));
	}

	private clampY(y: number, levelH: number): number {
		const maxY = levelH - this.viewH + this.bottomPad;
		if (maxY <= 0) return maxY / 2;
		return Math.max(0, Math.min(maxY, y));
	}
}
