# Deep Scan — siteboon/claudecodeui (now "CloudCLI")

> **Target**: <https://github.com/siteboon/claudecodeui>
> **Package**: `@cloudcli-ai/cloudcli` **v1.36.3**
> **License**: **AGPL-3.0-or-later**
> **Scale**: 12.9k stars · 1.8k forks · 93 open issues
> **Date scanned**: 2026-07-26
> **Method**: README, `package.json`, `server/index.js`, and the GitHub file tree, fetched
> directly. Claims inferred from the dependency manifest rather than read in source are
> marked **[inferred]**. Claims I could not check at all are marked **[UNVERIFIED]**.

---

## 0. The headline finding, stated first

**This is no longer the same category of project as PDLC Studio.**

The repository name still says `claudecodeui`, but the shipped package is
`@cloudcli-ai/cloudcli` and the README sells **CloudCLI Cloud at €7/month**. It has become
a commercial, multi-provider, multi-user agent workbench with a plugin marketplace, an
Electron desktop build, and a hosted tier. PDLC Studio is a 6,250-line single-purpose local
chat front end.

Comparing them feature-for-feature is still useful — it is the clearest available map of
what this product space contains — but the roadmap that falls out of it must not be read as
"catch up to claudecodeui." Catching up is neither achievable nor obviously desirable. See
§9 for what that means in practice, and §8 for a licensing constraint that makes direct
code reuse impossible regardless.

---

## 1. Identity and positioning

| Property | Value |
| --- | --- |
| Repo | `siteboon/claudecodeui` |
| npm package | `@cloudcli-ai/cloudcli` |
| Version | 1.36.3 |
| `package.json` description | "A web-based UI for Claude Code CLI" (stale — predates the rebrand) |
| GitHub description | "A desktop and mobile UI for Claude Code, Cursor CLI, and Codex … use it locally or remotely to view your active projects and sessions from everywhere" |
| License | **AGPL-3.0-or-later** (plus a `NOTICE` file) |
| Stars / Forks / Open issues | 12.9k / 1.8k / 93 |
| Docs | `README.md` translated into **7 languages**, plus `CHANGELOG.md`, `CONTRIBUTING.md` |
| Commercial tier | CloudCLI Cloud, from **€7/month** |

Top-level layout: `.github/`, `.husky/`, `docker/`, `electron/`, `plugins/`, `public/`,
`server/`, `src/`, `shared/`, plus `.env.example`, `tsconfig.json`, `vite.config.js`,
`tailwind.config.js`.

The presence of `docker/`, `electron/`, and `plugins/` as *top-level, first-class*
directories is itself the story: this ships as a web app, a desktop app, a container, and a
plugin host.

---

## 2. Architecture

| Layer | Technology | Evidence |
| --- | --- | --- |
| Server | **Express 4.18** | `express ^4.18.2` |
| Database | **SQLite** via `better-sqlite3 ^12.6.2` | dependency + `projectsDb` / `sessionsDb` in `server/index.js` |
| Realtime | **WebSocket** (`ws ^8.14.2`) — a single unified server | `createWebSocketServer()` in `server/index.js` |
| Frontend | React 18 + Vite 7 + **Tailwind 3.4** | dependencies |
| Language | TypeScript 5.9 (mixed with legacy JS) | `typescript ^5.9.3`, `tsconfig.json` |
| Desktop | **Electron 38** + electron-builder (macOS + Windows) | `electron`, `desktop:dist:mac`, `desktop:dist:win` |
| Default port | **3001** (`SERVER_PORT`), Vite dev on 5173 | `server/index.js` |
| Default bind | **`0.0.0.0`** (`HOST`) | `server/index.js` |

### 2.1 The WebSocket is the architectural dividing line

`createWebSocketServer()` handles, over **one** socket:

- chat for **four** providers (Claude, Cursor, Codex, OpenCode)
- a **shell/terminal proxy**, with URL detection and ANSI stripping
- **plugin proxy routing** via `getPluginPort()`

PDLC Studio has no persistent socket at all — it streams NDJSON on the response body of a
chat POST (`backend/handlers/chat.ts:163-169`). Everything in claudecodeui that pushes to
the client outside a request/response cycle — live terminal output, file-watcher events,
plugin traffic — is structurally impossible in PDLC Studio without adopting a new
transport. This is the single most consequential architectural difference between the two
products.

### 2.2 Module structure

`src/components/` contains **24 feature modules**, each following a consistent
`hooks/ · types/ · view/ · utils/ · constants/` internal layout (confirmed on
`chat/` and `main-content/`). This is enforced mechanically by
`eslint-plugin-boundaries ^6.0.2` — a genuine architectural discipline, and one of the few
places where claudecodeui's engineering rigour matches PDLC Studio's.

The 24 modules:

```
app                     browser-use          chat                 code-editor
command-palette         file-tree            git-panel            llm-logo-provider
main-content            mcp                  onboarding/view      plugins/view
prd-editor              project-creation-wizard                   provider-auth
quick-settings-panel    settings             shell                sidebar
skills                  standalone-shell/view                     task-master
version-upgrade/view    auth
```

---

## 3. Feature inventory

### 3.1 Access, Identity & Security — **maturity 4**

- **JWT authentication** (`jsonwebtoken ^9.0.2`) with **bcrypt** password hashing
  (`bcrypt ^6.0.0`).
- `authenticateToken` middleware guards essentially every `/api/*` route;
  `/api/auth` and `/health` are the only public surfaces.
- **Token refresh** via an `X-Refreshed-Token` response header.
- `authenticateWebSocket()` — the socket is authenticated too, not just HTTP.
- **Separate API-key auth path**: `validateApiKey` middleware, with `/api/agent` guarded by
  API key rather than user token — i.e. a machine-to-machine surface distinct from the
  human one.
- `/api/browser-use-mcp` is restricted to **local** connections specifically.
- **XSS defence**: `dompurify ^3.4.7` sanitises rendered content — necessary, because
  `rehype-raw` deliberately allows raw HTML through the Markdown pipeline.

**Default tool posture is the exact inverse of PDLC Studio's.** The README states: *"All
Claude Code tools are **disabled by default**. This prevents potentially harmful operations
from running automatically."* PDLC Studio ships `bypassPermissions` — everything allowed,
no prompts.

This is the sharpest philosophical split between the two products. claudecodeui is built to
be exposed (`0.0.0.0` bind, remote access as the headline use case) and therefore
defaults closed. PDLC Studio is built to run unattended on localhost and therefore defaults
open. Neither is wrong in isolation; but PDLC Studio's default becomes indefensible the
moment anyone follows the README's own `--host 0.0.0.0` example.

### 3.2 Chat & Streaming Experience — **maturity 4**

- WebSocket-based streaming across four providers.
- Rich Markdown: `react-markdown ^10` + `remark-gfm` (tables, task lists, strikethrough)
  + **`remark-math` + `rehype-katex` + `katex`** (LaTeX rendering) + `rehype-raw`
  (raw HTML) + `react-syntax-highlighter`.
- **Chat image assets** get a dedicated authenticated route (`/api/assets`).
- **Token usage per session**: `/api/projects/:projectId/sessions/:sessionId/token-usage`.
- Session resume, multiple concurrent sessions, history tracking (README).

PDLC Studio's Markdown goes through Astryx `Markdown`; it has no math rendering and no raw
HTML (which is also why it needs no sanitiser).

### 3.3 Session & Conversation Management — **maturity 4**

- Sessions persisted in **SQLite**, not just read from Claude's JSONL. The `session` table
  carries `id`, `provider`, `provider_session_id`, `jsonl_path`, `tokens_input`,
  `tokens_output` — i.e. it *indexes* the JSONL rather than replacing it, and adds
  cross-provider identity plus token accounting on top.
- `fuse.js ^7.0.0` provides fuzzy search **[inferred: over sessions and/or files]**.
- `@vscode/ripgrep ^1.17.1` — full-text code search at ripgrep speed.

The SQLite index is what makes cross-session search, token totals, and multi-provider
session listing tractable. PDLC Studio re-parses JSONL on every request
(`backend/history/parser.ts`), which is fine at small scale and is the reason it has no
search.

### 3.4 Project & Workspace Management — **maturity 4**

- `/api/projects` (authenticated), `projects` table in SQLite.
- `/api/browse-filesystem`, `/api/create-folder`.
- A dedicated **`project-creation-wizard`** module — multi-step, versus PDLC Studio's
  single-purpose dialogs.
- **`onboarding/`** module — first-run guidance, which PDLC Studio has none of.

### 3.5 Code & File Interaction — **maturity 5**

This is the largest single capability gap. PDLC Studio scores **0** here.

- **Full CodeMirror 6 editor** (`@uiw/react-codemirror ^4.23.13`) with language support for
  **CSS, HTML, JavaScript, JSON, Markdown, Python**.
- **`@codemirror/merge ^6.11.1`** — a real side-by-side **diff/merge view**.
- **`@replit/codemirror-minimap`** — VS Code-style minimap.
- `@codemirror/theme-one-dark`.
- **`file-tree`** module — interactive tree with syntax highlighting and live editing
  (README).
- Complete file CRUD over HTTP:

  | Route | Method | Purpose |
  | --- | --- | --- |
  | `/api/projects/:projectId/file` | GET/PUT | Read and **write** a file |
  | `/api/projects/:projectId/files` | GET/DELETE | List and delete |
  | `/api/projects/:projectId/files/content` | GET | Binary file serving |
  | `/api/projects/:projectId/files/create` | POST | Create file or directory |
  | `/api/projects/:projectId/files/rename` | PUT | Rename |
  | `/api/projects/:projectId/files/upload` | POST | Upload (multer) |

- **`chokidar ^4.0.3`** file watching → live refresh as the agent edits
  **[inferred from dependency + WebSocket presence]**.
- Upload limits: **200 MB per file, 20 files max**; JSON body limit 50 MB.
- `jszip` for archive handling **[inferred: download/export of a folder]**.

### 3.6 Version Control — **maturity 4**

- Dedicated `/api/git` route group and a **`git-panel`** component module.
- README: *"View, stage and commit your changes. You can also switch branches."*
- `@octokit/rest ^22.0.0` — GitHub API integration beyond local git
  **[inferred scope: PRs/issues; not verified]**.
- Diff rendering available via `@codemirror/merge`.

PDLC Studio has `git init` and `git clone` and nothing else.

### 3.7 Terminal & Shell Access — **maturity 5**

- **`node-pty ^1.2.0-beta.12`** — real pseudo-terminal.
- **`@xterm/xterm ^5.5.0`** plus four addons: `addon-fit`, `addon-clipboard`,
  `addon-web-links`, **`addon-webgl`** (GPU-accelerated rendering).
- Two modules: **`shell`** (embedded) and **`standalone-shell/`** (detached window).
- Proxied over the unified WebSocket with URL detection and ANSI stripping.

PDLC Studio has nothing here, and — importantly — *cannot* have it without both a socket
transport and abandoning the pure-`deno compile` distribution, since `node-pty` is a native
module.

### 3.8 Agent Configuration & Extensibility — **maturity 5**

The broadest area, and the one where the two products are least comparable.

- **Plugin system**: top-level `plugins/` directory, `/api/plugins` routes, a
  `plugins/view` module, and WebSocket plugin proxying via `getPluginPort()`. The README
  describes plugins that "add new tabs, backend services, and integrations" — i.e. plugins
  run **their own backend processes on their own ports**.
- **MCP management**: `/api/mcp-utils` + an `mcp` component module + MCP config syncing.
  PDLC Studio uses MCP only as a *development* tool (Playwright, per its `CLAUDE.md`); it
  exposes nothing to users.
- **Skills**: a `skills` module.
- **Slash commands**: `/api/commands` + `cmdk ^1.1.1` (the command-palette library) + a
  `command-palette` module. `gray-matter` (frontmatter) and `@iarna/toml` parse
  command/agent definition files **[inferred]**.
- **`prd-editor`** module — an in-app PRD editor. Notable given this very research task.
- **TaskMaster AI**: `/api/taskmaster` + `task-master` module — "AI-powered task planning,
  PRD parsing, and workflow automation."
- **Browser use**: `/api/browser-use` + `/api/browser-use-mcp` + `browser-use` module —
  agent-driven browser sessions for research and testing.
- **`/api/agent`** — API-key-authenticated agent surface for programmatic use.

### 3.9 Model, Cost & Usage Observability — **maturity 4**

- **Four providers**: Claude (`@anthropic-ai/claude-agent-sdk ^0.3.165`), Codex/GPT
  (`@openai/codex-sdk ^0.144.0`), Cursor CLI (`/api/cursor`), and OpenCode.
- `/api/providers` for provider configuration; `provider-auth` module for per-provider
  credentials; `llm-logo-provider` for provider branding in the UI.
- **Token accounting persisted per session** (`tokens_input`, `tokens_output` columns) and
  exposed at `/api/projects/:projectId/sessions/:sessionId/token-usage`.

PDLC Studio pins a single provider, offers no model selection, and actively *silences*
`rate_limit_event`.

### 3.10 Multimodal & Rich Input — **maturity 4**

- **File/image upload**: `multer ^2.0.1` server-side, `react-dropzone ^14.2.3` client-side
  drag-and-drop.
- Dedicated `/api/assets` route for chat image assets.
- **Voice**: `/api/voice` — described in `server/index.js` as a "voice proxy", i.e. it
  forwards to an external transcription service rather than bundling a model
  **[inferred; provider not identified]**.

PDLC Studio scores 0 across all of this — `ChatRequest.message` is a bare `string`.

### 3.11 Mobile, Responsive & PWA — **maturity 4**

- README headline: *"Works seamlessly across desktop, tablet, and mobile so you can also
  use Agents from mobile."* Remote access from a phone is the product's signature use case.
- **`web-push ^3.6.7`** — real Web Push notifications, plus a `/api/notifications` route
  group. This requires a service worker, so a PWA service worker almost certainly exists
  **[inferred: `web-push` is meaningless without one; the file itself was not read]**.

### 3.12 Design System, Theming & i18n — **maturity 3**

- **Tailwind 3.4** + `class-variance-authority` + `clsx` + `tailwind-merge` — a
  utility-class approach with CVA for variants. This is a conventional, well-executed
  stack, but it is *not* a design system with enforced tokens the way Astryx is.
- `@tailwindcss/typography` for prose, `lucide-react` for icons.
- **Internationalisation**: `i18next ^25.7.4` + `react-i18next` +
  `i18next-browser-languagedetector`, with the README itself translated into 7 languages.
  **PDLC Studio has no i18n whatsoever** — this is an unremarked-upon but total gap.
- `react-error-boundary` + a dedicated `ErrorBoundary.tsx` in the main content view.

I score this **3 rather than 4** because Tailwind + CVA is a styling convention rather than
a governed component system, and because no accessibility tooling appears anywhere in the
dependency list. PDLC Studio scores **5** here and it is its clearest win.

### 3.13 Platform, Distribution & Deployment — **maturity 5**

- **Electron desktop app** for macOS **and Windows** (`desktop:dist:mac`,
  `desktop:dist:win`, `desktop:icon:mac`). PDLC Studio explicitly does **not** support
  Windows.
- **Docker**: a top-level `docker/` directory; README calls the sandboxes "experimental".
- **npm** distribution, actually published, at v1.36.3.
- **`/api/system/update`** — in-app self-update, plus a `version-upgrade/` module.
- **Hosted cloud tier** at €7/month.
- `.env.example` for configuration.

### 3.14 Engineering Quality — **maturity 3**

This is the one category where claudecodeui is *behind* PDLC Studio, and the gap is stark.

- **No test framework anywhere.** The 35 devDependencies contain no Vitest, no Jest, no
  Mocha, no Playwright, no Testing Library. None of the 24 npm scripts is `test`. The
  quality gates are `typecheck` and `lint` only.
- Strong *static* discipline, though: ESLint 9 flat config with
  **`eslint-plugin-boundaries`** (architectural layering), `eslint-plugin-import-x`,
  `eslint-plugin-react-hooks`, `eslint-plugin-unused-imports`,
  `eslint-plugin-tailwindcss`, and `typescript-eslint`.
- **Husky + lint-staged + commitlint** (conventional commits).
- **`release-it` + `@release-it/conventional-changelog` + `auto-changelog`** — automated,
  changelog-generating releases. Consistent with v1.36.3 and a maintained `CHANGELOG.md`.
- 93 open issues against 12.9k stars.

PDLC Studio, at ~1/20th the size, has 14 test files, tests on both runtimes, and a
`make check` gate that CI and a pre-commit hook both enforce.

---

## 4. Route inventory (from `server/index.js`)

Public: `/health`, `/api/auth`.
Token-authenticated: `/api/projects`, `/api/assets`, `/api/git`, `/api/cursor`,
`/api/taskmaster`, `/api/mcp-utils`, `/api/commands`, `/api/settings`, `/api/notifications`,
`/api/user`, `/api/plugins`, `/api/browser-use`, `/api/providers`, `/api/voice`,
`/api/system/update`, `/api/browse-filesystem`, `/api/create-folder`, and the seven
`/api/projects/:projectId/file(s)/*` routes plus `…/sessions/:sessionId/token-usage`.
API-key-authenticated: `/api/agent`. Local-only: `/api/browser-use-mcp`.

That is roughly **28 route groups against PDLC Studio's 8 endpoints**.

---

## 5. Maturity snapshot

| # | Category | claudecodeui | PDLC Studio | Δ |
| --- | --- | --- | --- | --- |
| 1 | Access, Identity & Security | 4 | 1 | **+3** |
| 2 | Chat & Streaming Experience | 4 | 4 | 0 |
| 3 | Tool Execution & Permissions | 4 | 4 / 1 default | +0/+3 |
| 4 | Session & Conversation Mgmt | 4 | 3 | +1 |
| 5 | Project & Workspace Mgmt | 4 | 4 | 0 |
| 6 | Code & File Interaction | 5 | 0 | **+5** |
| 7 | Version Control | 4 | 1 | **+3** |
| 8 | Terminal & Shell Access | 5 | 0 | **+5** |
| 9 | Agent Config & Extensibility | 5 | 1 | **+4** |
| 10 | Model, Cost & Usage | 4 | 1 | **+3** |
| 11 | Multimodal & Rich Input | 4 | 0 | **+4** |
| 12 | Mobile, Responsive & PWA | 4 | 2 | +2 |
| 13 | Design System, Theming & A11y | 3 | 5 | **−2** |
| 14 | Platform & Distribution | 5 | 4 | +1 |
| 15 | Engineering Quality | 3 | 5 | **−2** |

**Means: claudecodeui 4.1, PDLC Studio 2.4.**

PDLC Studio leads in exactly two categories — design system and engineering quality — and
those two leads are real, defensible, and worth protecting.

---

## 6. What claudecodeui does *not* have

Recorded so the comparison is not one-directional:

- **No automated tests at all.** Largest single quality gap in either product.
- **No governed design system** — Tailwind utility classes, not enforced tokens.
- **No accessibility tooling** in the dependency list; no `jsx-a11y` plugin, no axe.
- **No single-file binary** — needs Node, or Electron, or Docker. PDLC Studio's 38 MB
  self-contained artefact has no equivalent here.
- **No Deno support / no runtime portability.**
- **A stale `package.json` description** still saying "A web-based UI for Claude Code CLI"
  three product generations later.
- **Architectural documentation** — there is a `CONTRIBUTING.md`, but nothing comparable to
  PDLC Studio's 598-line `CLAUDE.md` recording rationale and reversals.

---

## 7. Unverified items

Stated plainly rather than glossed:

- Whether a **service worker / PWA manifest** exists (inferred from `web-push`; file not
  read).
- The **voice** provider behind `/api/voice`.
- The exact scope of **`@octokit/rest`** usage (PRs? issues? auth only?).
- Whether **`chokidar`** drives live file-tree refresh or only server-side cache
  invalidation.
- The **plugin API contract** and its security model — plugins running their own backend
  processes is a substantial trust surface that was not examined.
- Whether `fuse.js` searches sessions, files, commands, or all three.
- Any **rate limiting** or brute-force protection on `/api/auth`.
- The contents of `shared/` and the `docker/` compose setup.

None of these change the conclusions in §0 or §9.

---

## 8. Licensing — a hard constraint

**claudecodeui is AGPL-3.0-or-later. PDLC Studio is MIT** (`LICENSE`).

The consequences are not negotiable:

1. **No code may be copied** from claudecodeui into PDLC Studio. Not a component, not a
   utility function, not a CSS block. AGPL is copyleft and incompatible with continuing to
   distribute PDLC Studio under MIT.
2. **AGPL's network clause** would additionally require source distribution to anyone
   *using the app over a network* — directly hostile to how PDLC Studio ships.
3. Every PRD in `prds/` must therefore be a **clean-room specification**: it may cite
   claudecodeui as evidence that a capability is valuable and describe *what* it does
   observably, but implementation must be independently designed.

This is called out in every PRD's "Competitive baseline" section for exactly this reason.

---

## 9. What this means for PDLC Studio

Three conclusions the roadmap is built on:

**1. Parity is the wrong goal.** claudecodeui has a commercial team, a paid tier, 12.9k
stars, and four provider integrations. A ~6k-line project with a 38 MB binary and a
`make check` gate should not chase a plugin marketplace. The interesting question is not
"what are we missing" but "which gaps actually hurt our own users."

**2. The security default is the one genuinely urgent item.** Everything else on the list
is a feature. `bypassPermissions` + zero authentication + a README that shows
`--host 0.0.0.0` is a live hazard, and claudecodeui's inverse default (tools disabled,
JWT + bcrypt, authenticated WebSocket) demonstrates the alternative is entirely
practical. This is why security-class items dominate the top of the ranking even under a
value÷effort model rather than a security-first one — they score well on *both* axes.

**3. The two leads must be protected, not traded away.** Astryx and the test suite are why
PDLC Studio is pleasant to work on. Several otherwise-attractive features — an embedded
`node-pty` terminal, a plugin host — would damage one or both (native modules break
`deno compile`; a plugin API is a permanent compatibility surface). Those are ranked low
in `06-prioritization-and-roadmap.md` **on merit**, not by oversight.

The features worth taking are the ones that fit a local-first, single-binary, well-tested
app: authentication, a file viewer, a git status panel, session search, cost visibility,
image paste, PWA installability, i18n scaffolding. Those are what the top 30 PRDs cover.
