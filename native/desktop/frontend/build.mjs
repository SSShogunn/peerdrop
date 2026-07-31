// Builds the real frontend (client/) with pnpm and copies its output into
// ./dist so Wails' `//go:embed all:frontend/dist` in ../main.go can pick it
// up — this directory has no frontend source of its own, it only wraps
// client/'s existing Vite build.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const clientDir = join(here, "..", "..", "..", "client");
const clientDist = join(clientDir, "dist");
const outDist = join(here, "dist");

console.log(`[peerdrop-desktop] building client at ${clientDir}`);
execFileSync("pnpm", ["install", "--frozen-lockfile"], { cwd: clientDir, stdio: "inherit", shell: true });
execFileSync("pnpm", ["build"], { cwd: clientDir, stdio: "inherit", shell: true });

if (!existsSync(clientDist)) {
    throw new Error(`client build did not produce ${clientDist}`);
}

rmSync(outDist, { recursive: true, force: true });
cpSync(clientDist, outDist, { recursive: true });
console.log(`[peerdrop-desktop] copied ${clientDist} -> ${outDist}`);
