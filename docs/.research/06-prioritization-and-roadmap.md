# Prioritization & Roadmap

> Produces the ranked `P01`–`P30` list that the PRDs in `prds/` are named after.
> The full scoring input is published so the ordering is reproducible and arguable rather
> than asserted.

---

## 1. The scoring model

```
Score = (Value × Reach × GapWeight) ÷ Effort
```

| Input | Range | Meaning |
| --- | --- | --- |
| **Value** | 1–5 | Impact on a PDLC Studio user's daily work when present |
| **Reach** | 1–5 | Share of users who encounter the need |
| **GapWeight** | ×1.0 / ×1.5 / ×2.0 | ×2.0 where claudecodeui has it and PDLC Studio is at maturity 0–1; ×1.5 where PDLC Studio is materially behind; ×1.0 where level or leading |
| **Effort** | 1–5 | Implementation cost **given PDLC Studio's actual architecture** — not generic difficulty |

### Effort calibration

Effort is scored against *this* codebase, which changes several answers. A file viewer is
cheaper here than in most apps because `DirectoryPickerDialog` and `GET /api/directories`
already solve half of it; a terminal is more expensive than anywhere else because
`node-pty` breaks `deno compile`.

| Effort | Meaning | Rough size |
| --- | --- | --- |
| 1 | Constants, config, or a single small component | < 1 day |
| 2 | One hook + one component, or one endpoint | 1–3 days |
| 3 | New endpoint + new UI surface + tests both sides | 1–2 weeks |
| 4 | Cross-cutting change touching many files | 3–6 weeks |
| 5 | Architectural change (new transport, new dependency class) | 2 months+ |

### Tie-breaks

Applied in order: **(1)** dependency order — a prerequisite outranks its dependent;
**(2)** lower effort first; **(3)** alphabetical. This is why P15 (git status) precedes
P16 (diff viewer) despite identical scores — the diff viewer consumes the status panel's
changed-file list.

### What the model deliberately does *not* encode

- **Strategic value.** i18n (P30) scores 3.0 and lands last, because it has no current user
  demand and costs a cross-cutting sweep. That is the model working correctly, and it is
  also the item most likely to be worth pulling forward on judgement rather than arithmetic.
- **Risk.** Authentication (P14) is the highest-*risk-reduction* item on the list but scores
  mid-table, because a localhost user gains friction rather than capability. See §5.
- **Sequencing.** Score is not schedule. §6 gives the recommended execution order, which is
  not the score order.

---

## 2. The ranked list

| Rank | PRD | Features | V | R | Gap | E | Score |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P01 | Safe permission defaults & mode persistence | SEC-03, SEC-11 | 5 | 5 | ×2.0 | 1 | **50.0** |
| P02 | Rate-limit & throttle surfacing | COST-05 | 4 | 4 | ×1.5 | 1 | **24.0** |
| P03 | Copy message & code block to clipboard | CHAT-10 | 3 | 5 | ×1.5 | 1 | **22.5** |
| P04 | Token usage & cost visibility | COST-02, COST-03, SESS-05 | 4 | 5 | ×2.0 | 2 | **20.0** |
| P05 | PWA installability | MOB-02 | 3 | 3 | ×2.0 | 1 | **18.0** |
| P06 | Recent Projects cold-start fix | PROJ-05 | 3 | 4 | ×1.5 | 1 | **18.0** |
| P07 | File tree & read-only file viewer | FILE-01, FILE-02 | 5 | 5 | ×2.0 | 3 | **16.7** |
| P08 | Cross-session conversation search | SESS-03 | 4 | 4 | ×2.0 | 2 | **16.0** |
| P09 | Model selector | COST-01 | 4 | 4 | ×2.0 | 2 | **16.0** |
| P10 | First-run onboarding | PROJ-08 | 3 | 5 | ×2.0 | 2 | **15.0** |
| P11 | Error boundaries | UX-07 | 3 | 3 | ×1.5 | 1 | **13.5** |
| P12 | Keyboard shortcut expansion | UX-04 | 3 | 3 | ×1.5 | 1 | **13.5** |
| P13 | Pinch-zoom / WCAG 1.4.4 fix | MOB-06 | 3 | 3 | ×1.5 | 1 | **13.5** |
| P14 | Authentication | SEC-01, SEC-02 | 5 | 4 | ×2.0 | 3 | **13.3** |
| P15 | Git status panel & commit | GIT-03, GIT-05 | 5 | 4 | ×2.0 | 3 | **13.3** |
| P16 | Diff viewer | FILE-04, GIT-07 | 5 | 4 | ×2.0 | 3 | **13.3** |
| P17 | Command palette | EXT-02 | 4 | 3 | ×2.0 | 2 | **12.0** |
| P18 | Docker image | PLAT-03 | 3 | 2 | ×2.0 | 1 | **12.0** |
| P19 | Jump to file from transcript | FILE-11 | 4 | 4 | ×1.5 | 2 | **12.0** |
| P20 | Slash-command discovery | EXT-01 | 4 | 4 | ×1.5 | 2 | **12.0** |
| P21 | Attachments: paste, drag-drop, picker | IN-01, IN-02, IN-03 | 4 | 4 | ×2.0 | 3 | **10.7** |
| P22 | `@`-mention file references | EXT-04 | 4 | 3 | ×1.5 | 2 | **9.0** |
| P23 | Context-window pressure indicator | COST-07 | 3 | 4 | ×1.5 | 2 | **9.0** |
| P24 | Tool allowlist UI | TOOL-04 | 4 | 3 | ×1.5 | 2 | **9.0** |
| P25 | Full-text code search | FILE-05 | 4 | 3 | ×2.0 | 3 | **8.0** |
| P26 | Session rename, star, delete & export | SESS-09, SESS-10 | 3 | 3 | ×1.5 | 2 | **6.8** |
| P27 | Tool execution audit log | TOOL-07 | 3 | 3 | ×1.5 | 2 | **6.8** |
| P28 | Docs & release hygiene | ENG-09, PLAT-08 | 2 | 2 | ×1.5 | 1 | **6.0** |
| P29 | Mobile layout & navigation | MOB-01 | 3 | 3 | ×1.5 | 3 | **4.5** |
| P30 | i18n scaffolding | UX-06 | 3 | 2 | ×2.0 | 4 | **3.0** |

**41 matrix features → 30 PRDs.** Seven PRDs bundle features that are inseparable in
implementation; splitting them would produce documents that cross-reference each other on
every requirement.

---

## 3. Dependency graph

Not everything is independent. Edges that constrain execution order:

```
P01 (safe defaults) ──▶ P24 (allowlist UI) ──▶ P27 (audit log)
P07 (file tree/viewer) ──┬─▶ P19 (jump to file)
                         ├─▶ P22 (@-mentions)
                         ├─▶ P25 (code search)
                         └─▶ P16 (diff viewer, shares the file-render component)
P15 (git status) ──▶ P16 (diff viewer, consumes changed-file list)
P17 (command palette) ──┬─▶ P08 (search surfaces here)
                        └─▶ P12 (shortcuts are discoverable here)
P04 (token/cost) ──▶ P23 (context pressure reuses the usage plumbing)
P14 (authentication) ──▶ [any future networked feature]
P30 (i18n) ──▶ [should precede large new UI, or its strings need retrofitting]
```

**Two sequencing notes that matter:**

- **P30 is ranked last but has an ordering claim on everything after it.** Every PRD shipped
  before i18n scaffolding adds hard-coded English strings that must later be extracted. The
  model ranks it 30th on value÷effort; the dependency graph says that if it is *ever* going
  to be done, doing it before P07/P15/P16/P17 is materially cheaper. This is flagged in
  P30's own PRD as its central open question.
- **P05/P13/P29 (mobile) do not depend on P14 (authentication)**, despite
  `04-uiux-workflow-comparison.md` §2 Journey G noting that safe *remote* use does. The
  distinction: installability, pinch-zoom, and layout are all improvements to the
  **localhost** experience and widen no exposure. What must not happen is *promoting*
  remote access before P14 lands — so P05's PRD explicitly forbids adding
  `--host 0.0.0.0` guidance to onboarding or docs until authentication ships.

---

## 4. Deliberately rejected (19 features)

Not deferred — **rejected**, with reasons. Revisiting any of these should require new
information, not just enthusiasm.

| Features | Rejected because |
| --- | --- |
| TERM-01/02/03 — embedded terminal | `node-pty` is a **native module** and breaks `deno compile`; streaming a pty needs bidirectional transport NDJSON does not provide. Two architectural pillars sacrificed for one feature. |
| EXT-07 — plugin system | A plugin API is a permanent backwards-compatibility surface. Categorically wrong for a ~6k-line project with one maintainer. |
| COST-04 — multi-provider support | Directly contradicts being a *Claude Code* front end. This is the change that turned claudecodeui into CloudCLI. |
| PLAT-05 — Electron desktop app | Shipping Electron next to an existing 38 MB self-contained binary is a strictly worse trade. |
| SESS-04 — SQLite session index | A database contradicts single-binary distribution. P08 delivers search without one. |
| FILE-06 — manual file CRUD | The agent already does this. A parallel manual path duplicates it and doubles the write surface. |
| FILE-09 — live file-watch refresh | Requires server→client push outside a request. Blocked on the NDJSON→socket decision. |
| FILE-10 — editor minimap | Pure editor chrome; meaningless without FILE-03, which is itself deferred. |
| GIT-09 — push / pull | Credential handling in an app with no authentication is a hazard. Reconsider only after P14. |
| GIT-10 — GitHub API integration | Out of scope for a local CLI front end. |
| EXT-05/06 — subagent & hooks config | Deep Claude Code configuration surfaces; poor fit, high maintenance coupling to SDK internals. |
| EXT-08 — in-app PRD editor | Product scope creep. |
| EXT-09 — TaskMaster AI | Third-party coupling with an independent release cycle. |
| EXT-10 — browser-use | Large surface, narrow audience. |
| IN-04 — voice input | Requires an external transcription service — a network dependency the app otherwise does not have, and one that would send audio off-machine. |
| MOB-04 — push notifications | Needs VAPID keys and a push service; wrong shape for a localhost-first tool. |

**The AGPL constraint applies to all of the above and to the 30 accepted items alike.**
claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be copied in either
direction. Every PRD is a clean-room specification — it cites claudecodeui only as evidence
that a capability is worth having.

---

## 5. If the priority basis changed

The ranking above answers "value ÷ effort, gap-weighted," which is what was asked for. Two
alternative lenses produce materially different top tens, and both are defensible:

**Security-first** — P14 (authentication) moves to **P02**, P24 (allowlist UI) to P03, P27
(audit log) to P04. Everything else shifts down four. Choose this if remote or shared use
is on the near roadmap, because P01 alone does not make the app safe to expose — it only
stops it being unsafe by default on localhost.

**Parity-first** — P07 (file tree), P15 (git status), P16 (diff viewer), P25 (code search),
and P21 (attachments) form the top five, since they are the largest raw capability gaps.
Choose this if the goal is to stop losing users who evaluate both products side by side.
Note this ordering front-loads all the effort-3 work and delivers nothing for several weeks.

The value÷effort ordering has one strong practical advantage worth stating: **P01–P06 are
all effort-1 or effort-2**, so the first six items are shippable in roughly two weeks and
include the single most important safety fix. That early-momentum property is why it is a
good default even for a team that cares most about the parity gaps.

---

## 6. Recommended execution order

Score order is not schedule order. Grouped into milestones that each end somewhere sensible:

**Milestone 1 — Safety & quick wins (≈2 weeks)**
P01, P02, P03, P06, P11, P13, P28
*Ends with: the app is no longer unsafe by default, no longer silently stalls on rate
limits, and no longer white-screens on a parse error.*

**Milestone 2 — Legibility (≈2 weeks)**
P04, P09, P23, P05, P10
*Ends with: users can see cost, choose a model, understand context pressure, install to
home screen, and get oriented on first run.*

**Milestone 3 — Seeing the code (≈4 weeks)**
P07, P19, P15, P16
*The largest and most valuable block. Ends with: users can browse files, jump to a file
from the transcript, see what the agent changed, and commit it — the Journey C gap from
`04-uiux-workflow-comparison.md` closed end to end.*

**Milestone 4 — Finding things (≈3 weeks)**
P17, P08, P25, P22, P20, P12
*Ends with: a command palette that is the single entry point for search, shortcuts, and
slash commands — closing the discoverability gap identified in `04` §3.*

**Milestone 5 — Trust & input (≈3 weeks)**
P14, P24, P27, P21
*Ends with: authentication, a real allowlist UI, an audit trail, and image/file
attachments. Only after this is `--host 0.0.0.0` defensible.*

**Milestone 6 — Reach (≈4 weeks)**
P18, P26, P29, P30
*Ends with: Docker, session management polish, a real mobile layout, and i18n.*

**Total: ≈18 weeks.** See §3's note on P30 before committing to this order — moving i18n
scaffolding to the start of Milestone 3 costs about a week then and saves considerably more
later.

---

## 7. Deferred tail (31 features, ranked but below the line)

Listed so nothing found in the scan is silently dropped. These are ranked but have no PRD.

| Feature | Why below the line |
| --- | --- |
| FILE-03 — in-browser file editing | Large. Ship P07 (viewer) first and see whether editing is actually wanted. |
| FILE-07 — upload files into a project | Partly covered by P21's attachment path. |
| FILE-08 — binary/image file serving | Natural follow-on to P07; not independently valuable. |
| GIT-04 — stage/unstage hunks | Follow-on to P15. Hunk-level staging is a large UI investment. |
| GIT-06 — branch switch/create | Follow-on to P15; lower frequency than status/commit. |
| GIT-08 — commit history / log | Read-only and pleasant, but the agent rarely needs it. |
| SESS-06 — multiple concurrent sessions | Unclear demand; interacts awkwardly with a single-surface UI. |
| SESS-07 — fork a session from a past turn | High value if Claude Code's SDK supports it cleanly; needs investigation first. |
| SESS-08 — checkpoint / rewind | Same — depends on SDK capability not yet confirmed. |
| SESS-11 — cross-project session view | Follows P08; search is the harder half. |
| PROJ-06 — rename / remove a project | Low frequency. |
| PROJ-07 — per-project settings | Blocked on a persistence decision (§4, SESS-04). |
| PROJ-09 — project favourites / pinning | Nice; not load-bearing. |
| CHAT-04 — GFM tables / task lists | May already work via Astryx `Markdown`; verify before specifying. |
| CHAT-05 — LaTeX / math rendering | Genuinely niche for a coding agent. |
| CHAT-11 — edit and resend a message | Moderate value, moderate effort. |
| CHAT-12 — stop-and-steer mid-generation | Abort exists; steering needs SDK support. |
| TOOL-05 — per-project permission profiles | Blocked on persistence. |
| TERM-04 — read-only command-output view | The 80%-value alternative to a real terminal, without the native dependency. Best candidate in this table for promotion. |
| EXT-03 — MCP server management UI | Real value, real scope. Strong candidate once P24 establishes a settings surface. |
| COST-06 — usage analytics dashboard | Follows P04. |
| SEC-05 — API-key auth for machine clients | Follows P14; no demand signal yet. |
| SEC-10 — rate limiting on auth | Required *with* P14, folded into that PRD's non-goals for a follow-up. |
| MOB-03 — service worker / offline shell | Follows P05. |
| MOB-05 — mobile navigation pattern | Folded into P29's scope discussion. |
| UX-08 — empty / loading / error states | Partially exists via `ChatLayout`. Incremental. |
| PLAT-02 — actually publish to npm | A decision, not an engineering task: flip `ENABLE_NPM_PUBLISH`. |
| PLAT-04 — Windows support | Large, and `deno compile` targets would need adding. |
| PLAT-06 — in-app self-update | Meaningful only with npm/Docker distribution established. |
| ENG-03 — architectural lint boundaries | claudecodeui's `eslint-plugin-boundaries` setup is genuinely worth copying *as a technique*. |
| ENG-05 — conventional commits | Prerequisite for the CHANGELOG half of P28; folded in there as an open question. |

**Best candidates for promotion**, if the top 30 shrinks: TERM-04 (read-only command
output), EXT-03 (MCP management), and SESS-07/08 (fork and checkpoint) once SDK support is
confirmed.
