/**
 * Visual language: dark, calm environment; the player is the brightest object on screen; temporal
 * colour (cool cyan/violet) is reserved for ghosts and timeline events; coral means danger.
 */
export const PAL = {
	bgTop: '#070a12',
	bgBottom: '#0e1424',
	lattice: 'rgba(120,150,210,0.05)',
	solid: '#121a2b',
	solidInner: '#0f1524',
	edgeTop: '#3a4a6e',
	edgeSide: '#222d45',
	oneway: '#33415f',
	sign: 'rgba(140,160,205,0.55)',
	player: '#eef2f8',
	playerShade: '#b9c3d6',
	visor: '#ffb347',
	ghost: '#7fd3ff',
	ghostVisor: '#d9f3ff',
	desync: '#ff7aa8',
	rival: '#ffd27a',
	hazard: '#ff4d5e',
	hazardDim: 'rgba(255,77,94,0.18)',
	shard: '#cdb8ff',
	exit: '#f3efe6',
	mechIdle: '#4a5675',
	mechDark: '#1b2338',
	uiText: '#e8ecf5',
	uiDim: 'rgba(200,210,235,0.55)'
} as const;

/** Channel colours A–H, so every plate visibly belongs to its door. */
export const CHANNEL_COLORS = [
	'#6ef2c1',
	'#ffc861',
	'#b99bff',
	'#62b6ff',
	'#ff9c6b',
	'#9cff6b',
	'#ff7ad9',
	'#7af0ff'
];

/** Particle colours by index (kept as a table so the particle pool stores bytes, not strings). */
export const PARTICLE_COLORS = [
	PAL.player, // 0
	PAL.ghost, // 1
	PAL.hazard, // 2
	PAL.shard, // 3
	PAL.visor, // 4
	'#6ef2c1', // 5 mint
	'#8898bb', // 6 dust
	PAL.desync, // 7
	PAL.exit, // 8
	PAL.rival // 9
];
export const PC = {
	player: 0,
	ghost: 1,
	hazard: 2,
	shard: 3,
	visor: 4,
	mint: 5,
	dust: 6,
	desync: 7,
	exit: 8,
	rival: 9
} as const;

/** Letter shown on every channel-coloured mechanism, so channels never rely on colour alone. */
export const CHANNEL_GLYPHS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * Per-level environment theme. Only the environment changes (sky, architecture, edge light); the
 * player, echo, hazard and channel colours stay constant so the visual language never has to be
 * re-learned.
 */
export interface Theme {
	skyTop: string;
	skyBottom: string;
	/** far architecture silhouettes */
	far: string;
	/** mid-layer structure */
	mid: string;
	/** edge light on walkable surfaces and distant windows */
	accent: string;
	/** solid tile body */
	solid: string;
}

export const THEMES: Theme[] = [
	// 0 — cold observatory blue
	{
		skyTop: '#060911',
		skyBottom: '#0f1628',
		far: '#0c1322',
		mid: '#101a2e',
		accent: '#5aa9ff',
		solid: '#121a2b'
	},
	// 1 — teal archive
	{
		skyTop: '#050d10',
		skyBottom: '#0b1c22',
		far: '#0a171c',
		mid: '#0e2027',
		accent: '#4fe0c8',
		solid: '#10202a'
	},
	// 2 — violet foundry
	{
		skyTop: '#0a0712',
		skyBottom: '#171029',
		far: '#120d20',
		mid: '#191330',
		accent: '#a98bff',
		solid: '#171530'
	},
	// 3 — amber reactor
	{
		skyTop: '#0d0908',
		skyBottom: '#1f1510',
		far: '#18110d',
		mid: '#211812',
		accent: '#ffb35c',
		solid: '#1c1714'
	},
	// 4 — paradox core (finale)
	{
		skyTop: '#07060d',
		skyBottom: '#141022',
		far: '#100c1c',
		mid: '#18122a',
		accent: '#ff7aa8',
		solid: '#16122a'
	}
];
