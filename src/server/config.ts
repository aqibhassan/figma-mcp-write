import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";

export interface Config {
  token: string;
  userName: string;
  createdAt: string;
}

export const DEFAULT_CONFIG_DIR = join(homedir(), ".figma-mcp-write");
export const DEFAULT_CONFIG_PATH = join(DEFAULT_CONFIG_DIR, "config.json");

export function loadConfig(configPath: string = DEFAULT_CONFIG_PATH): Config | null {
  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === "string") {
      return parsed as Config;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveConfig(config: Config, configPath: string = DEFAULT_CONFIG_PATH): void {
  const dir = dirname(configPath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export interface TokenSources {
  cliToken?: string;
  envToken?: string;
  configPath?: string;
}

export function resolveToken(sources: TokenSources = {}): string | null {
  if (sources.cliToken) return sources.cliToken;
  if (sources.envToken) return sources.envToken;
  const config = loadConfig(sources.configPath ?? DEFAULT_CONFIG_PATH);
  return config?.token ?? null;
}
