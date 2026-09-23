import { IN_DASH, IN_JUMP, IN_LEFT, IN_RIGHT } from '../core/constants';

/*
 * Input sampling. Devices write into a small state object; the controller calls `sample()` once per
 * simulation tick to obtain that tick's bitmask. Presses that start and end between two ticks are
 * latched so fast taps are never lost.
 */

export type InputMode = 'touch' | 'keyboard';

export interface InputCommands {
	onRewind(): void;
	onPause(): void;
}

const KEY_LEFT = new Set(['ArrowLeft', 'KeyA']);
const KEY_RIGHT = new Set(['ArrowRight', 'KeyD']);
const KEY_JUMP = new Set(['Space', 'ArrowUp', 'KeyW', 'KeyZ', 'KeyJ']);
const KEY_DASH = new Set(['ShiftLeft', 'ShiftRight', 'KeyX', 'KeyK']);
const KEY_REWIND = new Set(['KeyR', 'KeyQ']);
const KEY_PAUSE = new Set(['Escape', 'KeyP']);

/** Horizontal swipe distance (CSS px) and max duration that counts as a dash flick. */
const SWIPE_DIST = 28;
const SWIPE_MS = 220;

export class InputManager {
	mode: InputMode = 'keyboard';
	private held = { left: false, right: false, jump: false, dash: false };
	/** latched presses since the last sample */
	private latchJump = false;
	private latchDash = false;
	private dashDir = 0;

	// touch state
	private moveTouch: number | null = null;
	private moveCenterX = 0;
	private actionTouches = new Map<number, { x: number; y: number; t: number; swiped: boolean }>();
	private dashTouch: number | null = null;

	private listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [];

	constructor(private commands: InputCommands) {
		if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches)
			this.mode = 'touch';
	}

	attachKeyboard(target: Window): void {
		this.on(target, 'keydown', (e) => this.key(e as KeyboardEvent, true));
		this.on(target, 'keyup', (e) => this.key(e as KeyboardEvent, false));
		this.on(target, 'blur', () => this.releaseAll());
	}

	/**
	 * Touch layout (landscape): the left zone is a movement pad centred at `moveCenterX`; the right zone
	 * is tap-to-jump / flick-to-dash; an element marked `data-dash` is a dedicated dash button.
	 */
	attachTouch(surface: HTMLElement, getLayout: () => { splitX: number; padCenterX: number }): void {
		const opts: AddEventListenerOptions = { passive: false };
		this.on(surface, 'touchstart', (e) => this.touchStart(e as TouchEvent, getLayout()), opts);
		this.on(surface, 'touchmove', (e) => this.touchMove(e as TouchEvent), opts);
		this.on(surface, 'touchend', (e) => this.touchEnd(e as TouchEvent), opts);
		this.on(surface, 'touchcancel', (e) => this.touchEnd(e as TouchEvent), opts);
	}

	detach(): void {
		for (const [t, type, fn, opts] of this.listeners) t.removeEventListener(type, fn, opts);
		this.listeners = [];
		this.releaseAll();
	}

	/** Returns this tick's input bitmask and clears latched presses. */
	sample(): number {
		let bits = 0;
		let left = this.held.left;
		let right = this.held.right;
		if (this.latchDash && this.dashDir !== 0) {
			// a swipe decides the dash direction for this tick
			left = this.dashDir < 0;
			right = this.dashDir > 0;
		}
		if (left && !right) bits |= IN_LEFT;
		if (right && !left) bits |= IN_RIGHT;
		if (this.held.jump || this.latchJump) bits |= IN_JUMP;
		if (this.held.dash || this.latchDash) bits |= IN_DASH;
		this.latchJump = false;
		this.latchDash = false;
		this.dashDir = 0;
		return bits;
	}

	/** true while any movement/action input is held or was tapped since the last sample */
	get anyHeld(): boolean {
		return (
			this.held.left ||
			this.held.right ||
			this.held.jump ||
			this.held.dash ||
			this.latchJump ||
			this.latchDash
		);
	}

	/** Returns and clears a pending fresh jump/dash press (used to skip transitions). */
	consumePress(): boolean {
		const pressed = this.latchJump || this.latchDash;
		this.latchJump = false;
		this.latchDash = false;
		this.dashDir = 0;
		return pressed;
	}

	releaseAll(): void {
		this.held.left = this.held.right = this.held.jump = this.held.dash = false;
		this.moveTouch = null;
		this.dashTouch = null;
		this.actionTouches.clear();
	}

	private on(t: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) {
		t.addEventListener(type, fn, opts);
		this.listeners.push([t, type, fn, opts]);
	}

	private key(e: KeyboardEvent, down: boolean): void {
		const c = e.code;
		let handled = true;
		if (KEY_LEFT.has(c)) this.held.left = down;
		else if (KEY_RIGHT.has(c)) this.held.right = down;
		else if (KEY_JUMP.has(c)) {
			if (down && !this.held.jump) this.latchJump = true;
			this.held.jump = down;
		} else if (KEY_DASH.has(c)) {
			if (down && !this.held.dash) this.latchDash = true;
			this.held.dash = down;
		} else if (KEY_REWIND.has(c)) {
			if (down && !e.repeat) this.commands.onRewind();
		} else if (KEY_PAUSE.has(c)) {
			if (down && !e.repeat) this.commands.onPause();
		} else handled = false;
		if (handled) {
			this.mode = 'keyboard';
			e.preventDefault();
		}
	}

	private touchStart(e: TouchEvent, layout: { splitX: number; padCenterX: number }): void {
		this.mode = 'touch';
		for (const t of Array.from(e.changedTouches)) {
			const target = t.target as HTMLElement | null;
			// let real UI buttons (pause, rewind) receive their own taps
			if (target?.closest?.('[data-ui]')) continue;
			e.preventDefault();
			if (target?.closest?.('[data-dash]')) {
				this.dashTouch = t.identifier;
				this.latchDash = true;
				this.held.dash = true;
				continue;
			}
			if (t.clientX < layout.splitX) {
				this.moveTouch = t.identifier;
				this.moveCenterX = layout.padCenterX;
				this.updateMove(t.clientX);
			} else {
				this.actionTouches.set(t.identifier, {
					x: t.clientX,
					y: t.clientY,
					t: performance.now(),
					swiped: false
				});
				this.latchJump = true;
				this.held.jump = true;
			}
		}
	}

	private touchMove(e: TouchEvent): void {
		for (const t of Array.from(e.changedTouches)) {
			if (t.identifier === this.moveTouch) {
				e.preventDefault();
				this.updateMove(t.clientX);
				continue;
			}
			const a = this.actionTouches.get(t.identifier);
			if (!a) continue;
			e.preventDefault();
			const dx = t.clientX - a.x;
			if (
				!a.swiped &&
				Math.abs(dx) > SWIPE_DIST &&
				performance.now() - a.t < SWIPE_MS &&
				Math.abs(dx) > Math.abs(t.clientY - a.y)
			) {
				a.swiped = true;
				this.latchDash = true;
				this.dashDir = dx > 0 ? 1 : -1;
			}
		}
	}

	private touchEnd(e: TouchEvent): void {
		for (const t of Array.from(e.changedTouches)) {
			if (t.identifier === this.moveTouch) {
				this.moveTouch = null;
				this.held.left = this.held.right = false;
			} else if (t.identifier === this.dashTouch) {
				this.dashTouch = null;
				this.held.dash = false;
			} else if (this.actionTouches.delete(t.identifier)) {
				this.held.jump = this.actionTouches.size > 0;
			}
		}
	}

	private updateMove(x: number): void {
		// small dead zone around the pad centre so resting a thumb there means "stand still"
		const dx = x - this.moveCenterX;
		this.held.left = dx < -10;
		this.held.right = dx > 10;
	}
}
