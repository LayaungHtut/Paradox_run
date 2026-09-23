/** Achievements reward understanding the timeline mechanic, not grinding. */
export interface AchievementDef {
	id: string;
	name: string;
	desc: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
	{ id: 'hello-me', name: 'First Echo', desc: 'Meet your first echo.' },
	{ id: 'self-help', name: 'Ghost Whisperer', desc: 'Let an echo open the way for you.' },
	{ id: 'decoy', name: 'Decoy', desc: 'An echo takes a hit meant for you.' },
	{ id: 'paradox', name: 'Paradox', desc: 'Change the past enough that an echo desyncs.' },
	{ id: 'crowd', name: 'Three Echoes', desc: 'Finish with three echoes in play.' },
	{ id: 'clean', name: 'No Death Clear', desc: 'Finish a level without a single death.' },
	{
		id: 'speed-runner',
		name: 'Speed Runner',
		desc: 'Finish a level in under 60% of its par time.'
	},
	{ id: 'three-stars', name: 'Perfect Loop', desc: 'Earn ★★★ on any level.' },
	{
		id: 'beat-ghost',
		name: 'Beat Your Ghost',
		desc: 'Finish faster than your own best-run ghost.'
	},
	{ id: 'closed-loop', name: 'Full Completion', desc: 'Finish every campaign level.' },
	{ id: 'paradox-master', name: 'Paradox Master', desc: 'Earn ★★★ on every campaign level.' },
	{ id: 'daily', name: 'Daily Runner', desc: 'Complete a Daily Paradox.' },
	{ id: 'habit', name: 'Daily Streak', desc: 'Complete the Daily Paradox three days in a row.' }
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);
