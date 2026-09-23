/**
 * Level authoring format.
 *
 * Levels are ASCII maps. Fixed glyphs:
 *   #  solid          =  one-way platform     ^  floor spikes     v  ceiling spikes
 *   P  player spawn   X  exit gate            *  temporal shard   .  / space  empty
 *
 * Any other glyph must be declared in `legend` and describes a mechanism. Mechanisms talk to each
 * other through channels 'A'…'H': plates and relays power a channel; doors, lifts and lasers react.
 */
export type ChannelName = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export type EntitySpec =
	| { type: 'plate'; ch: ChannelName }
	| {
			type: 'relay';
			ch: ChannelName;
			/** ticks the channel stays powered; 0 = latch for the loop */ duration: number;
	  }
	| {
			type: 'door';
			ch: ChannelName;
			/** closed while powered */ invert?: boolean;
			/** ticks before closing */ linger?: number;
	  }
	| {
			type: 'lift';
			ch: ChannelName;
			/** travel (in tiles) when the channel is powered */
			dx: number;
			dy: number;
			/** world units per tick */
			speed?: number;
	  }
	| {
			type: 'laser';
			/** powered channel switches the beam OFF (or ON when `invert`) */
			ch?: ChannelName;
			invert?: boolean;
			/** timed beam: on for `on` ticks out of every `period`, offset by `phase` */
			period?: number;
			on?: number;
			phase?: number;
	  }
	| { type: 'turret'; /** detection range in tiles */ range: number };

export interface SignDef {
	/** tile coordinates of the sign's anchor */
	x: number;
	y: number;
	text: string;
}

export interface LevelDef {
	id: string;
	name: string;
	/** one-line hook shown on the level card */
	tagline: string;
	map: string[];
	legend?: Record<string, EntitySpec>;
	/** each loop collapses after this many seconds */
	loopSeconds: number;
	/** how many previous loops replay as ghosts */
	maxGhosts: number;
	/** par for the whole timeline (sum of all loops), seconds */
	parSeconds: number;
	signs?: SignDef[];
}
