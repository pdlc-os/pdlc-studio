# Feature Categories & Maturity Model

> Defines the taxonomy and the scale used throughout this research pack, then applies both
> to PDLC Studio and claudecodeui. `03-feature-comparison-matrix.md` is the per-feature
> data; this document is the framework and the category-level rollup.

---

## 1. The maturity scale

A single 0–5 scale, applied **per feature per product**, so the gap is a subtraction rather
than a judgement call.

| Level | Name | Definition | Test for the level |
| --- | --- | --- | --- |
| **0** | **Absent** | No implementation and no code path toward one. | A grep for the obvious terms returns nothing. |
| **1** | **Stub** | A type, route, flag, or constant exists, but no working user-facing behaviour. | The capability is reachable from code but not from the UI. |
| **2** | **Prototype** | Works on the happy path. No error handling, no tests, rough edges known and unaddressed. | It demos well and breaks under a wrong input. |
| **3** | **Functional** | Complete happy path plus error states. Usable daily by someone who knows the product. | A real user can rely on it; a new user might be confused. |
| **4** | **Robust** | Edge cases handled, covered by tests, documented, keyboard-reachable and accessible. | Breaking it requires trying. Regressions get caught. |
| **5** | **Mature** | Robust, plus polished UX, configurable where it should be, and hardened against misuse. | It is a reason to choose the product. |

### Why this scale rather than a binary

Two of the most important findings in this pack are invisible to a has-it/doesn't-have-it
comparison:

- **`allowedTools` scores 1, not 0.** The wire field exists (`shared/types.ts:11`), the
  backend forwards it (`backend/handlers/chat.ts:67`), and `frontend/src/utils/toolUtils.ts`
  contains 139 lines of command parsing with 171 lines of tests behind it. Everything is
  built except a UI that writes it. A binary scale would call this "missing" and mis-size
  the work by an order of magnitude.
- **Permission modes score 4 on mechanism and 1 on default.** The panels, the four modes,
  the runtime validation, and the tests are all genuinely good. The *default* is the
  hazard. A binary scale cannot express "well-built and wrongly configured," which is
  precisely the P01 finding.

### Scoring rules applied consistently

1. **Score the shipped default, not the best reachable configuration.** A safe mode that
   exists but is off by default does not earn the safe mode's score.
2. **Tests are required for 4.** No test coverage caps a feature at 3, however polished.
   This is what holds claudecodeui's overall mean down despite its breadth.
3. **Discoverability is required for 5.** A capability users cannot find is not mature.
4. **UNVERIFIED is not a score.** Where the scan could not confirm behaviour, the matrix
   says so and the ranking does not depend on it.

---

## 2. The category taxonomy

Fifteen categories. The design goals were: every feature lands in exactly one; each maps to
a plausible owner; and the boundaries fall where architectural constraints fall.

| # | Category | Scope | Why it is its own category |
| --- | --- | --- | --- |
| 1 | **Access, Identity & Security** | Auth, multi-user, network exposure, permission defaults, injection safety | The only category where a low score is a *hazard* rather than a gap |
| 2 | **Chat & Streaming Experience** | Transport, rendering, abort, message types | The product's core loop |
| 3 | **Tool Execution, Permissions & Safety** | Approval flow, modes, allowlists, audit | Split from #1 because it is Claude-specific, not web-app-generic |
| 4 | **Session & Conversation Management** | History, search, fork, checkpoint, export | Bounded by the no-database constraint |
| 5 | **Project & Workspace Management** | Discovery, create, clone, onboarding | PDLC Studio's most polished surface |
| 6 | **Code & File Interaction** | Tree, viewer, editor, diff, search | Largest single gap (0 vs 5) |
| 7 | **Version Control** | Status, stage, commit, branch, diff | Separated from #6: different data model, different risk |
| 8 | **Terminal & Shell Access** | Embedded pty | Its own category because it alone requires a **native module** |
| 9 | **Agent Configuration & Extensibility** | MCP, slash commands, subagents, hooks, plugins | Where scope discipline matters most |
| 10 | **Model, Cost & Usage Observability** | Model choice, tokens, cost, rate limits, context | Grouped as "what the system tells you about itself" |
| 11 | **Multimodal & Rich Input** | Images, attachments, drag-drop, voice | Gated by the wire contract, which is a bare `string` |
| 12 | **Mobile, Responsive & PWA** | Layout, install, offline, touch | Dependent on #1 for safe remote use |
| 13 | **Design System, Theming & Accessibility** | Tokens, dark mode, keyboard, ARIA, i18n | PDLC Studio's strongest lead |
| 14 | **Platform, Distribution & Deployment** | Packaging, binaries, Docker, updates | Constrained by `deno compile` |
| 15 | **Engineering Quality** | Tests, CI, lint, release, docs | PDLC Studio's other lead; claudecodeui's weakest |

### On the boundaries

Three splits are deliberate and worth defending:

- **#6 vs #7.** A file viewer reads one path; a git panel reads repository state and offers
  *write* operations with different failure modes. Merging them would hide that a diff
  viewer (safe, read-only) and `git push` (credential-handling, rejected) are not the same
  kind of work.
- **#8 alone.** Every other category can be built within PDLC Studio's existing
  architecture. A terminal cannot: `node-pty` is a native module that breaks
  `deno compile`, and streaming a pty needs bidirectional transport that NDJSON does not
  provide. Isolating it makes the rejection legible.
- **#1 vs #3.** Authentication is a web-application concern; permission modes are a Claude
  Code concern. They have different owners, different threat models, and — as it turns out
  — very different effort profiles (P14 vs P01).

---

## 3. Category-level rollup

Means of the per-feature scores in `03-feature-comparison-matrix.md`, rounded.

| # | Category | claudecodeui | PDLC Studio | Δ | Character of the gap |
| --- | --- | --- | --- | --- | --- |
| 1 | Access, Identity & Security | 4 | **1** | +3 | Hazard |
| 2 | Chat & Streaming Experience | 4 | 4 | 0 | Level |
| 3 | Tool Execution & Permissions | 4 | 4 mech / **1 default** | +0 / +3 | Misconfiguration |
| 4 | Session & Conversation Mgmt | 4 | 3 | +1 | Scaling limit |
| 5 | Project & Workspace Mgmt | 4 | 4 | 0 | Level |
| 6 | Code & File Interaction | 5 | **0** | **+5** | Total absence |
| 7 | Version Control | 4 | **1** | +3 | Total absence |
| 8 | Terminal & Shell Access | 5 | **0** | **+5** | Architecturally blocked |
| 9 | Agent Config & Extensibility | 5 | **1** | +4 | Scope choice |
| 10 | Model, Cost & Usage | 4 | **1** | +3 | Opacity |
| 11 | Multimodal & Rich Input | 4 | **0** | +4 | Contract-blocked |
| 12 | Mobile, Responsive & PWA | 4 | 2 | +2 | Blocked on #1 |
| 13 | Design System & A11y | 3 | **5** | **−2** | **We lead** |
| 14 | Platform & Distribution | 5 | 4 | +1 | Near-level |
| 15 | Engineering Quality | 3 | **5** | **−2** | **We lead** |

**Means: claudecodeui 4.1 · PDLC Studio 2.4.**

### Reading the distribution

PDLC Studio's scores are **strongly bimodal**:

```
0–1 ████████ 6 categories   (6, 7, 8, 9, 10, 11 — plus 1)
2–3 ███      3 categories   (4, 12, and #3's default)
4–5 ██████   6 categories   (2, 3-mech, 5, 13, 14, 15)
```

There is almost nothing at level 2–3. This is the signature of a project that **built one
workflow properly and has not yet broadened** — not one that built many things carelessly.
That distinction matters for the roadmap: the fix is addition, not repair. Nothing in the
top 30 is a rewrite.

claudecodeui's distribution is the mirror image — broad coverage at 4, held back from 5 by
the complete absence of tests.

### The two negative deltas

Categories 13 and 15 are the only ones where PDLC Studio leads, and both leads are
substantial (−2) and structural rather than incidental:

- **#13** comes from committing to a design system with enforced tokens and a testing rule
  that forbids asserting on class names — which makes accessible markup necessary rather
  than optional. claudecodeui's Tailwind + CVA is competent but ungoverned, and ships with
  no a11y tooling at all.
- **#15** comes from 14 test files across two runtimes, a `make check` gate enforced by both
  a pre-commit hook and CI, a 787-line mock generator enabling a zero-dependency demo mode,
  and 598 lines of architectural documentation that records *reversals*. claudecodeui has
  **zero automated tests** — no test framework in its 35 devDependencies, no `test` script
  among its 24.

These leads impose constraints. Every PRD in `prds/` inherits them: new UI composes Astryx
rather than introducing styling primitives, and every PRD carries a test plan wired to
`make test`. A roadmap that closed the coverage gap by abandoning either lead would be a
net loss, which is why category 8 is rejected outright and category 9 is taken only in its
cheapest, most contained forms (slash-command discovery, `@`-mentions, command palette).

---

## 4. Where PDLC Studio's own scores would move

Useful as a target picture. If all 30 PRDs shipped:

| # | Category | Now | After 30 PRDs | Note |
| --- | --- | --- | --- | --- |
| 1 | Access, Identity & Security | 1 | **4** | P01 + P14 |
| 2 | Chat & Streaming | 4 | 4 | Already strong |
| 3 | Tool Execution & Permissions | 1 default | **4** | P01 fixes the default; P22, P27 add UI |
| 4 | Session & Conversation Mgmt | 3 | **4** | P09 search, P26 metadata |
| 5 | Project & Workspace Mgmt | 4 | **5** | P05, P10 |
| 6 | Code & File Interaction | 0 | **3** | P07, P16, P19, P25 — viewer, not editor |
| 7 | Version Control | 1 | **3** | P15, P16 — status/commit/diff, no push |
| 8 | Terminal & Shell Access | 0 | **0** | Rejected. Unchanged by design |
| 9 | Agent Config & Extensibility | 1 | **2** | P17, P18, P23 only |
| 10 | Model, Cost & Usage | 1 | **4** | P02, P04, P08, P24 |
| 11 | Multimodal & Rich Input | 0 | **3** | P21 |
| 12 | Mobile, Responsive & PWA | 2 | **4** | P06, P11, P29 |
| 13 | Design System & A11y | 5 | **5** | P11 fixes a defect; P30 adds i18n |
| 14 | Platform & Distribution | 4 | **4** | P20 Docker, P28 hygiene |
| 15 | Engineering Quality | 5 | **5** | Maintained by every PRD's test plan |

**Projected mean: 2.4 → 3.6.**

Note what this does *not* claim: parity. Categories 8 and 9 stay low **on purpose**, and
category 6 reaches 3 rather than 5 because the roadmap specifies a *viewer*, not an editor
(FILE-03 is deferred pending evidence anyone wants it). The goal is a coherent product at
3.6, not an incoherent one chasing 4.1.
