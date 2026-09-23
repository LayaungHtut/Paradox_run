# Game design

## Core fantasy

**Your failures become your teammates.** Every loop you lose is replayed as a physical echo, and you
win by building a team out of your own past attempts. The target moment: _"I couldn't do this alone
— but my past selves can."_

## Rules of the timeline

1. A level is played in **loops** of fixed maximum length (15–24 s).
2. A loop ends when you die, when time runs out, or when you press **Rewind**.
3. Every ended loop becomes an **echo**. The next loop starts from tick 0 with the most recent
   _N_ echoes (the level's capacity, 1–3) replaying their recorded inputs in sync with you.
4. Echoes are real bodies. They collide with walls and doors, press plates, trip relays, ride lifts and
   draw Warden fire. They pass through you and each other, and cannot collect shards or finish.
5. An echo lasts exactly as long as its loop did. **Rewinding early gives a shorter echo.**
6. If the world changes (for example, you close a door an echo walked through), the echo physically
   diverges from its recording. It turns pink with a "?" label: a **paradox**.

Time is frozen at the start of each loop until you move, so you can read the situation.

## Mechanics (deliberately few)

| Mechanism | Behaviour                                                        | Echo use                        |
| --------- | ---------------------------------------------------------------- | ------------------------------- |
| Plate     | Powers its channel while anything stands on it                   | Hold a gate or lift for you     |
| Relay     | Touch to power its channel for a few seconds                     | Timing: open it as you arrive   |
| Gate      | Solid while its channel is unpowered; won't close on a body      | —                               |
| Lift      | Moves while its channel is powered, carries riders               | Hold the plate; ride together   |
| Laser     | Timed pulses, or disabled by a channel                           | Hold the plate / trip the relay |
| Warden    | Locks onto the **nearest** visible body, charges, leads its shot | Decoy                           |
| Shard     | Optional collectible; stays collected across loops               | —                               |

Colour always encodes the channel, so a plate visibly belongs to its gate. When an echo powers a
mechanism, a dashed temporal link is drawn from the echo's plate or relay to what it controls.

## Levels

| #   | Level          | New idea                                                  | Echoes |
| --- | -------------- | --------------------------------------------------------- | ------ |
| 1   | First Echo     | Your past self can hold a plate for you                   | 1      |
| 2   | Relay          | A timed switch far from its gate: be there when it fires  | 1      |
| 3   | Overdrive      | Dash across a chasm via a stepping stone your echo raises | 1      |
| 4   | Counterweight  | A lift that only rises while the plate is held            | 1      |
| 5   | Decoy          | The Warden shoots whoever is closest                      | 1      |
| 6   | Two of Me      | Two echoes chained: lift, then gate                       | 2      |
| 7   | Crossfire      | Two Wardens: each lost loop buys the next one             | 2      |
| 8   | Synchrony      | Arrive at the curtain when your echo opens it             | 2      |
| 9   | Paradox Engine | Three echoes: one lifts, one falls, one stays behind      | 3      |

Level 1 teaches without a tutorial screen. The route leads straight to a plate and a gate that is too
far away to reach alone. A one-time hint appears after a second of standing on the plate, and when the
next loop starts, the player watches themselves walk up and hold it.

### Level design principles

- Every level answers "why do I need an echo?". CI enforces it: each level's final winning route is
  replayed alone and must fail.
- One new idea per level, then combined with earlier ones.
- Winning runs take 8–35 s; first-time completion takes a few minutes.
- Failure is informative: echoes, the loop bar's expiry markers and temporal links show exactly what
  your past self did and when it will stop.
- Forgiving controls, demanding levels: coyote time, jump buffering, ceiling-corner correction, and
  spike hitboxes smaller than the art.

Every level has scripted solutions (`src/lib/game/testing/solutions.ts`) that CI replays normally and
mirrored. There is also a three-star route per level that proves every shard is reachable and every
par is beatable.

## Score

Ranking metric: **score**; ties broken by time. The results screen shows the breakdown:

- 1000 for closing the loop
- +50 per second the whole timeline finishes under par
- +250 per shard
- +200 per distinct mechanism an echo operated for you (plates, relays, and Warden decoys)
- +300 for a clean timeline (no deaths; rewinds and timeouts are fine)

Stars: ★ clear · ★★ under par · ★★★ under par with every shard.

## Retention

- **Personal-best ghost:** the fastest run of each level replays in gold beside you (toggle in
  settings). Only runs recorded on the current version of a level are replayed.
- **Daily Paradox:** one variant per UTC day: a post-tutorial campaign level plus modifiers (Mirror
  World; Short Fuse = 20% shorter loops; Par Blitz = 25% tighter par). Short Fuse is applied only when
  the level's known solution still wins under it, and CI checks a whole month of dailies. This is a
  remix of existing levels, not new procedural content.
- **Ghost challenges:** race anyone's verified leaderboard run; share links from the results screen.
- **Achievements (13):** First Echo, Ghost Whisperer, Decoy, Paradox, Three Echoes, No Death Clear,
  Speed Runner, Perfect Loop, Beat Your Ghost, Full Completion, Paradox Master, Daily Runner, Daily
  Streak.

## Known limitations

1. **Tested in emulation, not on real phones.** Touch, layout and performance were verified in Chromium
   (desktop and phone emulation at 360×640, 640×360 and 1280×720). They have not been tried on physical
   iOS or Android hardware. iOS Safari allows no fullscreen or orientation lock for web pages.
2. **Audio untuned by ear.** Automated browser tests prove every sound renders clean, audible signal
   without clipping, but mix balance and taste need a human listen.
3. **Content is 9 levels.** Dailies remix them; a dedicated player will recognise the layouts.
4. **Weak-device performance is unmeasured on hardware.** The sim costs about 7.5 µs per tick, and
   rendering JS about 1 ms per frame with three echoes. Under 4× CPU throttling in headless Chromium
   (software rasterisation) frames average about 60 ms; adaptive quality drops decorative layers and
   then resolution. Real GPU-rasterised phones should do far better, but that is unverified.
5. **Leaderboard hosting** needs one Node process with a disk; serverless is not supported.
6. **Identity is anonymous.** Names are not unique; clearing browser storage loses local progress.
