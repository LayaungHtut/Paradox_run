# Deployment

PARADOX RUN is a SvelteKit app built with `@sveltejs/adapter-node`. The output in `build/` is a
standalone Node server that serves the game and the leaderboard API.

## Build and run

```sh
npm ci
npm run build
DATA_DIR=/var/lib/paradox-run HOST=0.0.0.0 PORT=3000 node build
```

| Variable         | Default   | Purpose                                                                       |
| ---------------- | --------- | ----------------------------------------------------------------------------- |
| `DATA_DIR`       | `./data`  | Directory for `leaderboard.json`. Must be writable and persistent.            |
| `PORT`           | `3000`    | HTTP port (adapter-node).                                                     |
| `HOST`           | `0.0.0.0` | Bind address (adapter-node).                                                  |
| `ORIGIN`         | —         | Set to the public URL when behind a proxy (adapter-node).                     |
| `ADDRESS_HEADER` | —         | e.g. `X-Forwarded-For` behind a proxy, so rate limiting sees real client IPs. |

Put it behind HTTPS (Caddy, nginx, a platform load balancer). The service worker and
`navigator.share` require a secure origin.

## Where it can run

Works on any host that runs **one long-lived Node process with a persistent disk**: a VPS, Fly.io or
Railway with a volume, Render with a disk, a Docker container with a mounted volume.

**Not supported as-is:** serverless platforms (Vercel, Netlify functions, Cloudflare Workers). They have
no persistent writable disk, so the leaderboard would reset. The storage layer is isolated in
`src/lib/server/store.ts` (`LeaderboardStore`) so a KV/database backend can replace it; that backend is
**not implemented**.

The core game needs no server at all: a static host would serve a fully playable offline game, but
leaderboards, daily boards and ghost challenges would show "unavailable".

## Static build (Netlify)

`netlify.toml` builds with `VITE_STATIC_BUILD=1`, which swaps adapter-node for adapter-static (SPA
fallback to `index.html`) and turns the API client off. The whole game works, including local progress,
the daily puzzle and your best ghost. Leaderboards, verified ranks and ghost challenge links show
"online features are off in this build". To deploy, import the GitHub repo in the Netlify dashboard; the
build settings come from `netlify.toml`. Build it locally with `VITE_STATIC_BUILD=1 npm run build`.

## Data and limits

- One JSON file, written atomically (temp file + rename), debounced 250 ms. Each board keeps the best
  entry per player, capped at 1000 entries.
- Submissions: 128 KB max body, 12 per minute per IP and per player. Reads: 120 per minute per IP.
  The limits are in memory and reset on restart.
- Every submission is re-simulated. A run takes a few milliseconds to verify.
- Daily boards accept submissions for today and yesterday (UTC), so runs finished just after midnight
  still count.

## Backups

Copy `$DATA_DIR/leaderboard.json`. It is the only state on the server; everything else lives on players'
devices.

## Changing physics

Any change to `src/lib/game/sim` or `PHYS` constants must bump `SIM_VERSION` in
`src/lib/game/core/constants.ts`. Old replays are then rejected rather than mis-verified, so start a
fresh `leaderboard.json` (or archive the old one) when you deploy it.
