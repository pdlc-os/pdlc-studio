/// <reference types="vite/client" />

/**
 * App version, injected at build time by vite.config.ts from
 * backend/package.json — the single source of truth for the release version
 * (the same file `generate-version.js` reads for the binary's --version).
 */
declare const __APP_VERSION__: string;
