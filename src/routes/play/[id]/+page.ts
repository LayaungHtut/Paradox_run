import { error } from '@sveltejs/kit';
import { CAMPAIGN } from '$lib/game/levels/campaign';
import { parseLevel } from '$lib/game/levels/parse';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const index = CAMPAIGN.findIndex((l) => l.id === params.id);
	if (index < 0) error(404, 'No such level');
	const def = CAMPAIGN[index];
	return {
		level: parseLevel(def),
		index,
		nextId: CAMPAIGN[index + 1]?.id ?? null
	};
};
