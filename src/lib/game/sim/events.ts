/**
 * Simulation events are how the pure sim tells the outside world (audio, particles, HUD) that
 * something happened. The buffer is preallocated and reused so stepping never allocates.
 */
export const Ev = {
	Jump: 1,
	Land: 2,
	Dash: 3,
	Death: 4,
	PlateOn: 5,
	PlateOff: 6,
	RelayOn: 7,
	DoorOpen: 8,
	DoorClose: 9,
	Shard: 10,
	Exit: 11,
	TurretLock: 12,
	TurretFire: 13,
	BoltHit: 14,
	GhostExpire: 15
} as const;
export type EvType = (typeof Ev)[keyof typeof Ev];

export interface SimEvent {
	type: EvType;
	x: number;
	y: number;
	/** body id that caused it (0 = player, ≥1 = ghost), or -1 */
	body: number;
	/** event-specific integer (entity index, landing speed ×10, …) */
	data: number;
}

export class EventBuffer {
	readonly items: SimEvent[] = [];
	count = 0;

	constructor(capacity = 256) {
		for (let i = 0; i < capacity; i++)
			this.items.push({ type: Ev.Jump, x: 0, y: 0, body: -1, data: 0 });
	}

	push(type: EvType, x: number, y: number, body: number, data = 0): void {
		if (this.count >= this.items.length) return; // drop rather than allocate; events are cosmetic
		const e = this.items[this.count++];
		e.type = type;
		e.x = x;
		e.y = y;
		e.body = body;
		e.data = data;
	}

	clear(): void {
		this.count = 0;
	}
}
