# PARADOX RUN — Architecture

## Phase 0 findings (repository audit)

| Item            | Finding                                                                   |
| --------------- | ------------------------------------------------------------------------- |
| Stack           | SvelteKit 2 + Svelte 5 (runes forced on), TypeScript 6, Vite 8            |
| Package manager | npm (`engine-strict=true`)                                                |
| Styling         | Tailwind 4 via `@tailwindcss/vite` (only used for menu/UI chrome)         |
| Tests           | Vitest 4, two projects: `server` (node) and `client` (Playwright browser) |
| Adapter         | `adapter-auto` → switched to `adapter-node` (see D6)                      |
| Assets          | None besides favicon. All art/audio is procedural (see D8)                |
| Conventions     | Tabs, single quotes, Prettier + ESLint flat config                        |

## Core idea as an engineering constraint

The signature mechanic — _your previous loop replays as a ghost that acts on the world_ — only works if
**the same inputs always produce the same simulation**. That single requirement drives the architecture:

```
input bitmask per tick ─▶ pure deterministic simulation ─▶ render (read-only)
          │                          ▲
          └─ recorded (RLE) ─────────┘  ghosts = the same simulation fed recorded inputs
```

Because the simulation is pure TypeScript with no DOM access, **the server can re-run a submitted run**
and compute the score itself. Leaderboard validation is therefore authoritative, not heuristic.

## Module layout

```
src/lib/game/
  core/        constants, deterministic RNG, small math helpers
  sim/         THE simulation: bodies, physics, mechanisms, enemies, world step. No DOM, no Math.random,
               no Date, no trig. Emits SimEvents (for audio/fx) into a reusable buffer.
  levels/      ASCII level format, parser, campaign + daily level definitions
  replay/      input recording, RLE + base64url codec, timeline (all loops of a run) serialization
  run/         RunSession: loops, ghost roster, loop limit, completion, scoring. Pure → used by the
               browser AND the server verifier.
  render/      Canvas 2D renderer, camera, pooled particles, procedural sprites
  input/       keyboard / touch / pointer → per-tick input bitmask
  audio/       WebAudio procedural SFX + adaptive generative music
  client/      GameController: rAF loop with fixed-step accumulator; bridges sim ↔ render ↔ UI
src/lib/state/ persistence (versioned localStorage), settings, progression, profile (Svelte 5 classes)
src/lib/components/  Svelte UI (menus, HUD, touch controls, results, leaderboard)
src/lib/server/      leaderboard store + run verification (re-simulation)
src/routes/          pages + /api endpoints
```

## Key decisions

**D1 — Fixed 60 Hz simulation, integer ticks.** `requestAnimationFrame` drives an accumulator; the sim
advances in whole ticks (max 5 per frame to avoid spiral-of-death). Rendering interpolates between the
previous and current body positions. Physics never sees a frame delta.

**D2 — Determinism rules for `sim/`.** Only `+ - * /`, comparisons, `Math.floor/abs/min/max/sqrt`
(all IEEE-exact). No `Math.sin`, `Math.random`, `Date`, iteration over unordered containers, or
engine-dependent behaviour. Randomness (daily variants) uses a seeded mulberry32 outside the tick.

**D3 — Inputs, not positions, are recorded.** One byte per tick (`LEFT|RIGHT|JUMP|DASH`), run-length
encoded, base64url. A 30 s loop typically encodes to < 100 bytes. Positions are sampled in memory only
for rewind visuals and desync detection — never serialized.

**D4 — Ghosts are real bodies.** A ghost is the same `Body` type as the player, driven by recorded
input. It collides with level geometry and doors, presses plates, trips relays and draws enemy fire.
It does **not** collide with the player or other ghosts, and cannot collect shards or finish the level.
If the world diverges (e.g. a door the ghost used is now shut) the ghost physically diverges too — we
detect this against in-memory position samples and render the ghost as "desynced" (a paradox).

**D5 — A run is a timeline.** A run = ordered list of loops (input streams). Loop _n_ is simulated with
loops _n-k…n-1_ as ghosts (k = the level's ghost capacity). The final loop reaches the exit. Server
verification replays the whole timeline and must reach the exit in the final loop.

**D6 — adapter-node + file-backed store.** The leaderboard needs durable storage and no paid service
or credentials are available. `adapter-node` with an atomic JSON file store (`DATA_DIR`) gives real
persistence on any Node host. The store sits behind an interface so a KV/DB backend can be added;
serverless hosts without a writable disk are **not** supported until such a backend exists.

**D7 — Svelte never ticks per frame.** The GameController exposes a tiny HUD snapshot object that the
HUD polls at ~10 Hz, plus discrete events (loop ended, level complete). Canvas does all gameplay drawing.

**D8 — Procedural assets only.** Sprites are drawn with Canvas paths; audio is synthesised with
WebAudio. No third-party art or music → no licensing risk and ~zero asset weight.

**D9 — Landscape-first, portrait playable.** Side-scrolling platforming needs horizontal read-ahead, so
landscape is preferred (phones request a landscape lock when supported). Portrait still plays: the camera
shows 16 tiles across instead of 20, the HUD drops the loop bar to a second row, and a tip suggests rotating. Touch layout: left thumb ◀ ▶, right thumb tap = jump, swipe = dash.

## Risk list

| Risk                                            | Mitigation                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Non-determinism breaks ghosts / verification    | D2 rules, determinism unit tests (same inputs ⇒ identical state hash)           |
| Levels unsolvable or too hard                   | Scripted closed-loop "solution bots" per level run in CI through the verifier   |
| Ghost mechanic confusing for first-time players | Level 1 teaches it through level geometry + in-world signage, rewind animation  |
| Mobile touch controls feel bad                  | Large zones, no small buttons for movement, tested in mobile emulation          |
| Performance on low-end phones                   | Precomputed geometry runs, pooled particles, DPR cap, no per-frame allocations  |
| Leaderboard cheating                            | Server re-simulates the full timeline; payload/size/rate limits; version gating |
| Durable storage on serverless hosts             | Documented limitation; storage interface for a future KV backend                |
| Audio autoplay restrictions                     | AudioContext resumed on first user gesture                                      |

## Implementation notes

- **Server verification** (`src/lib/server/validate.ts`) re-runs `verifyTimeline` from `run/session.ts`,
  the same code the browser plays. The client never sends a score.
- **Solvability CI:** `testing/bot.ts` scripts read live sim state like a player and produce ordinary
  input recordings. `run/session.spec.ts` plays all levels (normal and mirrored), verifies them, and
  checks that each level needs its echoes.
- **Rendering budget:** geometry is merged into runs at load time, and particles live in a typed-array
  pool. Canvas resolution is capped at about 0.9 MP, and the controller steps resolution down (and
  drops decorative layers) if frames stay slow. Rendering JS measures about 0.2 ms per frame; the
  remaining cost is rasterisation.
- **Dev-only QA hook:** in `npm run dev` the active controller is exposed as `window.__game` for
  automated browser tests; it is compiled out of production builds.
- **Offline:** `src/service-worker.ts` precaches the build. `lib/net/queue.ts` queues submissions that
  fail for network reasons.

## Systems reference (production pass)

### Game loop

`client/controller.ts` drives `requestAnimationFrame`. Each frame adds real elapsed time to an
accumulator and advances the simulation in fixed 1/60 s ticks (at most 5 per frame, then it drops time
rather than spiralling). Rendering interpolates positions by `acc / TICK_MS`. Phases:
`ready` (time frozen until the player moves) → `playing` → `dying` (70 ms hit-stop, 0.3 s) →
`rewinding` (0.55 s) → next loop. Pressing jump or dash skips the death and rewind animations, so a
retry costs well under a second.

### Replay and echoes

- Input: one byte per tick (`LEFT|RIGHT|JUMP|DASH`), RLE plus base64url (`replay/codec.ts`).
- `run/session.ts` records the loop in progress. When it ends (death, timeout, rewind), the input
  stream becomes a loop record; the next `World` is built with the last _N_ records as ghost bodies.
- A ghost is an ordinary `Body` whose input comes from its recording. At the end of the recording it
  expires. Positions are sampled every 6 ticks in memory only, to flag **desync** when the world has
  changed under an echo.

### Versioning

- `SIM_VERSION` (currently **2**): bumped whenever physics changes; v2 added ceiling-corner correction.
- **Level version** (`levelVersion()` in `levels/parse.ts`): a hash of the map, legend, loop length,
  echo capacity and par. Stored in every timeline (`lv`). Replays from another version are rejected
  by the verifier and are not used as best ghosts. Daily variants with modifiers get their own version.

### Level system

ASCII maps with a per-level legend (`levels/campaign.ts`), parsed into typed geometry and mechanism
arrays (`levels/parse.ts`). Channels A–H connect plates and relays to gates, lifts and lasers.
Solvability, echo-dependence and three-star reachability are proven in CI by closed-loop bots
(`testing/bot.ts`, `testing/solutions.ts`).

### Rendering

`render/renderer.ts` only sequences layers; each layer is its own module:

| Module          | Draws                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| `background.ts` | Themed sky and two seeded parallax layers of architecture (faint by design) |
| `tiles.ts`      | Merged solid runs, panel pattern, accent-lit walkable edges, spikes, ledges |
| `mechanisms.ts` | Signs, exit, shards, gates, plates, relays, lifts, lasers, links, Wardens   |
| `actors.ts`     | Player (scarf, squash/stretch), echo holograms, best-ghost, rewind runner   |
| `overlays.ts`   | Time-fracture bursts, vignette, rewind VHS, flash/fade, loop timeline bar   |

Accessibility: every channel object shows a **letter** as well as its colour; reduced motion disables
shake and fractures; reduced flashing dims full-screen flashes. Adaptive quality: after sustained slow
frames, step 1 drops decorative layers and hologram scanlines, steps 2–3 lower resolution.

### Persistence

`state/progress-logic.ts` holds the pure rules: recording results, best score and best time (the
best-time timeline is the personal ghost), achievements, daily streak, and `sanitizeProgress()`, which
repairs a corrupted save field by field. `progress.svelte.ts` wraps it in Svelte state and writes
versioned JSON to localStorage. Settings are sanitised the same way (type-checked and clamped).

### Networking (optional)

The only network use is the leaderboard (`/api/runs`, `/api/leaderboard`, `/api/runs/[id]`). Every
call has a timeout; failures never block play; network failures queue the submission in localStorage
for retry. The server re-simulates every timeline and never accepts a client score.
