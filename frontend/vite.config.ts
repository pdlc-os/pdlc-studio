/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * The launch screen shows the app version, so read it from the same file that
 * everything else derives it from: backend/package.json. frontend/package.json
 * stays at 0.0.0 and is not the release version.
 *
 * Read at config time rather than fetched at runtime so the version is baked
 * into the bundle and works in the single-binary build.
 */
function readAppVersion(): string {
  try {
    const pkg = readFileSync(
      resolve(__dirname, "../backend/package.json"),
      "utf8",
    );
    return JSON.parse(pkg).version ?? "0.0.0";
  } catch {
    // Don't fail the build over a cosmetic version string.
    return "0.0.0";
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(__dirname, ".."), "");
  const apiPort = env.PORT || "8080";

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(readAppVersion()),
    },
    resolve: {
      alias: {
        "@shared": resolve(__dirname, "../shared"),
      },
    },
    server: {
      port: 3000,
      proxy: {
        "/api": {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test-setup.ts"],
      globals: true,
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/cypress/**",
        "**/.{idea,git,cache,output,temp}/**",
        "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
        "**/scripts/**", // Exclude Playwright demo recording files
        "**/tests/**", // Exclude Playwright validation tests
      ],
    },
  };
});
