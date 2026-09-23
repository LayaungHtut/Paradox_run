# PARADOX RUN

**Every run you lose runs with you.**

A mobile-first time-loop arcade platformer. Each loop you finish — by dying,
running out of time, or pressing **Rewind** — becomes an _echo_: a ghost that replays your exact inputs
in the next loop. Echoes hold pressure plates, trip relays, ride lifts and draw turret fire. You win by
building a successful run out of your own failed attempts.

## Play

| Input  | Touch (landscape)                          | Keyboard       |
| ------ | ------------------------------------------ | -------------- |
| Run    | Left thumb: slide left / right             | A / D or ← / → |
| Jump   | Tap anywhere on the right (hold = higher)  | Space / W / ↑  |
| Dash   | Flick the right thumb, or the DASH button  | Shift / X      |
| Rewind | ⟲ button — ends the loop, keeps it as echo | R              |
| Pause  | ❙❙ button                                  | Esc / P        |

- **Campaign:** 9 levels, each introducing one idea about cooperating with your past self
  (plates → timed relays → dash → lifts → decoys → two echoes → decoy chains → echo timing → three
  echoes), ending with a closing screen.
- **Personal-best ghost:** your fastest run of each level races beside you in gold. Beat it.
- **Daily Paradox:** one date-seeded variant for everyone each UTC day (a remixed campaign level with
  modifiers such as Mirror World, Short Fuse or Par Blitz), with its own board and a local streak.
- **Progression:** sequential unlocks, stars, best time and score, 13 achievements. All saved locally,
  no account needed; corrupted saves are repaired field by field.
- **Leaderboards:** per level and per day. Every entry is **re-simulated on the server** from recorded
  inputs; the client never sends a score.
- **Beat this ghost:** any leaderboard run can be raced — their winning loop runs beside you as a gold
  ghost. Share links from the results screen.
- Works offline (service worker). Runs finished offline are queued and submitted on reconnect.

## Develop

Requires Node 22+ (tested on 24) and npm.

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # all tests: node (sim, levels, progression, server) + real Chromium (audio, UI)
npm run check        # svelte-check / TypeScript
npm run lint         # prettier + eslint
npm run build        # production build (adapter-node) → ./build
```

The test suite plays **every campaign level, normal and mirrored,** with scripted closed-loop "bots",
then re-verifies the resulting timelines exactly as the server does. It also checks that each level's
final route _fails_ without the earlier loops, so no level can be beaten solo by accident.

## Deploy

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Short version:

```sh
npm ci && npm run build
DATA_DIR=/var/lib/paradox-run PORT=3000 node build
```

Browser tests use Playwright's Chromium; install it once with `npx playwright install chromium`.

## Browser requirements

Current Chrome, Edge, Firefox and Safari (desktop and mobile). Needs Canvas 2D and ES2022; WebAudio
is optional (the game runs silently without it). Best in landscape on phones; portrait shows a
rotate prompt with a way back to the menu.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — deterministic simulation, replay format, module layout, risks
- [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) — mechanics, levels, scoring, known weaknesses
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — hosting, data, limits
- [docs/AI_USE_LOG.md](docs/AI_USE_LOG.md) — what was AI-assisted and how it was verified

## Assets & licensing

All visuals are drawn procedurally with Canvas 2D and all audio (sound effects and music) is synthesised
at runtime with WebAudio. The project ships no third-party art, fonts or music.
