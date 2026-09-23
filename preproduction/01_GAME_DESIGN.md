# 01 — Game design (pre-production)

Working title: **PARADOX RUN** (title decision pending; see `00_RULES_AND_RISKS.md` R3).

## One sentence

A mobile arcade platformer where every loop you lose becomes an echo that replays your moves, and you
win by using your own failed attempts as teammates.

## Design pillars

1. **Your past self is your only teammate.** Every system must strengthen this, or it is cut.
2. **Arcade pace.** Loops of 15–25 s, instant retry, a clear score, a reason to replay today and tomorrow.
3. **Readable at a glance.** Dark calm world; the player is the brightest thing on screen; temporal
   colour (cyan/violet) only for echoes and timeline events; coral means danger.
4. **Fair and deterministic.** The same inputs always produce the same echo, so failure is always
   explainable.

## Core loop

```
START LOOP (time frozen until you move)
  → run / jump / dash through the level; loop timer counts down
  → loop ends: death · timer out · REWIND button
  → rewind effect streaks back along your path
  → next loop: your last N loops replay as echoes, in sync, from tick 0
  → use echoes to hold plates, trip relays, draw fire
  → reach the exit → results: time, score, stars → "Run again" / "Next"
```

## Rules of the timeline

- An echo repeats your recorded inputs exactly, and lasts exactly as long as its loop lasted.
- Echoes are physical: blocked by walls and closed gates, press plates, trip relays, ride lifts,
  and are targeted by enemies. They pass through you and each other, and cannot collect or finish.
- Echo capacity is per level (1–3). The oldest echo drops off when a new one exceeds it.
- If the world changes so that an echo can't follow its recording, it visibly **desyncs** (a
  "paradox"). That is legal, just usually bad.

## Mechanics (small set, deep interaction)

| Mechanic             | Behaviour                                               | Echo role                         | MVP     |
| -------------------- | ------------------------------------------------------- | --------------------------------- | ------- |
| Run / jump / dash    | Variable jump, coyote time, jump buffer, 1 air dash     | —                                 | ✅      |
| Spikes / pits        | Instant death                                           | —                                 | ✅      |
| Pressure plate       | Powers its channel while weighted                       | Hold it for you                   | ✅      |
| Gate                 | Solid unless its channel is powered; lingers briefly    | —                                 | ✅      |
| Relay (timed switch) | Touch → channel powered for N seconds                   | **Timing**: open it as you arrive | ✅      |
| Lift                 | Moves while its channel is powered; carries riders      | Hold the plate; ride together     | ✅      |
| Warden (turret)      | Locks the **nearest** visible body, charges, leads shot | **Decoy**                         | ✅      |
| Laser                | Pulsing, or disabled by a channel                       | Hold plate / trip relay           | Stretch |
| Shards               | Optional collectible, persists across loops             | —                                 | ✅      |

Colour-coded channels tie every plate or relay to what it controls. When an echo powers something,
draw a dashed "temporal link" from it to the target.

## Content plan (level beats, not maps)

Target: **6 campaign levels for MVP** (8 stretch), each 30–90 s for a skilled player and 2–5 min on
first play. Each level introduces one idea and then combines it with earlier ones. Maps are designed
fresh in October.

| #   | Working name  | Beat (what the player learns)                                                | Echoes |
| --- | ------------- | ---------------------------------------------------------------------------- | ------ |
| 1   | First Echo    | Die or rewind, see yourself; an echo holds a plate so you can pass the gate  | 1      |
| 2   | Relay         | Dash; a timed relay far from its gate: be at the gate when the echo trips it | 1–2    |
| 3   | Counterweight | A lift only rises while its plate is held; ride it                           | 1      |
| 4   | Decoy         | The Warden shoots the nearest body; send your past self first                | 1      |
| 5   | Two of Me     | Chain two echoes (lift plate, then gate plate)                               | 2      |
| 6   | Finale        | Lift, decoy and timed relay together, with 3 echoes                          | 3      |
| 7–8 | Stretch       | Decoy chain; pulsing-laser synchrony                                         | 2      |

Tutorial approach: no text screens. Short in-world signs, plus one-time contextual hints (for
example "stay on the plate and rewind — your echo will hold it").

## Score (primary metric: score; tie-break: time)

- +1000 loop closed
- +50 per second under par (whole timeline = sum of all loops)
- +250 per shard
- +200 per distinct mechanism an echo operated for you (plates, relays, decoys)
- +300 clean timeline (no deaths)
- Stars: ★ clear · ★★ under par · ★★★ under par with every shard

## Retention (all local, no network)

| Feature                | MVP     | Notes                                                                       |
| ---------------------- | ------- | --------------------------------------------------------------------------- |
| Stars + personal bests | ✅      | Per level, in localStorage                                                  |
| Race your best ghost   | ✅      | Your best winning loop runs as a gold ghost. Unique to this mechanic        |
| Daily Paradox          | ✅      | Date-seeded level variant (e.g. mirrored) + local streak                    |
| Achievements (~8)      | ✅      | Tied to the mechanic: decoy, paradox, clean timeline, 3 echoes…             |
| Share ghost code       | Stretch | Encode a run into a URL fragment / copyable code; opponent races it offline |
| Online leaderboard     | ❌ Out  | Not required by rules; would add network + hosting risk                     |

## Controls

| Action | Touch (landscape)                                  | Keyboard    |
| ------ | -------------------------------------------------- | ----------- |
| Run    | Left 40% of screen = movement pad (slide thumb)    | A/D, ←/→    |
| Jump   | Tap anywhere on the right side (hold = higher)     | Space, W, ↑ |
| Dash   | Flick right thumb horizontally, or the DASH button | Shift, X    |
| Rewind | ⟲ button, top right                                | R           |
| Pause  | ❙❙ button, top left                                | Esc, P      |

Mouse: menus fully usable by click. Gameplay on desktop is keyboard; declare this in the README.

## UX wireframes

### In-game, landscape (640×360 minimum)

```
┌───────────────────────────────────────────────────────────────┐
│ [❙❙] 1·FIRST ECHO        ▬▬▬▬▬▬▬|▬▬▬▬▬▬▬       TIME 12.4 [⟲] │
│      LOOP 2 · ECHOES 1/1  (echo end marker)    ◆ 0/1         │
│                                                               │
│          world (camera keeps floor above thumb zone)          │
│                                                               │
│  ┌──┐┌──┐                                        (DASH)       │
│  │◀ ││ ▶│   hint text (one-time)                    (JUMP)     │
└───────────────────────────────────────────────────────────────┘
```

### Portrait (360×640), MVP

```
┌──────────────────┐
│                  │
│   ⟲ phone icon   │
│ Turn your phone  │
│    sideways      │
│  [Back to menu]  │
└──────────────────┘
```

Stretch: portrait play mode with a vertically framed camera and bottom control strip.

### Screens

Title (attract-mode replay behind the menu) → Level select (stars, best time, echo capacity) → Game →
Pause (resume / restart / quit / volume) → Results (time, score breakdown, stars, new best, race
ghost, next) · Daily screen · Settings (volume, shake, reduced effects, FPS) · Achievements.

## Audio & visual direction

- Procedural vector art drawn with Canvas 2D (no bitmaps needed), and synthesised WebAudio SFX and
  music. There are no licensing issues and the build is tiny.
- Required SFX: jump, land, dash, death, shard, plate, relay, gate, echo spawn, echo assist, rewind,
  success, turret lock/fire, UI.
- Music: a generative loop whose intensity rises as the loop timer runs out.
- Game-feel budget: squash/stretch, dust, restrained screen shake (toggleable), rewind streak, echo
  shimmer and trail, hit flash.

## Explicit non-goals

Online leaderboards, accounts, multiplayer, inventories, currencies, character classes, story
cutscenes, level editor. Each fails the pillar test or the rules make it unnecessary.
