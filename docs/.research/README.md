# Competitive Research: PDLC Studio vs claudecodeui

A self-contained research pack comparing **PDLC Studio** with **siteboon/claudecodeui**, and a
prioritized PRD backlog derived from the comparison.

**Date**: 2026-07-26 · **PDLC Studio version scanned**: 0.2.4 (`3997c20`) ·
**claudecodeui version scanned**: `@cloudcli-ai/cloudcli` 1.36.3

---

## Start here

| If you want… | Read |
| --- | --- |
| The one-paragraph conclusion | §"Headline findings" below |
| What the competitor actually is | [`01-claudecodeui-deep-scan.md`](./01-claudecodeui-deep-scan.md) |
| What we actually have | [`02-pdlc-studio-baseline.md`](./02-pdlc-studio-baseline.md) |
| Feature-by-feature comparison | [`03-feature-comparison-matrix.md`](./03-feature-comparison-matrix.md) |
| What it's *like to use* | [`04-uiux-workflow-comparison.md`](./04-uiux-workflow-comparison.md) |
| The taxonomy and maturity model | [`05-feature-categories-and-maturity.md`](./05-feature-categories-and-maturity.md) |
| The roadmap and why it's ordered that way | [`06-prioritization-and-roadmap.md`](./06-prioritization-and-roadmap.md) |
| A specific feature's spec | [`prds/`](./prds/) — see the index below |

---

## Headline findings

**1. The comparison is no longer apples-to-apples.** The repository is still called
`claudecodeui`, but the shipped package is `@cloudcli-ai/cloudcli` and the README sells
**CloudCLI Cloud at €7/month**. It has become a commercial, multi-provider agent workbench —
12.9k stars, 24 feature modules, an Electron build, a plugin marketplace, and a hosted tier.
PDLC Studio is a ~6,250-line single-purpose local chat front end. **Parity is the wrong goal.**

**2. It is AGPL-3.0-or-later; we are MIT.** No code may be copied in either direction. Every
PRD is a clean-room specification that cites the competitor only as evidence a capability is
worth having.

**3. We win on craft; they win on coverage.** Across 15 categories, PDLC Studio leads in
exactly two — **design system & accessibility** and **engineering quality** — and both leads
are substantial. claudecodeui has **zero automated tests**; PDLC Studio has 14 test files
across two runtimes, a `make check` gate enforced by pre-commit and CI, and 598 lines of
architectural documentation recording rationale *and reversals*.

**4. The distribution is bimodal.** Of 133 features compared, PDLC Studio scores **0 on 70 of
them (53%)** — but almost everything it does ship scores 4–5. That is the profile of a project
that built one workflow properly and has not yet broadened. **The fix is addition, not repair:
nothing in the top 30 is a rewrite.**

**5. One item is urgent and nearly free.** PDLC Studio defaults to `bypassPermissions` with no
authentication, and its own README documents `--host 0.0.0.0` as a supported configuration.
**P01 scores 50.0 — double the next item — and is effort 1.**

| Metric | PDLC Studio | claudecodeui |
| --- | --- | --- |
| Mean maturity (0–5) | **2.4** | **4.1** |
| Categories led | 2 | 13 |
| Automated tests | 14 files, 2 runtimes | **none** |
| Distribution | 38 MB self-contained binary | Node / Electron / Docker |
| License | MIT | AGPL-3.0-or-later |

Projected mean after all 30 PRDs: **3.6** — deliberately not 4.1. See
[`05`](./05-feature-categories-and-maturity.md) §4 for why chasing parity would produce an
incoherent product.

---

## Methodology

**PDLC Studio** was read directly from source; every claim in
[`02`](./02-pdlc-studio-baseline.md) carries a file-path citation, and absence claims were
verified with actual greps rather than asserted.

**claudecodeui** was scanned via its README, `package.json`, `server/index.js`, and file tree.
It was **not** exhaustively read — 33 of 133 matrix rows carry an `UNVERIFIED` marker on at
least one side, and those are labelled rather than glossed. **No PRD's priority depends on an
unverified competitor claim**; each was scored on value to PDLC Studio's own users.

**Astryx** component capabilities were resolved against the live design system rather than
assumed. This corrected two PRDs after they were first drafted — see
[`prds/P03`](./prds/P03-copy-message-code-block-to-clipboard.md) §1.1 and
[`prds/P07`](./prds/P07-file-tree-read-only-file-viewer.md) §7.6.

### Maturity scale

Applied per feature **per product**, so the gap is a subtraction:

| 0 | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| Absent | Stub | Prototype | Functional | Robust | Mature |

Three scoring rules held throughout: score the **shipped default**, not the best reachable
configuration; **tests are required for 4**; **discoverability is required for 5**.

### Prioritization model

```
Score = (Value × Reach × GapWeight) ÷ Effort
```

Effort is calibrated against *this* architecture — no database, `deno compile` single binary,
Deno/Node runtime abstraction, Astryx-only UI, NDJSON transport. Full inputs are published in
[`06`](./06-prioritization-and-roadmap.md) §2 so the ordering is reproducible and arguable.

---

## The PRDs

30 PRDs covering 41 of the 133 compared features. Priority order is encoded in the filename.

| # | PRD | Features | Effort | Score |
| --- | --- | --- | --- | --- |
| [P01](./prds/P01-safe-permission-defaults-mode-persistence.md) | Safe permission defaults & mode persistence | SEC-03, SEC-11 | 1 | **50.0** |
| [P02](./prds/P02-rate-limit-throttle-surfacing.md) | Rate-limit & throttle surfacing | COST-05 | 1 | 24.0 |
| [P03](./prds/P03-copy-message-code-block-to-clipboard.md) | Copy message & code block to clipboard | CHAT-10 | 1 | 22.5 |
| [P04](./prds/P04-token-usage-cost-visibility.md) | Token usage & cost visibility | COST-02/03, SESS-05 | 2 | 20.0 |
| [P05](./prds/P05-pwa-installability.md) | PWA installability | MOB-02 | 1 | 18.0 |
| [P06](./prds/P06-recent-projects-cold-start-fix.md) | Recent Projects cold-start fix | PROJ-05 | 1 | 18.0 |
| [P07](./prds/P07-file-tree-read-only-file-viewer.md) | File tree & read-only file viewer | FILE-01/02 | 3 | 16.7 |
| [P08](./prds/P08-cross-session-conversation-search.md) | Cross-session conversation search | SESS-03 | 2 | 16.0 |
| [P09](./prds/P09-model-selector.md) | Model selector | COST-01 | 2 | 16.0 |
| [P10](./prds/P10-first-run-onboarding.md) | First-run onboarding | PROJ-08 | 2 | 15.0 |
| [P11](./prds/P11-error-boundaries.md) | Error boundaries | UX-07 | 1 | 13.5 |
| [P12](./prds/P12-keyboard-shortcut-expansion.md) | Keyboard shortcut expansion | UX-04 | 1 | 13.5 |
| [P13](./prds/P13-pinch-zoom-wcag-fix.md) | Pinch-zoom / WCAG 1.4.4 fix | MOB-06 | 1 | 13.5 |
| [P14](./prds/P14-authentication.md) | Authentication | SEC-01/02 | 3 | 13.3 |
| [P15](./prds/P15-git-status-panel-commit.md) | Git status panel & commit | GIT-03/05 | 3 | 13.3 |
| [P16](./prds/P16-diff-viewer.md) | Diff viewer | FILE-04, GIT-07 | 3 | 13.3 |
| [P17](./prds/P17-command-palette.md) | Command palette | EXT-02 | 2 | 12.0 |
| [P18](./prds/P18-docker-image.md) | Docker image | PLAT-03 | 1 | 12.0 |
| [P19](./prds/P19-jump-to-file-from-transcript.md) | Jump to file from transcript | FILE-11 | 2 | 12.0 |
| [P20](./prds/P20-slash-command-discovery.md) | Slash-command discovery | EXT-01 | 2 | 12.0 |
| [P21](./prds/P21-attachments-paste-drag-drop-picker.md) | Attachments: paste, drag-drop, picker | IN-01/02/03 | 3 | 10.7 |
| [P22](./prds/P22-at-mention-file-references.md) | `@`-mention file references | EXT-04 | 2 | 9.0 |
| [P23](./prds/P23-context-window-pressure-indicator.md) | Context-window pressure indicator | COST-07 | 2 | 9.0 |
| [P24](./prds/P24-tool-allowlist-ui.md) | Tool allowlist UI | TOOL-04 | 2 | 9.0 |
| [P25](./prds/P25-full-text-code-search.md) | Full-text code search | FILE-05 | 3 | 8.0 |
| [P26](./prds/P26-session-rename-star-delete-export.md) | Session rename, star, delete & export | SESS-09/10 | 2 | 6.8 |
| [P27](./prds/P27-tool-execution-audit-log.md) | Tool execution audit log | TOOL-07 | 2 | 6.8 |
| [P28](./prds/P28-docs-release-hygiene.md) | Docs & release hygiene | ENG-09, PLAT-08 | 1 | 6.0 |
| [P29](./prds/P29-mobile-layout-navigation.md) | Mobile layout & navigation | MOB-01 | 3 | 4.5 |
| [P30](./prds/P30-i18n-scaffolding.md) | i18n scaffolding | UX-06 | 4 | 3.0 |

Each PRD follows a consistent 18-section structure: context, competitive baseline,
goals/non-goals, personas, functional requirements (RFC-2119), UX spec, technical design
grounded in this repo, data model, security, performance, telemetry, test plan wired to
`make test`, rollout, risks, acceptance criteria, open questions, effort breakdown, references.

---

## What was deliberately rejected

**19 features**, with reasons — see [`06`](./06-prioritization-and-roadmap.md) §4. The
rejections matter as much as the selections; they are what keeps the roadmap coherent.

| Rejected | Because |
| --- | --- |
| Embedded terminal (xterm + node-pty) | `node-pty` is a **native module** — breaks `deno compile`; also needs a socket transport we don't have |
| Plugin system | A permanent backwards-compatibility surface, wrong for a ~6k-line project |
| Multi-provider support | Directly contradicts being a *Claude Code* front end — this is the change that turned claudecodeui into CloudCLI |
| Electron desktop app | Strictly worse than the existing 38 MB self-contained binary |
| SQLite session index | Contradicts single-binary distribution; P08 delivers search without one |
| Push notifications, voice input | Require external services a localhost-first tool shouldn't depend on |
| GitHub API integration, in-app PRD editor, TaskMaster, browser-use | Out of scope for a local CLI front end |

Plus **31 features ranked but deferred**, listed in [`06`](./06-prioritization-and-roadmap.md)
§7 so nothing found in the scan is silently dropped.

---

## Cross-cutting notes for implementers

Discovered while writing the PRDs; each affects several of them.

- **Settings-version migration spans six PRDs** — P01, P09, P10, P17, P24, P30 all add
  `AppSettings` fields. They must extend **one** shared migration, not six parallel ones.
- **`~/.claude/pdlc-studio-*.json` sidecars span four PRDs** — P06, P14, P26, P27. One shared,
  tested read/write helper, with consistent failure semantics. Note P14 and P26 must not
  collide on a filename.
- **Route ordering** — `CLAUDE.md` requires literal `/api/projects/*` segments before the
  parameterised route. P06, P08, P15, P20, P22, P26 all add routes subject to this.
- **Header crowding** — P04, P09, P23 each add header content and each flags the problem;
  **P29 owns the shared degradation strategy**.
- **Completion surface** — P20 (slash commands) and P22 (`@`-mentions) must share one
  mechanism, or their `Enter` handling will conflict.
- **Model metadata** — P04 (pricing), P09 (model list), P23 (context windows) are three tables
  keyed the same way. They should be one module.

---

## Two defects found during research

Not features — actual bugs, specified for fixing in the PRDs that surfaced them:

1. **`user-scalable=no`** in `frontend/index.html:15` disables pinch-zoom, failing
   [WCAG 2.1 SC 1.4.4](https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html). One-line
   fix — [P13](./prds/P13-pinch-zoom-wcag-fix.md).
2. **Unconditional slash-stripping** in `backend/handlers/chat.ts:39-44` removes the leading
   `/` from *any* message starting with one, so `/usr/local/bin is on my PATH` silently loses
   its first character before reaching Claude —
   [P20](./prds/P20-slash-command-discovery.md) §7.4, which notes the fix could ship
   independently of the discovery UI.

---

## Verification

Checked mechanically, not by hand:

- `P01`–`P30` present exactly once; every filename's number matches its declared priority.
- All 30 ranked rows in [`06`](./06-prioritization-and-roadmap.md) have a corresponding PRD.
- Every matrix feature ID cited in a PRD resolves to one of the 133 rows in
  [`03`](./03-feature-comparison-matrix.md).
- Of 237 repo-relative paths cited across the pack, every path cited in documents 01–06
  resolves; the 161 that don't exist are all *proposed new files* in PRDs, and none is a
  misspelling of an existing file.
- No source file outside `docs/` was modified.

**Not verified**: `make check` could not be run in the authoring environment (no
`node_modules`, no Deno). Markdown under `docs/` is outside the format gate anyway — which is
itself [P28](./prds/P28-docs-release-hygiene.md).
