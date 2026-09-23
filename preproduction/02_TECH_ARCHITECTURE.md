# 02 — Technical architecture (pre-production)

## Stack decision

| Choice         | Decision                                                                  | Why                                                                    |
| -------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| UI shell       | **Svelte 5 + SvelteKit with `adapter-static`**, single route, `ssr=false` | Your chosen stack; static output fits Digit7s hosting                  |
| Paths          | `kit.paths.relative = true`; no absolute URLs                             | Hosting base path is unknown (root or subfolder)                       |
| Routing        | In-app screen state (no multi-page routes)                                | Avoids 404s on refresh under an unknown path / static host             |
| Rendering      | Canvas 2D                                                                 | Vector procedural art; universal browser support; no WebGL risk        |
| Audio          | WebAudio, synthesised                                                     | Zero assets, zero licences                                             |
| Persistence    | localStorage (versioned, defensive)                                       | Allowed; simple                                                        |
| Network        | **None**                                                                  | "External network use: None"; nothing to declare or break              |
| Service worker | **None**                                                                  | Offline not required; a caching SW risks judges seeing a stale version |
| Fonts          | System font stack                                                         | No external requests, no font licences                                 |
| Tests          | Vitest (node) + Playwright smoke tests                                    | Already in the toolchain                                               |

Fallback if SvelteKit's static output fights the hosting setup: plain **Vite + Svelte 5** (same
components, no Kit). Decide on day 1 after a hello-world deploy (see `03_PRODUCTION_PLAN.md`).

## Module boundaries

```
src/lib/game/
  core/      constants (physics, tick rate), seeded RNG, input bit flags
  sim/       deterministic world: bodies, collision, mechanisms, enemies, event buffer
  levels/    level format + parser; level definitions (authored in October)
  replay/    per-tick input recording, RLE codec
  run/       run session: loops, echo roster, loop limit, scoring, result
  render/    canvas renderer, camera, pooled particles, procedural sprites
  input/     keyboard + touch zones → per-tick bitmask
  audio/     WebAudio SFX + generative music
  client/    game controller: rAF + fixed-step loop, phases, feedback
src/lib/state/  settings, progress, achievements (Svelte 5 rune classes, localStorage)
src/lib/ui/     Svelte components: HUD, touch overlay, menus, results
```

Rule: `sim/`, `run/`, `replay/`, `levels/` import **nothing** from the DOM. That keeps them unit-
testable in Node and deterministic.

## Determinism contract (the ghost system depends on it)

1. Fixed 60 Hz simulation in integer ticks; rendering interpolates; max ~5 sim steps per frame.
2. Inside `sim/`: only `+ − × ÷`, comparisons, `floor/abs/min/max/sqrt` (IEEE-exact). No
   `Math.random`, `Date`, trig, or unordered iteration.
3. Record **inputs, not positions**: one byte per tick (left/right/jump/dash), run-length encoded.
4. An echo is simply another body driven by a recorded input stream. The world state then follows
   from the rules.
5. Positions are sampled in memory only, for rewind visuals and desync detection.
6. Tests: the same inputs must produce an identical state hash; the codec must round-trip.

## Level format

ASCII tile maps plus a small legend for mechanisms, linked by channel letters. Every level ships
with a **scripted solution** (a closed-loop "bot" that reads the sim state and emits inputs). CI
replays it, normal and mirrored, and asserts that (a) it reaches the exit and (b) the final loop
alone does _not_, which proves the level needs its echoes.

## Performance budget

| Item          | Target                                                                       |
| ------------- | ---------------------------------------------------------------------------- |
| Frame         | 60 fps; sim + render JS < 3 ms on mid-range phones                           |
| Canvas pixels | Cap ~0.9 MP (DPR clamp), adaptive downscale if frames stay slow              |
| Allocation    | No per-frame allocation in sim/render; pooled particles; reused event buffer |
| Geometry      | Merge tiles into runs at load; cull to camera                                |
| Bundle        | < 1 MB total, no binary assets; loads in < 2 s on 4G                         |

## Browser / device matrix (manual test each milestone)

| Platform    | Browser               | Checks                                                           |
| ----------- | --------------------- | ---------------------------------------------------------------- |
| Windows 11  | Chrome, Edge, Firefox | Keyboard play, 1280×720, audio unlock                            |
| macOS       | Safari                | Canvas `roundRect` fallback, audio unlock                        |
| Android 10+ | Chrome                | Touch zones, multi-touch, landscape, vibration optional          |
| iOS 16+     | Safari                | No fullscreen API; safe areas; audio unlock on first tap; 100dvh |

Known platform traps to design around: iOS audio needs a user gesture; iOS has no
`requestFullscreen`/orientation lock, so rely on the rotate prompt; `ctx.roundRect` is missing in
older Safari/Firefox, so provide a path fallback; use `touch-action: none` on the stage.

## Testing strategy

- **Unit (Vitest, node):** physics invariants, plate/gate/relay/lift/turret behaviour, codec,
  determinism hash, scoring, progress migration.
- **Level CI:** every level is solvable (normal and mirrored) and genuinely needs its echoes.
- **Browser smoke (Playwright):** load, start level 1, scripted keyboard play, results screen, no
  console errors; emulated phone at 640×360 and 360×640 (rotate prompt).
- **Manual:** real Android + iPhone before each milestone; listen to audio; play a full campaign.
- **Screening rehearsal:** build → ZIP → unzip in a clean folder → serve statically from a
  _subfolder_ → play. This mimics the unknown hosting path.

## Security & privacy

No network requests, analytics, ads or personal data. Only settings, progress and anonymous
display names go to localStorage. No `eval`, no remote scripts.
