# 03 — Production plan (1–31 October 2026)

Deadline: **Sat 31 Oct 23:59:59 Myanmar time**. Internal target: **Final Submit on Fri 30 Oct**.

## Scope

### MVP (must ship, in priority order)

1. Deterministic movement: run, variable jump, coyote/buffer, dash; spikes and pits.
2. Loop system: loop timer, rewind button, echoes replaying inputs, echo capacity, rewind effect.
3. Mechanisms: plate + gate, relay (timed), lift, Warden (nearest-body turret) + bolts.
4. Touch (landscape) + keyboard controls; pause; rotate prompt in portrait.
5. HUD: loop bar with echo expiry markers, loop/echo count, time, shards.
6. 6 campaign levels with scripted solutions in CI.
7. Results screen: time, score breakdown, stars, personal best; level select; local progress.
8. Juice: particles, squash/stretch, shake (toggle), temporal links, desync feedback.
9. Procedural SFX + generative music; volume settings.
10. Retention: race-your-best gold ghost, Daily Paradox (date-seeded variant + streak), ~8 achievements.
11. Submission pack (README, declarations, credits, screenshots, video).

### Stretch (only after the M3 gate is green)

Portrait play mode · levels 7–8 · pulsing lasers · shareable ghost code (URL fragment, no network) ·
attract-mode title replay · colour-blind-safe channel shapes · haptics.

### Cut list (in this order, if behind schedule)

Achievements → daily streak UI → level 6 → music (keep SFX) → desync visuals → race-your-best ghost.
**Never cut:** echo mechanic, determinism, touch controls, level 1 quality, stability.

## Milestones

| Milestone                | Date       | Definition of done                                                                                    |
| ------------------------ | ---------- | ----------------------------------------------------------------------------------------------------- |
| **M0 Setup**             | Thu 1 Oct  | New private repo, scaffold, CI, hello-world deployed to the Digit7s host (or a static subfolder test) |
| **M1 Core loop**         | Sun 4 Oct  | See "First milestone" below                                                                           |
| **M2 Vertical slice**    | Sun 11 Oct | Levels 1–3 polished on real phones; all MVP mechanisms; results + progress                            |
| **M3 Content complete**  | Sun 18 Oct | 6 levels, audio, daily, best-ghost race, achievements. **Feature freeze**                             |
| **M4 Release candidate** | Sun 25 Oct | Device matrix passed, perf budget met, no known crashes, stretch items only if safe                   |
| **M5 Submitted**         | Fri 30 Oct | Deployed, ZIP, repo tag, docs, video, portal Final Submit reference saved                             |
| Buffer                   | Sat 31 Oct | Fixes only; resubmit if needed before 23:59:59 MMT                                                    |

## 1 October implementation sequence

Work in this order; commit after each step (small, descriptive commits build the required history).

1. **Repo hygiene (30 min).** Create a new private GitHub repo in a new folder (not the prototype
   folder). Add `README.md` stub, `.gitignore`, `LICENSE` (your choice), and
   `docs/AI_USE_LOG.md` from `04_COMPLIANCE.md`. First commit.
2. **Scaffold (30 min).** `npx sv create` (SvelteKit minimal, TS, Prettier, ESLint, Vitest).
   Switch to `adapter-static`, `ssr=false`, `paths.relative=true`. Commit.
3. **Deploy spike (1 h).** Build a blank page that draws a canvas, deploy to the Digit7s host (or
   serve `build/` from a subfolder locally if access is not yet available), and open it on a phone.
   This proves the pipeline before any game code. Commit.
4. **Fixed-step loop + input (2 h).** rAF loop with accumulator; keyboard and touch zones → per-tick
   bitmask; debug overlay showing the input bits. Commit.
5. **Physics body + tile collision (3 h).** A test room from an ASCII map; run, jump, dash; unit
   tests for landing, walls and jump height. Commit.
6. **Recording + echo playback (2 h).** Record inputs per tick; on loop end, restart with echoes
   replaying; determinism hash test. Commit.
7. **Plate + gate (2 h).** Channel system; echo holds a plate, player passes. Unit test. Commit.

Steps 5–7 may spill into 2 October. That is fine.

## First milestone definition — M1 "Core loop" (Sun 4 Oct)

M1 is done when **all** of these are true:

- [ ] A greybox of level 1 is playable end-to-end in the browser: move, jump, dash, die on spikes,
      rewind, loop timer.
- [ ] Each ended loop replays as an echo from tick 0, and the echo matches the original run exactly
      (determinism unit test green).
- [ ] An echo standing on a plate holds a gate open so the player can pass, and it's impossible solo.
- [ ] Works with keyboard on desktop Chrome **and** with touch on one real phone (landscape).
- [ ] Deployed build runs from a subfolder path with no console errors.
- [ ] Level 1 has a scripted solution that passes in CI.
- [ ] AI use log is up to date; every file has been read and understood by a team member.
- [ ] At least one playtester who has never seen the game says "wait, that's me?"

If M1 slips past Tue 6 Oct, cut to 5 levels and drop stretch goals immediately.

## Weekly rhythm

- **Daily:** play the build on a phone, update the AI use log, and commit working increments (no
  giant commits).
- **Each milestone:** browser matrix spot-check, screening rehearsal (ZIP → subfolder → play), and
  outside playtest (watch silently; note the first 30 seconds).
- **Mid-month (Oct 15):** decide the final title, freeze art direction, and start collecting
  screenshots.

## Submission checklist (M5)

- [ ] Playable URL on Digit7s hosting opens over HTTPS, no login, matches the ZIP
- [ ] `Digit7Jam_TeamName_GameTitle.zip`: runtime files only, ≤ 200 MB, unzips and runs from a subfolder
- [ ] Private GitHub repo: reviewer access granted, lockfile, build instructions, **tag `submission-v1.0.0`**
- [ ] `README_TeamName_GameTitle.md` with all 17 required items (template in `04_COMPLIANCE.md`)
- [ ] ≥ 3 screenshots `TeamName_GameTitle_Screenshot01.png` (start, gameplay, results, echo feature)
- [ ] 1–3 min demo video `Digit7Jam_TeamName_GameTitle_Demo.mp4` with captions: title → controls →
      echo mechanic → score → end screen
- [ ] Asset credit list; AI use declaration; originality declaration; technical notes; team profile
- [ ] Portal fields: genre, play duration (~15–25 min campaign), orientation (landscape), viewport
      (640×360+), devices, browsers, external network **None**, known bugs
- [ ] Version identifier consistent across the in-game footer, README, tag, ZIP and portal
- [ ] Final Submit done; confirmation reference saved (screenshot + email)
