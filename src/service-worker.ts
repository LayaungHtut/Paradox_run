/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

/*
 * Offline-first: the whole game (code + procedural assets) is precached, so the core loop works with
 * no network at all. Leaderboard calls (/api) always go to the network and fail gracefully offline.
 */
const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `paradox-${version}`;
const SHELL = '/';
const PRECACHE = [...build, ...files, SHELL];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((c) => c.addAll(PRECACHE))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== sw.location.origin || url.pathname.startsWith('/api/')) return;

	// immutable build assets: cache first
	if (PRECACHE.includes(url.pathname) && url.pathname !== SHELL) {
		event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
		return;
	}

	// page navigations: network first, fall back to the cached app shell (ssr is off, every route is the shell)
	if (req.mode === 'navigate') {
		event.respondWith(
			fetch(req).catch(async () => (await caches.match(SHELL)) ?? Response.error())
		);
	}
});
