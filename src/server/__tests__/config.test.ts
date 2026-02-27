import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, saveConfig, resolveToken, type Config } from "../config.js";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "figma-mcp-test-" + Date.now());
const TEST_CONFIG_PATH = join(TEST_DIR, "config.json");

describe("Config", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  describe("saveConfig / loadConfig", () => {
    it("should save and load config", () => {
      const config: Config = { token: "figd_test123", userName: "Test", createdAt: "2026-02-27" };
      saveConfig(config, TEST_CONFIG_PATH);
      const loaded = loadConfig(TEST_CONFIG_PATH);
      expect(loaded).toEqual(config);
    });

    it("should return null if config file does not exist", () => {
      const loaded = loadConfig(join(TEST_DIR, "nonexistent.json"));
      expect(loaded).toBeNull();
    });

    it("should return null if config file is invalid JSON", () => {
      writeFileSync(TEST_CONFIG_PATH, "not json");
      const loaded = loadConfig(TEST_CONFIG_PATH);
      expect(loaded).toBeNull();
    });
  });

  describe("resolveToken", () => {
    it("should prefer CLI arg over env and config", () => {
      const token = resolveToken({ cliToken: "cli_token", envToken: "env_token", configPath: TEST_CONFIG_PATH });
      expect(token).toBe("cli_token");
    });

    it("should use env if no CLI arg", () => {
      const token = resolveToken({ envToken: "env_token", configPath: TEST_CONFIG_PATH });
      expect(token).toBe("env_token");
    });

    it("should use config file if no CLI or env", () => {
      saveConfig({ token: "file_token", userName: "Test", createdAt: "2026-02-27" }, TEST_CONFIG_PATH);
      const token = resolveToken({ configPath: TEST_CONFIG_PATH });
      expect(token).toBe("file_token");
    });

    it("should return null if nothing available", () => {
      const token = resolveToken({ configPath: join(TEST_DIR, "no.json") });
      expect(token).toBeNull();
    });
  });
});
