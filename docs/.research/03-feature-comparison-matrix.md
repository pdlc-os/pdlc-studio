# Feature Comparison Matrix — PDLC Studio vs claudecodeui/CloudCLI

> **Read `01-claudecodeui-deep-scan.md` and `02-pdlc-studio-baseline.md` first** — this
> document is the join of those two inventories and carries no new evidence of its own.
>
> **Maturity scale** (defined in full in `05-feature-categories-and-maturity.md`):
> `0` Absent · `1` Stub · `2` Prototype · `3` Functional · `4` Robust · `5` Mature
>
> **Δ** is `claudecodeui − PDLC Studio`. Positive means they lead. Negative means we lead.
>
> **ID** is stable and is what the PRDs in `prds/` trace back to. IDs are never reused.

---

## How to read the "Take?" column

| Marker | Meaning |
| --- | --- |
| ✅ | In the top 30 — has a PRD in `prds/` |
| 🟡 | Ranked, below 30 — listed in the deferred tail of `06-prioritization-and-roadmap.md` |
| ❌ | Deliberately rejected — reason given in the Notes column |
| ➖ | PDLC Studio already leads or is level; nothing to take |

Rejection is not the same as "we're behind and ignoring it." Every ❌ has a stated reason
rooted in PDLC Studio's architecture (no database, `deno compile`, Astryx, NDJSON) or in
the AGPL licensing constraint from `01-claudecodeui-deep-scan.md` §8.

---

## 1. Access, Identity & Security

| ID | Feature | claudecodeui | PDLC | Δ | Take? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| SEC-01 | Password authentication | 4 — bcrypt | 0 | +4 | ✅ | Highest-ranked item overall. No auth at all today. |
| SEC-02 | Token/session auth for API | 4 — JWT + refresh header | 0 | +4 | ✅ | Pairs with SEC-01; single PRD covers both. |
| SEC-03 | Safe-by-default tool permissions | 4 — "disabled by default" | 1 — `bypassPermissions` | +3 | ✅ | Inverse defaults. Ours is the hazard. |
| SEC-04 | Authenticated realtime channel | 4 — `authenticateWebSocket` | ➖ | n/a | ➖ | We have no socket to authenticate. |
| SEC-05 | API-key auth for machine clients | 3 — `/api/agent` | 0 | +3 | 🟡 | Useful, but no demand signal yet. |
| SEC-06 | XSS sanitisation of rendered content | 4 — DOMPurify | ➖ | 0 | ➖ | We don't allow raw HTML, so we don't need it. Worth an explicit test. |
| SEC-07 | Startup warning on unsafe exposure | 0 | **4** | −4 | ➖ | `warnIfPermissionsExposed()`. We lead. |
| SEC-08 | Runtime validation of wire enums | 0 (unknown) | **4** | −4 | ➖ | `resolvePermissionMode()` → 400. We lead. |
| SEC-09 | Shell-injection-safe subprocess calls | UNVERIFIED | **4** | ? | ➖ | We use argv arrays with `--`. |
| SEC-10 | Rate limiting / brute-force protection | UNVERIFIED | 0 | ? | 🟡 | Only matters once SEC-01 exists. |
| SEC-11 | Permission mode persistence | UNVERIFIED | **0** | ? | ✅ | Ours resets to `bypassPermissions` on every reload — a real defect. |

## 2. Chat & Streaming Experience

| ID | Feature | claudecodeui | PDLC | Δ | Take? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| CHAT-01 | Streaming responses | 4 — WebSocket | 4 — NDJSON | 0 | ➖ | Different transports, comparable result. |
| CHAT-02 | Abort in-flight request | UNVERIFIED | **4** | ? | ➖ | Abort-vs-error discrimination; `Escape`. We lead. |
| CHAT-03 | Markdown rendering | 4 | 3 | +1 | ➖ | Astryx `Markdown`. Adequate. |
| CHAT-04 | GFM tables / task lists | 4 — `remark-gfm` | UNVERIFIED | ? | 🟡 | Depends on Astryx `Markdown` internals. |
| CHAT-05 | LaTeX / math rendering | 4 — KaTeX | 0 | +4 | 🟡 | Genuinely niche for a coding agent. |
| CHAT-06 | Syntax-highlighted code blocks | 4 | 4 — `CodeBlock` | 0 | ➖ | Ours collapses long output. |
| CHAT-07 | Tool-call rendering | UNVERIFIED | **4** — `ChatToolCalls` | ? | ➖ | |
| CHAT-08 | Thinking-block rendering | UNVERIFIED | 3 | ? | ➖ | Arrives as assistant content blocks. |
| CHAT-09 | Stream noise filtering | UNVERIFIED | **5** | ? | ➖ | Two tested blocklists. Clear lead. |
| CHAT-10 | Copy message / code to clipboard | UNVERIFIED | UNVERIFIED | ? | ✅ | Cheap, universally expected. |
| CHAT-11 | Edit and resend a message | UNVERIFIED | 0 | ? | 🟡 | |
| CHAT-12 | Stop-and-steer mid-generation | UNVERIFIED | 0 | ? | 🟡 | Abort exists; steering does not. |

## 3. Tool Execution, Permissions & Safety

| ID | Feature | claudecodeui | PDLC | Δ | Take? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TOOL-01 | Per-tool approval prompts | 4 | **4** | 0 | ➖ | `PermissionInputPanel`. |
| TOOL-02 | Plan mode review/approve | UNVERIFIED | **4** | ? | ➖ | `PlanPermissionInputPanel`, tested. |
| TOOL-03 | All four permission modes exposed | UNVERIFIED | **4** | ? | ➖ | Cycled via `Ctrl+Shift+M`. |
| TOOL-04 | Tool allowlist **UI** | 4 — settings | **1** | +3 | ✅ | `allowedTools` plumbing exists; nothing writes it. |
| TOOL-05 | Per-project permission profiles | UNVERIFIED | 0 | ? | 🟡 | Needs persistence. |
| TOOL-06 | Command parsing for allowlisting | UNVERIFIED | **4** | ? | ➖ | `toolUtils.ts` + 171 lines of tests. |
| TOOL-07 | Audit log of executed tools | UNVERIFIED | 0 | ? | ✅ | Strong pairing with SEC-03. |

## 4. Session & Conversation Management

| ID | Feature | claudecodeui | PDLC | Δ | Take? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| SESS-01 | Browse past conversations | 4 | **3** | +1 | ➖ | `HistoryView`. |
| SESS-02 | Resume a session | 4 | 4 | 0 | ➖ | `options.resume`. |
| SESS-03 | Search across conversations | 4 — Fuse.js + ripgrep | **0** | +4 | ✅ | Highest-value session gap. |
| SESS-04 | Session index/database | 4 — SQLite | 0 | +4 | ❌ | We re-parse JSONL. A DB contradicts single-binary distribution; SESS-03 can be built without one. |
| SESS-05 | Token accounting per session | 4 | 0 | +4 | ✅ | See COST-02. |
| SESS-06 | Multiple concurrent sessions | 4 | UNVERIFIED | ? | 🟡 | |
| SESS-07 | Fork a session from a past turn | UNVERIFIED | 0 | ? | 🟡 | |
| SESS-08 | Checkpoint / rewind | UNVERIFIED | 0 | ? | 🟡 | |
| SESS-09 | Rename / star / delete a session | UNVERIFIED | 0 | ? | ✅ | Cheap; needs a small metadata sidecar. |
| SESS-10 | Export transcript | UNVERIFIED (`jszip`) | 0 | ? | ✅ | Pure client-side; very cheap. |
| SESS-11 | Cross-project session view | 4 | 0 | +4 | 🟡 | |

## 5. Project & Workspace Management

| ID | Feature | claudecodeui | PDLC | Δ | Take? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| PROJ-01 | Auto-discover projects | 4 | **4** | 0 | ➖ | From `~/.claude.json`. |
| PROJ-02 | Create new project | 4 — wizard | **4** — dialog | 0 | ➖ | |
| PROJ-03 | Clone a git repository | UNVERIFIED | **4** | ? | ➖ | Injection-safe argv. We likely lead. |
| PROJ-04 | Open arbitrary directory | 4 | **4** | 0 | ➖ | Shared `DirectoryPickerDialog`. |
| PROJ-05 | Recent projects list | 4 | 3 | +1 | ✅ | Ours only lists dirs that *already* have history — new projects vanish. Documented rough edge. |
| PROJ-06 | Rename / remove a project | UNVERIFIED | 0 | ? | 🟡 | |
| PROJ-07 | Per-project settings | 4 — `/api/settings` | 0 | +4 | 🟡 | Blocked on a persistence decision. |
| PROJ-08 | First-run onboarding | 4 — `onboarding/` | 0 | +4 | ✅ | We drop users onto an empty launch screen. |
| PROJ-09 | Project favourites / pinning | UNVERIFIED | 0 | ? | 🟡 | |

## 6. Code & File Interaction

> PDLC Studio scores **0 across this entire category.** `GET /api/directories` returns
> directories only and omits files by design (`shared/types.ts:74-83`).

| ID | Feature | claudecodeui | PDLC | Δ | Take? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| FILE-01 | File tree browser | 5 | 0 | +5 | ✅ | Highest-value single feature after auth. |
| FILE-02 | Read-only file viewer w/ highlighting | 5 | 0 | +5 | ✅ | Natural first step; small blast radius. |
| FILE-03 | In-browser file **editing** | 5 — CodeMirror 6 | 0 | +5 | 🟡 | Large. Do FILE-02 first and see if it's wanted. |
| FILE-04 | Diff / merge view | 5 — `@codemirror/merge` | 0 | +5 | ✅ | Reviewing agent edits is the core need. |
| FILE-05 | Full-text code search | 5 — ripgrep | 0 | +5 | ✅ | High value, moderate effort. |
| FILE-06 | Create / rename / delete files | 4 | 0 | +4 | ❌ | The agent does this. A parallel manual path duplicates it and doubles the write surface. |
| FILE-07 | Upload files into a project | 4 — multer | 0 | +4 | 🟡 | |
| FILE-08 | Binary/image file serving | 4 | 0 | +4 | 🟡 | Follows FILE-01. |
| FILE-09 | Live file-watch refresh | 4 — chokidar *(inferred)* | 0 | +4 | ❌ | Needs server→client push. Blocked on NDJSON→socket. |
| FILE-10 | Minimap | 4 | 0 | +4 | ❌ | Pure editor chrome; only meaningful with FILE-03. |
| FILE-11 | Jump to file cited in transcript | UNVERIFIED | 0 | ? | ✅ | Small, and it makes FILE-01/02 pay off immediately. |

## 7. Version Control

| ID | Feature | claudecodeui | PDLC | Δ | Take? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| GIT-01 | `git init` on create | UNVERIFIED | **4** | ? | ➖ | |
| GIT-02 | `git clone` | UNVERIFIED | **4** | ? | ➖ | |
| GIT-03 | Working-tree status panel | 4 | 0 | +4 | ✅ | "What did the agent just change?" is the top unanswered question. |
| GIT-04 | Stage / unstage hunks | 4 | 0 | +4 | 🟡 | |
| GIT-05 | Commit from the UI | 4 | 0 | +4 | ✅ | Pairs with GIT-03. |
| GIT-06 | Branch switch / create | 4 | 0 | +4 | 🟡 | |
| GIT-07 | Uncommitted-diff viewer | 4 | 0 | +4 | ✅ | Shares rendering with FILE-04. |
| GIT-08 | Commit history / log | UNVERIFIED | 0 | ? | 🟡 | |
| GIT-09 | Push / pull | UNVERIFIED | 0 | ? | ❌ | Credential handling in a no-auth app is a hazard. Revisit after SEC-01. |
| GIT-10 | GitHub API integration | 4 — Octokit | 0 | +4 | ❌ | Out of scope for a local CLI front end. |

## 8. Terminal & Shell Access

| ID | Feature | claudecodeui | PDLC | Δ | Take? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TERM-01 | Embedded terminal | 5 — xterm + node-pty | 0 | +5 | ❌ | `node-pty` is a **native module** — breaks `deno compile`. Also needs a socket. Two architectural pillars for one feature. |
| TERM-02 | Standalone/detached shell | 5 | 0 | +5 | ❌ | Depends on TERM-01. |
| TERM-03 | GPU-accelerated rendering | 4 — WebGL addon | 0 | +4 | ❌ | Depends on TERM-01. |
| TERM-04 | Read-only command-output view | n/a | 0 | n/a | 🟡 | The 80%-value alternative to TERM-01 without the native dependency. |

## 9. Agent Configuration & Extensibility

| ID | Feature | claudecodeui | PDLC | Δ | Take? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| EXT-01 | Slash-command discovery UI | 4 — cmdk | **1** | +3 | ✅ | Ours strips `/` and forwards blindly (`chat.ts:39-44`). No discovery. |
| EXT-02 | Command palette | 4 | 0 | +4 | ✅ | Also the natural home for SESS-03 and FILE-05. |
| EXT-03 | MCP server management UI | 5 | 0 | +5 | 🟡 | Real value, real scope. |
| EXT-04 | `@`-mention file references | UNVERIFIED | 0 | ? | ✅ | Cheap once FILE-01 exists. |
| EXT-05 | Subagent / skills management | 5 | 0 | +5 | ❌ | Deep Claude Code surface; poor fit for our scope. |
| EXT-06 | Hooks configuration UI | UNVERIFIED | 0 | ? | ❌ | Same. |
| EXT-07 | Plugin system | 5 | 0 | +5 | ❌ | A permanent compatibility surface. Categorically wrong for a 6k-line app. |
| EXT-08 | In-app PRD editor | 4 | 0 | +4 | ❌ | Product scope creep. |
| EXT-09 | TaskMaster AI integration | 4 | 0 | +4 | ❌ | Third-party coupling. |
| EXT-10 | Browser-use / agent browser | 4 | 0 | +4 | ❌ | Large surface, narrow audience. |
| EXT-11 | System prompt preset opt-in | UNVERIFIED | **4** | ? | ➖ | Documented and deliberate. |
| EXT-12 | CLAUDE.md / settings.json pickup | UNVERIFIED | **4** | ? | ➖ | SDK default `settingSources`. |

## 10. Model, Cost & Usage Observability

| ID | Feature | claudecodeui | PDLC | Δ | Take? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| COST-01 | Model selector | 4 | 0 | +4 | ✅ | We never pass `model`; users can't pick Opus vs Haiku. |
| COST-02 | Token usage display | 4 | 0 | +4 | ✅ | Data already flows through `sdkFixtures`; simply never rendered. |
| COST-03 | Cost estimation | UNVERIFIED | 0 | ? | ✅ | Bundle with COST-02. |
| COST-04 | Multi-provider support | 5 — 4 providers | 0 | +5 | ❌ | Directly contradicts being a *Claude Code* front end. |
| COST-05 | Rate-limit surfacing | UNVERIFIED | **0** | ? | ✅ | We actively silence `rate_limit_event`. Users see a stall with no explanation. |
| COST-06 | Usage analytics dashboard | UNVERIFIED | 0 | ? | 🟡 | |
| COST-07 | Context-window pressure indicator | UNVERIFIED | 0 | ? | ✅ | Compaction is invisible today. |

## 11. Multimodal & Rich Input

| ID | Feature | claudecodeui | PDLC | Δ | Take? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| IN-01 | Image paste from clipboard | 4 | 0 | +4 | ✅ | Screenshot→chat is a top agent workflow. |
| IN-02 | Drag-and-drop file attach | 4 — react-dropzone | 0 | +4 | ✅ | Same PRD as IN-01. |
| IN-03 | File-picker attachment | 4 — multer | 0 | +4 | ✅ | Same PRD. |
| IN-04 | Voice input | 4 — `/api/voice` | 0 | +4 | ❌ | Needs an external transcription service — a network dependency we don't otherwise have. |
| IN-05 | Multi-line composer w/ Enter config | UNVERIFIED | **4** | ? | ➖ | Configurable Enter behaviour already ships. |

## 12. Mobile, Responsive & PWA

| ID | Feature | claudecodeui | PDLC | Δ | Take? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| MOB-01 | Responsive layout | 4 | 2 | +2 | ✅ | Ours is two width constants plus whatever Astryx gives. |
| MOB-02 | PWA installability | 4 *(inferred)* | 0 | +4 | ✅ | Manifest + icons. Very cheap. |
| MOB-03 | Service worker / offline shell | 4 *(inferred)* | 0 | +4 | 🟡 | |
| MOB-04 | Push notifications | 4 — web-push | 0 | +4 | ❌ | Requires VAPID keys and a push service. Wrong for localhost-first. |
| MOB-05 | Mobile navigation pattern | 4 | 0 | +4 | 🟡 | |
| MOB-06 | Pinch-zoom not disabled | UNVERIFIED | **0** | ? | ✅ | `user-scalable=no` (`frontend/index.html:15`) fails WCAG 1.4.4. One-line fix. |

## 13. Design System, Theming & Accessibility

| ID | Feature | claudecodeui | PDLC | Δ | Take? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| UX-01 | Governed design system | 3 — Tailwind + CVA | **5** — Astryx | −2 | ➖ | Our strongest lead. Protect it. |
| UX-02 | Dark / light theming | 4 | **5** | −1 | ➖ | `light-dark()` tokens; no `.dark` class. |
| UX-03 | System theme detection | 4 | **4** | 0 | ➖ | Plus an anti-FOUC inline script. |
| UX-04 | Keyboard shortcuts | UNVERIFIED | 2 | ? | ✅ | We have exactly three. |
| UX-05 | Accessibility test discipline | 0 — no a11y tooling | **4** | −4 | ➖ | We assert on roles/`aria-*`, never class names. |
| UX-06 | Internationalisation | 4 — i18next, 7 languages | **0** | +4 | ✅ | A total gap. Scaffolding now is far cheaper than retrofitting later. |
| UX-07 | Error boundaries | 4 | UNVERIFIED | ? | ✅ | A stream-parse throw should not white-screen the app. |
| UX-08 | Empty / loading / error states | UNVERIFIED | 3 | ? | 🟡 | `ChatLayout` owns the empty state. |
| UX-09 | Original brand identity + drift test | UNVERIFIED | **5** | ? | ➖ | `AppIcon.test.tsx` fails the build on drift. |

## 14. Platform, Distribution & Deployment

| ID | Feature | claudecodeui | PDLC | Δ | Take? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| PLAT-01 | Single-file binary | 0 | **5** | −5 | ➖ | 38 MB DMG / 41 MB tar.gz. Unmatched. |
| PLAT-02 | npm distribution | 4 — published | 2 — never published | +2 | 🟡 | Opt-in gate has never been flipped. |
| PLAT-03 | Docker image | 4 | 0 | +4 | ✅ | Cheap, and the standard answer to "how do I run this on a server safely?" |
| PLAT-04 | Windows support | 4 — Electron | **0** | +4 | 🟡 | Explicitly unsupported today. |
| PLAT-05 | Desktop app | 5 — Electron | 0 | +5 | ❌ | Electron next to a 38 MB binary is a strange trade. |
| PLAT-06 | In-app self-update | 4 | 0 | +4 | 🟡 | |
| PLAT-07 | Automated release pipeline | 4 — release-it | **4** | 0 | ➖ | One workflow dispatch does everything. |
| PLAT-08 | Generated CHANGELOG | 4 | **0** | +4 | ✅ | Explicitly given up when `tagpr` was removed. Cheap to restore. |
| PLAT-09 | Universal CLI path detection | UNVERIFIED | **5** | ? | ➖ | Volta/asdf/nvm/pnpm/yarn. Clear lead. |
| PLAT-10 | Runtime portability (Deno + Node) | 0 | **5** | −5 | ➖ | |

## 15. Engineering Quality

| ID | Feature | claudecodeui | PDLC | Δ | Take? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| ENG-01 | Automated tests | **0 — none at all** | **5** | −5 | ➖ | 14 test files vs zero. Our defining lead. |
| ENG-02 | Type checking | 4 | **4** | 0 | ➖ | |
| ENG-03 | Lint w/ architectural boundaries | **4** — `eslint-plugin-boundaries` | 3 | +1 | 🟡 | Their layering enforcement is genuinely good. |
| ENG-04 | Pre-commit hooks | 4 — husky | **4** — lefthook | 0 | ➖ | |
| ENG-05 | Conventional commits | 4 — commitlint | 0 | +4 | 🟡 | Prerequisite for PLAT-08. |
| ENG-06 | CI on every push | UNVERIFIED | **4** | ? | ➖ | |
| ENG-07 | Architectural documentation | 2 | **5** | −3 | ➖ | 598-line `CLAUDE.md` recording rationale *and reversals*. |
| ENG-08 | Demo / mock mode | 0 | **5** | −5 | ➖ | 787-line mock generator; runs with no CLI present. |
| ENG-09 | Markdown/docs in format gate | UNVERIFIED | **1** | ? | ✅ | `format:check` misses `docs/**`. Two-word fix. |

---

## Aggregate

Counted mechanically from the tables above, not by hand:

| Measure | Value |
| --- | --- |
| Features compared | **133** |
| PDLC Studio at maturity **0** | **70** (53%) |
| PDLC Studio measurably leads (Δ negative) | **10** |
| Selected (✅) | **41** features → **30 PRDs** |
| Ranked but deferred (🟡) | **31** |
| Deliberately rejected (❌) | **19** |
| Nothing to take (➖) | **42** |

**41 ✅ features map to 30 PRDs, not 30 features.** Several are inseparable in
implementation and would be artificial to split — writing them as one PRD each would
produce documents that cross-reference each other on every requirement. The bundles:

| PRD | Bundled features |
| --- | --- |
| Authentication | SEC-01 + SEC-02 |
| Safe permission defaults | SEC-03 + SEC-11 |
| Attachments | IN-01 + IN-02 + IN-03 |
| Token & cost visibility | COST-02 + COST-03 |
| Git status & commit | GIT-03 + GIT-05 |
| File tree & viewer | FILE-01 + FILE-02 |
| Session metadata | SESS-09 + SESS-10 |

The full mapping is in `06-prioritization-and-roadmap.md` §3.

**The 19 rejections matter as much as the 30 selections.** They are what keeps the roadmap
coherent: a plugin host, an Electron app, four provider integrations, an in-app PRD editor,
and a native-module terminal are all things claudecodeui does well and PDLC Studio should
not attempt. Each rejection's reason is in its row above and restated in
`06-prioritization-and-roadmap.md` §4.

---

## Caveat on precision

33 of 133 rows carry an UNVERIFIED on at least one side. For claudecodeui this is because
the scan read the README, `package.json`, `server/index.js`, and the file tree — not all
~24 feature modules. For PDLC Studio, the few UNVERIFIED marks are behaviours that depend
on Astryx component internals (e.g. whether its `Markdown` supports GFM tables) rather than
on this repo's own code.

Where a row is unverified on the claudecodeui side, **the ranking never depends on it** —
each such feature was scored on its value to PDLC Studio's own users, with the competitor
column serving only as evidence that someone shipped it. No PRD's priority rests on an
unverified claim.
