# P05 — PWA Installability

| Field | Value |
| --- | --- |
| **Priority** | **P05** of 30 |
| **Score** | **18.0** |
| **Inputs** | Value 3 · Reach 3 · GapWeight ×2.0 · Effort 1 |
| **Category** | Mobile, Responsive & PWA |
| **Matrix features** | `MOB-02` (PWA installability) |
| **Maturity** | PDLC Studio **0** → target **3** · claudecodeui **4** *(inferred)* |
| **Effort** | **1** |
| **Depends on** | Nothing technically. **Constrained by P14** — see §3 and §9 |
| **Blocks** | `MOB-03` (service worker / offline shell) |
| **Status** | Proposed |

---

## 1. Context & problem statement

PDLC Studio's README claims a "Mobile-responsive design — touch-optimized interface for any
device" (`README.md:90`) and ships iPhone-SE-width screenshots. The layout does reflow. But
the app **cannot be installed**, so on a phone it is a browser tab: it shows browser chrome,
it is lost among other tabs, it has no home-screen presence, and it re-loads cold every time.

The current state is precisely two lines of `frontend/index.html`:

```html
<link rel="icon" type="image/svg+xml" href="/pdlc-studio-favicon.svg" />
<link rel="apple-touch-icon" href="/pdlc-studio-mark.svg" />
```

`frontend/public/` contains exactly two files, both SVG marks. There is **no web app
manifest** — a search of `frontend/index.html`, `frontend/vite.config.ts`, and
`frontend/package.json` for `manifest`, `service-worker`, `workbox`, and `vite-plugin-pwa`
returns zero hits.

The gap is unusually cheap to close, because **the hard part is already done**. The project
has original brand artwork at two optical sizes (`brand/pdlc-studio-mark.svg`,
`brand/pdlc-studio-mark-small.svg`), a documented sync process (`make sync-brand`), and a
test that fails the build if the copies drift (`AppIcon.test.tsx`). A manifest is mostly a
matter of pointing at assets that already exist and are already maintained.

### Why P05 rather than lower

Effort 1 against a ×2.0 gap weight. Installability is also the enabler for the rest of the
mobile story — `MOB-03` (offline shell) is meaningless without it, and P29 (mobile layout)
is much more worthwhile once the app can live on a home screen.

---

## 2. Competitive baseline

> **Licensing note.** claudecodeui is AGPL-3.0-or-later; PDLC Studio is MIT. No code may be
> copied. Cited as evidence of value only.

claudecodeui's mobile story is its headline: *"Works seamlessly across desktop, tablet, and
mobile so you can also use Agents from mobile."* It depends on `web-push ^3.6.7` and exposes
`/api/notifications`.

**Inference, marked as such**: Web Push requires a service worker, so a service worker and
almost certainly a manifest exist. The file was not read — this is recorded as UNVERIFIED in
`01-claudecodeui-deep-scan.md` §7.

Note that PDLC Studio should take **only the installability**, not the push notifications.
`MOB-04` (push) is explicitly rejected in `06-prioritization-and-roadmap.md` §4: it requires
VAPID keys and a push service, which is the wrong shape for a localhost-first tool.

---

## 3. Goals & non-goals

### Goals

1. The app can be installed to a home screen or desktop on browsers that support it.
2. Installed, it launches without browser chrome and looks like an application.
3. Icons render correctly at every size the platform requests, in both colour schemes.
4. The theme colour matches the app's actual light and dark backgrounds.
5. Manifest assets stay in sync with `brand/` through the existing tooling.

### Non-goals

- **Service worker / offline support.** `MOB-03`, deferred. A manifest alone is enough for
  installability on most platforms and carries none of a service worker's cache-invalidation
  risk.
- **Push notifications.** `MOB-04`, rejected.
- **Mobile layout and navigation.** That is P29.
- **Fixing pinch-zoom.** That is P13 — a separate one-line change to the same file, which
  should ideally ship together.
- **App-store packaging.** Out of scope.
- **Promoting remote access.** See below — this is a hard constraint, not a preference.

### 3.1 The constraint this PRD must respect

`04-uiux-workflow-comparison.md` §2 Journey G establishes that PDLC Studio's mobile story is
blocked on its security story: reaching the app from a phone requires `--host 0.0.0.0`,
which — with no authentication and (pre-P01) `bypassPermissions` — exposes arbitrary shell
execution to the local network.

**Installability itself widens no exposure.** Installing from `localhost` is exactly as safe
as browsing it. So this PRD may ship before P14.

What it **must not** do is *promote* the unsafe configuration. Specifically:

> **This PRD MUST NOT add `--host 0.0.0.0` guidance to onboarding, install prompts, the
> manifest description, or any new documentation, until P14 (authentication) has shipped.**

This is recorded as FR-13 and as an acceptance criterion.

---

## 4. Personas & user stories

**Marcus — uses it on a tablet on the same desk.**

> As a tablet user, I want the app on my home screen, so that I am not hunting for a tab
> among twenty others.

**Priya — desktop user who keeps it open all day.**

> As a desktop user, I want to install it as a standalone window, so that it is not
> competing with my browser tabs and gets its own alt-tab entry.

**Devon — cares about polish.**

> As a user, I want the installed icon and splash to look like the app's real identity, not
> a screenshot or a generic globe.

---

## 5. Functional requirements

### Manifest

- **FR-1** A web app manifest **MUST** be served and linked from `frontend/index.html`.
- **FR-2** It **MUST** declare `name` ("PDLC Studio"), `short_name`, `start_url`, `display`,
  `theme_color`, `background_color`, and `icons`.
- **FR-3** `display` **MUST** be `standalone`.
- **FR-4** `start_url` **MUST** be `/`, resolving to the launch screen.
- **FR-5** It **MUST** declare a `description` consistent with the README's positioning.
- **FR-6** It **MUST** be served with `Content-Type: application/manifest+json`.

### Icons

- **FR-7** Icons **MUST** be declared at the sizes platforms actually request — at minimum
  192×192 and 512×512 — plus a `maskable` variant.
- **FR-8** Icon sources **MUST** derive from `brand/`, not be drawn separately.
- **FR-9** The size-threshold logic already encoded in `AppIcon`
  (`SMALL_SIZE_THRESHOLD`) **MUST** be respected: the detailed ring mark for large sizes,
  the simplified mark for small ones.
- **FR-10** The `maskable` icon **MUST** keep its ink tile so platform masking does not crop
  into the glyph.

### Theming

- **FR-11** `theme_color` and `background_color` **MUST** match the app's real values.
  Because the app uses CSS `light-dark()` tokens resolving against `color-scheme`
  (`CLAUDE.md`), a single static colour cannot be right for both schemes — see §6.

### Build & sync

- **FR-12** The manifest **MUST** be produced by the existing build without a new dependency
  if achievable; `vite-plugin-pwa` **SHOULD NOT** be added, since it pulls in Workbox and
  service-worker machinery that is explicitly a non-goal.
- **FR-13** Documentation and onboarding **MUST NOT** gain `--host 0.0.0.0` guidance as part
  of this work (§3.1).
- **FR-14** Generated icon assets **MUST** be covered by the existing brand-drift protection,
  or the protection **MUST** be extended to cover them.

---

## 6. UX & interaction specification

### Install experience

Browser-driven; the app does not implement a custom install prompt. A custom
`beforeinstallprompt` UI is deliberately out of scope — it is easy to make annoying, and
platform-native affordances are well understood.

| Platform | Affordance |
| --- | --- |
| Chrome/Edge desktop | Install icon in the address bar |
| Chrome Android | "Add to Home screen" |
| Safari iOS | Share → "Add to Home Screen" (uses `apple-touch-icon`, already present) |
| Firefox | Limited support; degrades to a normal tab |

### Launched appearance

- No browser chrome (`display: standalone`).
- Splash derived from `background_color` and the 512×512 icon.
- Launch screen (`ProjectSelector`) is the entry point — correct, since it is where a user
  chooses a working directory.

### The light/dark problem

`theme_color` and `background_color` are **static values in a static JSON file**, but PDLC
Studio's colours come from `light-dark()` tokens that resolve at runtime against
`color-scheme` (`CLAUDE.md`, "Theming and dark mode"). There is no way to express "depends
on the user's scheme" in a manifest.

Three options, in order of preference:

1. **Match the light theme's background** in `background_color`, and use a neutral
   `theme_color` that is acceptable in both. Simple, static, no runtime behaviour.
2. **Supplement with `<meta name="theme-color" media="(prefers-color-scheme: dark)">`**,
   which *does* support media queries and is respected by several browsers for the chrome
   colour. The manifest value remains the fallback.
3. Dynamically rewrite the manifest — rejected. Complexity far exceeding the benefit.

**Recommendation: 1 + 2.** The splash may briefly mismatch for dark-theme users on first
launch, which is a small and well-understood PWA limitation.

The values must be read from the actual resolved Astryx tokens, not guessed. Note the
warning in `CLAUDE.md` that `--color-background-muted` is defined identically to
`--color-background-body` in theme-neutral — token names are not reliable proxies for
appearance here, so sample the rendered value.

### Accessibility

- `name` and `short_name` must be meaningful, since they become the accessible label of the
  installed app.
- Icons must maintain contrast against both light and dark home-screen wallpapers — the ink
  tile already handles this, which is why FR-10 matters.

---

## 7. Technical design

### 7.1 Icon generation

`brand/` holds SVGs; manifests need raster PNGs at declared sizes. Options:

| Approach | Assessment |
| --- | --- |
| Declare the SVG directly in `icons` | Support is inconsistent, especially for `maskable`. **Not sufficient alone.** |
| Commit pre-rendered PNGs to `frontend/public/` | Simple, no build step, no new dependency. But adds binary assets that can drift from `brand/`. |
| Generate PNGs at build time | Requires a raster dependency (e.g. `sharp`), which conflicts with the spirit of FR-12. |

**Recommendation: pre-rendered PNGs committed to `frontend/public/`, generated by extending
`make sync-brand`.**

This fits the project's existing pattern exactly. `CLAUDE.md` documents that the mark
already "lives in three places and nothing keeps them in sync automatically", that
`make sync-brand` is the reconciliation step, and that `AppIcon.test.tsx` fails the build if
they drift. Adding PNG generation to that same command and extending the drift test (FR-14)
keeps one mechanism rather than inventing a second.

If PNG generation requires a dependency, it belongs in **devDependencies of the frontend
only** — it must not reach the backend, where `deno compile` would embed it in every binary.

### 7.2 Manifest file

Static `frontend/public/manifest.webmanifest`, served by Vite from `public/` in dev and
copied into `dist/` on build. No plugin needed (FR-12).

```json
{
  "name": "PDLC Studio",
  "short_name": "PDLC",
  "description": "A web interface for the Claude Code CLI.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "…",
  "background_color": "…",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Colour values are placeholders until sampled from resolved tokens (§6).

### 7.3 `frontend/index.html`

Add:

```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="…" />
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="…" />
```

**P13 touches this same file** to remove `user-scalable=no`. Coordinate or ship together —
they are both one-line changes to `frontend/index.html` and reviewing them as one diff is
cheaper.

### 7.4 Serving from the binary

**This is the non-obvious risk.** The backend serves the built frontend from inside the
compiled binary. Recent history shows this is fragile: commit `e84ec13` is
*"fix: serve root-level static assets from the binary (#25)"* — meaning root-level static
assets have already broken here once.

`manifest.webmanifest` and the icon PNGs are exactly that class of asset. Requirements:

- Confirm the static-serving path includes them (check the middleware/handler that serves
  `dist/`).
- Confirm the MIME type for `.webmanifest` is `application/manifest+json` (FR-6). An unknown
  extension may be served as `application/octet-stream`, which some browsers reject.
- **Verify against a real compiled binary**, not just `npm run dev`. Dev-server behaviour
  will not catch this.

### 7.5 Reuse

| Need | Existing thing | Path |
| --- | --- | --- |
| Brand source | canonical SVGs | `brand/` |
| Sync mechanism | `make sync-brand` | `Makefile` |
| Drift protection | `AppIcon.test.tsx` | `frontend/src/components/` |
| Optical size logic | `SMALL_SIZE_THRESHOLD` | `frontend/src/components/AppIcon.tsx` |
| Static serving | existing dist-serving path | `backend/` |

---

## 8. Data model & persistence

**None.** The manifest is a static build artefact.

---

## 9. Security implications

**Installability itself changes nothing.** An installed PWA has the same origin, the same
permissions, and the same network reachability as the tab it was installed from.

Two things worth stating:

1. **The §3.1 constraint is a security requirement, not a stylistic one.** Making the mobile
   experience more attractive without authentication increases the chance a user reaches for
   `--host 0.0.0.0`. FR-13 exists to prevent this PRD from doing that.
2. **Secure-context implications.** Installability generally requires HTTPS or `localhost`.
   A user on `http://192.168.x.x` may find install unavailable — which is, in this specific
   case, a helpful accident: the configuration that is unsafe pre-P14 is also the one where
   installation does not work.

No new attack surface: no new endpoint, no new input, no new dependency at runtime.

---

## 10. Performance & scale

Negligible. Three PNGs and a small JSON file, fetched once by the browser at install time.
Total added payload well under 100 KB.

Slight positive: an installed app skips browser-chrome rendering.

---

## 11. Telemetry & observability

None. Install events are not observable to the app without analytics, which the product does
not have and this PRD does not add.

---

## 12. Test plan

### Automated

Extend `frontend/src/components/AppIcon.test.tsx` — or add a sibling — since it already owns
brand-drift protection:

| Test | Asserts |
| --- | --- |
| Manifest exists and is valid JSON | FR-1 |
| Declares all required fields | FR-2 |
| `display` is `standalone` | FR-3 |
| `start_url` is `/` | FR-4 |
| Every declared icon file exists in `frontend/public/` | FR-7 |
| At least one icon has `purpose: "maskable"` | FR-7 |
| Generated PNGs are consistent with `brand/` sources | FR-14 |
| `index.html` links the manifest | FR-1 |

The last one matters: a manifest that exists but is not linked is invisible, and that is a
plausible regression during a future `index.html` edit.

### Manual — the important half

Installability cannot be meaningfully unit-tested.

1. **Build a real binary** (`cd backend && deno task build`) and run it. Not the dev server.
2. `curl -I http://localhost:8080/manifest.webmanifest` → 200 with
   `application/manifest+json` (FR-6, §7.4).
3. `curl -I` each icon → 200 with `image/png`.
4. Chrome desktop → install affordance appears; install; confirm standalone window, correct
   icon, correct title.
5. Chrome Android → Add to Home screen; confirm icon is not cropped into the glyph (FR-10)
   and the splash colour is sane.
6. Safari iOS → Add to Home Screen; confirm the `apple-touch-icon` path still works.
7. Dark mode: install and launch with a dark system theme; note any splash mismatch and
   confirm it is acceptable (§6).
8. Lighthouse PWA audit — expect installability to pass and offline checks to fail, which is
   correct given `MOB-03` is out of scope.

---

## 13. Rollout & migration

No migration, no persisted state, no wire change. Minor release.

**Ship with P13** (pinch-zoom fix) — both are single-line-ish changes to
`frontend/index.html` and reviewing them together is cheaper than twice.

Release notes should be modest: this enables installation; it does not add offline support
or notifications, and users should not expect them.

---

## 14. Risks & mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| 1 | **Static assets not served from the compiled binary** — this exact class of bug already occurred (`e84ec13`) | **Medium** | **High** | §7.4; verify against a real binary, not the dev server; explicit manual step |
| 2 | `.webmanifest` served with the wrong MIME type | **Medium** | Medium | FR-6; explicit `curl -I` check |
| 3 | Maskable icon cropped into the glyph on Android | Medium | Medium | FR-10 ink tile; manual device check |
| 4 | Icon PNGs drift from `brand/` | Medium | Low | FR-14 extends existing drift test |
| 5 | Splash colour mismatches dark theme | **High** (inherent) | Low | Accepted limitation; documented in §6 |
| 6 | Manifest link removed by a future `index.html` edit | Low | Medium | Automated test asserting the link |
| 7 | Someone adds `--host 0.0.0.0` guidance alongside this work | Medium | **High** | FR-13 and an explicit acceptance criterion |
| 8 | A raster dependency creeps into the backend and inflates the binary | Low | High | Frontend devDependency only (§7.1) |

---

## 15. Acceptance criteria

- [ ] `manifest.webmanifest` exists and is linked from `index.html`
- [ ] Declares name, short_name, description, start_url, scope, display, theme_color, background_color, icons
- [ ] `display: standalone`, `start_url: /`
- [ ] 192, 512, and maskable icons declared and present
- [ ] Icons derive from `brand/` via `make sync-brand`
- [ ] Drift protection covers the generated PNGs
- [ ] Colours sampled from resolved Astryx tokens, not guessed
- [ ] `<meta name="theme-color">` present with a dark-scheme variant
- [ ] **Served correctly from a compiled binary**, with the right MIME type
- [ ] Installs on Chrome desktop and Chrome Android
- [ ] Maskable icon not cropped into the glyph
- [ ] iOS Add-to-Home-Screen still uses the existing `apple-touch-icon`
- [ ] **No `--host 0.0.0.0` guidance added anywhere** (FR-13)
- [ ] No `vite-plugin-pwa`, no Workbox, no service worker
- [ ] No new backend runtime dependency
- [ ] `make check` passes

---

## 16. Open questions

1. **How are the PNGs generated?** A committed-artefact approach needs a generation step in
   `make sync-brand`; that step needs a rasteriser. Is a frontend devDependency acceptable,
   or should the PNGs be generated once by hand and committed? The latter is simplest but
   weakens FR-14.
2. **What exactly are the resolved background colours** in light and dark? Must be sampled,
   not guessed — `CLAUDE.md` warns that token names mislead here.
3. **Does the binary's static handler already cover `.webmanifest`?** Blocking for §7.4;
   check before estimating.
4. **Should `short_name` be "PDLC" or "PDLC Studio"?** Home-screen labels truncate around
   12 characters. "PDLC Studio" is 11, so it may fit — worth checking on a real device
   rather than assuming.
5. **Is `MOB-03` (service worker) wanted soon?** If so, some manifest decisions (scope,
   start_url) are worth making with it in mind, even though it is out of scope here.

---

## 17. Effort breakdown

| Task | Estimate |
| --- | --- |
| Sample resolved theme colours | 0.5 h |
| Generate icon PNGs + extend `make sync-brand` | 2 h |
| Write the manifest | 0.5 h |
| `index.html` links and theme-color metas | 0.5 h |
| Verify/fix static serving from the binary | **2 h** (risk 1) |
| Extend drift test + manifest assertions | 2 h |
| Manual device verification (desktop, Android, iOS) | 2 h |
| **Total** | **≈9.5 h — 1.5 days** |

The estimate is dominated by verification rather than authoring, which is right: the
manifest is trivial and the ways it silently fails to work are not.

---

## 18. References

- `frontend/index.html:12-15` — current icon links and the viewport meta P13 will change
- `frontend/public/` — currently two SVGs only
- `brand/README.md` — canonical mark source, palette, editing gotchas
- `CLAUDE.md` § "App Mark" — two optical sizes, three locations, `make sync-brand`, drift test
- `CLAUDE.md` § "Theming and dark mode" — `light-dark()` tokens and `color-scheme`
- `Makefile` — `sync-brand` target
- Commit `e84ec13` — "fix: serve root-level static assets from the binary (#25)"
- `../03-feature-comparison-matrix.md` — `MOB-02`
- `../04-uiux-workflow-comparison.md` §2 Journey G — the security constraint
- `../06-prioritization-and-roadmap.md` §3 — mobile/auth sequencing note
