// Portions Copyright (c) 2026 Enrique Rocha (@soyenriquerocha) - see LICENSE for original authors
// SPDX-License-Identifier: MIT
// id: er-00809c4b
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

function compareVersions(a: string, b: string): number {
  const pa = a.split(/[^0-9]+/).filter(Boolean).map(Number);
  const pb = b.split(/[^0-9]+/).filter(Boolean).map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return a.localeCompare(b);
}

function desktopCliDirs(): string[] {
  const home = os.homedir();

  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
    return [path.join(appData, "ai.opencode.desktop", "cli")];
  }

  if (process.platform === "darwin") {
    return [
      path.join(
        home,
        "Library",
        "Application Support",
        "ai.opencode.desktop",
        "cli"
      ),
    ];
  }

  const configHome =
    process.env.XDG_CONFIG_HOME ?? path.join(home, ".config");
  return [
    path.join(configHome, "ai.opencode.desktop", "cli"),
    path.join(home, ".local", "share", "ai.opencode.desktop", "cli"),
  ];
}

function desktopCliCandidates(): string[] {
  const exe = process.platform === "win32" ? "opencode-cli.exe" : "opencode-cli";
  const found: string[] = [];

  for (const dir of desktopCliDirs()) {
    try {
      const versions = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort(compareVersions)
        .reverse();

      for (const version of versions) {
        const candidate = path.join(dir, version, exe);
        if (fs.existsSync(candidate)) found.push(candidate);
      }
    } catch {
      // directory does not exist
    }
  }

  return found;
}

function buildCandidates(): string[] {
  const home = os.homedir();
  const candidates: string[] = [];

  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
    const localAppData =
      process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");

    candidates.push(
      path.join(appData, "npm", "opencode.cmd"),
      path.join(appData, "npm", "opencode.exe"),
      path.join(localAppData, "Programs", "opencode", "opencode.exe"),
      path.join(home, ".opencode", "bin", "opencode.exe"),
      path.join(home, ".bun", "bin", "opencode.exe")
    );
  } else {
    candidates.push(
      path.join(home, ".opencode/bin/opencode"),
      path.join(home, ".local/bin/opencode"),
      "/usr/local/bin/opencode",
      "/opt/homebrew/bin/opencode",
      path.join(home, ".bun/bin/opencode")
    );
  }

  return candidates;
}

function probePath(): string | null {
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    const result = spawnSync(cmd, ["opencode"], {
      encoding: "utf-8",
      timeout: 2000,
    });
    if (result.status === 0 && result.stdout) {
      const first = result.stdout.split(/\r?\n/).find((line) => line.trim());
      if (first && fs.existsSync(first.trim())) return first.trim();
    }
  } catch {
    // ignore
  }
  return null;
}

export function findOpenCodePath(): string | null {
  if (
    process.env.OPENCODE_CLI_PATH &&
    fs.existsSync(process.env.OPENCODE_CLI_PATH)
  ) {
    return process.env.OPENCODE_CLI_PATH;
  }

  for (const candidate of desktopCliCandidates()) {
    if (fs.existsSync(candidate)) return candidate;
  }

  for (const candidate of buildCandidates()) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return probePath();
}

export function getOpenCodePath(): string {
  const found = findOpenCodePath();
  if (found) return found;
  throw new Error(
    "OpenCode CLI not found. Install OpenCode from https://opencode.ai or set OPENCODE_CLI_PATH in .env.local"
  );
}

export function isOpenCodeAvailable(): boolean {
  return findOpenCodePath() !== null;
}

export function getOpenCodeModel(): string | null {
  const model = process.env.OPENCODE_MODEL?.trim();
  return model ? model : null;
}
