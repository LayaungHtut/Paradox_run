# 00 — Confirmed rules & rule risks

Pre-production document, written 23 September 2026 from the four official PDFs in `Rules/`
(Participation Rules, Submission Format & Technical Guide, Judging Overview, Campaign Brief).
Where the English and Myanmar versions differ, the stricter reading is used.

## 1. Confirmed constraints

### Timeline

| Item               | Rule                                                               |
| ------------------ | ------------------------------------------------------------------ |
| Kickoff            | 1 Oct 2026 (portal opens; exact time TBA)                          |
| Development period | 1–31 Oct 2026                                                      |
| Deadline           | **31 Oct 2026 23:59:59 Myanmar time (UTC+06:30)**; late = rejected |
| Final Submit       | Only counts after portal "Final Submit" generates a reference      |
| Resubmission       | Allowed before the deadline; latest complete submission counts     |

### Originality (highest-risk area)

- Game must be **newly developed during the competition period** (Rules §6, Guide §1, §10).
- Myanmar text of Rules §6 also forbids **"games created before the competition"** explicitly, and
  §13 lists **"submitting a pre-existing game"** as a disqualification reason.
- Private GitHub repo must show **meaningful commit history from the competition period**; the
  originality declaration states that "the submitted repository and development history accurately
  represent work completed during the competition period" (Guide §7.11, §10.8).
- Organizer may run **code similarity checks**, art-style review and reverse image search (Rules §14).
- Not allowed: games copied from other games, clones, IP infringement.

### AI

- AI code, art, music, voice: **permitted** if legally usable **and disclosed**.
- **AI Use Declaration is mandatory** (even "No AI used"): tool, purpose, affected code/assets, human
  review/modification.
- Team must be able to **understand, explain, test and maintain** all AI-assisted code; material
  undisclosed AI use or unexplainable code "may be escalated for review".
- Do not upload confidential/personal/proprietary information to AI services.

### Technical

| Area        | Requirement                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------- |
| Format      | Browser-playable HTML5/WebGL, no install                                                          |
| Hosting     | Deploy to the **Digit7s-provided hosting environment**; HTTPS; no login; must match the ZIP       |
| ZIP         | ≤ 200 MB; **runtime files only** (index.html, assets…); no source/docs/screens inside             |
| Browsers    | Current Chrome, Edge, Firefox, Safari; must pass ≥1 desktop + ≥1 mobile browser                   |
| Devices     | Windows 10/11, recent macOS, Android 10+, iOS 16+; mobile **touch required**, desktop KB/mouse    |
| Viewport    | Usable at **360×640 mobile** and **1280×720 desktop**, or closest layout declared in README       |
| Orientation | Portrait or landscape accepted; must be declared; controls/text/dialogs usable in it              |
| Readability | No browser zoom needed; nothing clipped/overlapped; no horizontal scrolling                       |
| Loading     | Target ≤ 10 s; loading indicator if longer; interactive without unexplained delay                 |
| Stability   | No repeated crash/freeze; no persistent serious lag on declared devices                           |
| Offline     | Not required; localStorage / IndexedDB allowed                                                    |
| Network     | **Every external request must be declared**; no trackers, analytics, ads, data collection         |
| Online      | **No leaderboard / auth / remote score API required**; optional services must not block the game  |
| Endpoints   | Must not depend on unannounced Digit7s endpoints                                                  |
| Repo        | Private GitHub, reviewer access, lockfile, build instructions, **exact commit/tag** of submission |
| Secrets     | None committed                                                                                    |

### Required submission items (Guide §2, §3)

Game title · team name · main contact · description · playable URL (Digit7s hosting) · playable
ZIP · private repo link · README (17 listed items) · ≥3 screenshots (PNG/JPG) · 1–3 min demo video ·
asset credit list · license proof (if third-party) · originality declaration · team profile ·
technical notes · AI use declaration · portal fields (genre, play duration, mechanics, retention
feature, known bugs, orientation, target devices, resolution, external network use, AI tools).

Naming: `Digit7Jam_TeamName_GameTitle.zip`, `..._Demo.mp4`, `README_TeamName_GameTitle.md`,
`TeamName_GameTitle_Screenshot01.png`.

### Judging (Rules §16, Judging Overview)

Retention potential · gameplay & fun · technical performance · art & polish · originality · product
fit · overall execution. Special awards: creative concept, community recognition, replay value,
player experience. No weights are published.

### Eligibility (user must confirm)

Myanmar citizens, 16+, team of 1–4, registered by 30 Sep, one main contact, no cross-team help.

---

## 2. Rule risks for PARADOX RUN

Ordered by severity.

### R1 — CRITICAL: a playable prototype already exists (built 23 Sep 2026)

Before the rules arrived, a full playable prototype was built in this folder
(`src/`, `docs/`, tests, 8 levels, leaderboard server). It is **pre-existing work**. Submitting it,
or code derived from it, conflicts with Rules §6, §13 and the originality declaration (§10.1, §10.8).
Code-similarity checks would likely connect them, because the same AI assistant writing the same
design will produce similar code.

**Recommended handling (your decision):**

1. **Freeze and quarantine it.** Move the prototype out of the future competition repo (for example
   to `D:\YOUTHsOrg\_archive\paradox_run_prototype_2026-09-23\`). Do not copy files, snippets, level
   maps or test scripts from it after 1 Oct. I have **not** moved or deleted anything. Tell me if
   you want me to archive it.
2. **Start the competition repo empty on 1 Oct** (new private GitHub repo, new scaffold), and
   re-implement from the design documents only.
3. **Keep design at the concept level.** This pre-production pack describes mechanics, level
   _beats_ and architecture, deliberately without code or exact tile maps. Levels get redesigned in
   October.
4. **Disclose and ask.** Send the organizer the question in §3 before 1 Oct. Mention the
   pre-production design documents (and, if you choose, the discarded prototype) in the originality
   declaration. Transparent disclosure is much safer than a similarity finding later.

### R2 — HIGH: the core mechanic has well-known prior art

"Loop, record, cooperate with your past self" is the central mechanic of **Chronotron** (2008), which
even calls breaking your past a "paradox", and of **The Company of Myself** (2009). Mechanics are not
copyrightable, but the rules forbid "games copied from other games", and judges score originality.

Mitigation: make the differentiators prominent and design them in from day 1.

- **Arcade framing:** a short loop timer, score chase, stars, a daily challenge, and fast
  mobile-first sessions. Chronotron is a slow, untimed puzzle game.
- **Echoes as decoys:** enemies target the _nearest_ body, so your past self takes bullets for you.
- **Time-limited switches** that demand arrival _synchrony_ with your echo.
- **Visible timeline UI:** each echo's expiry is marked on the loop bar, with dashed links from echo to
  mechanism and "paradox" desync feedback.
- **Race another run** (local best ghost, and optional shareable ghost codes).
- **Do not copy** any specific Chronotron or Company of Myself levels, art, UI or text.

### R3 — MEDIUM: the title

A js13kGames 2015 entry is called **"Anti-Paradox Run"**, and many small itch.io games use
"Paradox". This is not a trademark blocker, but it weakens distinctiveness and search. Options:
keep "PARADOX RUN", or pick a more ownable title (for example _ECHO LOOP_, _LOOPBACK_, _Twice
Removed_; each needs a quick search before choosing). **This is your decision; recommend deciding
before 1 Oct.**

### R4 — MEDIUM: the earlier plan conflicts with the hosting model

The prototype used a Node server (`adapter-node`) for a verified leaderboard. The guide requires
deploying to **Digit7s hosting** and a ZIP of runtime files, so assume **static hosting only**.
Online leaderboards are also explicitly not required. **Drop the server entirely**: a pure static
build with no network requests, so "External network use: None".

### R5 — MEDIUM: viewport and orientation screening

The game is landscape-first. Screening names a 360×640 mobile viewport. Declaring landscape
(640×360) is allowed, but a judge holding a phone upright must not hit a dead end. MVP: clean
rotate prompt, with menus usable in portrait. Stretch: portrait play mode.

### R6 — MEDIUM: explainability of AI-assisted code

The team must be able to explain every line. Mitigation: human review of each merged change, short
code walkthrough notes per module (see `04_COMPLIANCE.md`), and an AI use log kept daily.

### R7 — LOW: "arcade" fit

A puzzle-platformer could read as "not arcade". Mitigation: loop timer, score, stars, quick retry,
daily run, and a results screen with a clear primary metric.

### R8 — LOW: content policy

Turrets shooting an abstract robot is mild, non-graphic "violence" with no blood or real people.
It is fine, but keep the tone abstract.

### R9 — LOW: date and time zone

Deadline is Myanmar time. Plan the final submit for **30 Oct**, a day early. The daily challenge
uses UTC dates; say so in the README.

## 3. Draft question for the organizers (send via official Telegram / email before 1 Oct)

> Hello Digit7 Jam team. Before kickoff we wrote a game design document and made a throwaway
> technical prototype to test the concept. Our plan is to start a brand-new private repository on
> 1 October, rewrite all code from scratch during the development period, and not reuse any
> pre-existing code or assets. We will disclose the design document in our originality declaration.
> Is pre-production design (concept documents and planning) acceptable, and is there anything
> further we should disclose about the discarded prototype?

Also ask: (a) the hosting type for the Digit7s environment (static files only? subpath or root?);
(b) whether a URL fragment (`#…`) share code counts as an "external network request" (it does not
make one).
