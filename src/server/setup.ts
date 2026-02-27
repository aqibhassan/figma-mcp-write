// src/server/setup.ts
import { createInterface } from "readline/promises";
import { stdin, stdout } from "process";
import { execSync } from "child_process";
import { FigmaApiClient } from "./figma-api.js";
import { saveConfig } from "./config.js";
import { SERVER_VERSION } from "../../shared/protocol.js";

export async function runSetup(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });

  console.log();
  console.log(`  figma-mcp-write v${SERVER_VERSION}`);
  console.log();
  console.log("  Step 1: Figma API Token");
  console.log("  " + "─".repeat(40));
  console.log("  Go to: https://www.figma.com/settings");
  console.log("  → Security → Personal access tokens → Create new token");
  console.log("  → Enable 'file_content:read' scope");
  console.log();

  // Try to open browser
  try {
    const platform = process.platform;
    const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
    execSync(`${cmd} "https://www.figma.com/settings"`, { stdio: "ignore" });
    console.log("  (Opened Figma settings in your browser)");
    console.log();
  } catch {
    // Browser open failed — user can navigate manually
  }

  const token = (await rl.question("  Paste your token: ")).trim();

  if (!token) {
    console.log("\n  No token provided. Aborting setup.");
    rl.close();
    process.exit(1);
  }

  // Verify token
  console.log("  Verifying...");
  const client = new FigmaApiClient(token);
  const user = await client.verifyToken();

  if (!user) {
    console.log("\n  Invalid token. Check that you copied the full token.");
    rl.close();
    process.exit(1);
  }

  console.log(`  Verified — logged in as "${user.handle}" (${user.email})`);

  // Save config
  saveConfig({ token, userName: user.handle, createdAt: new Date().toISOString() });
  console.log("  Token saved to ~/.figma-mcp-write/config.json");

  // Configure Claude Code
  console.log();
  console.log("  Step 2: Claude Code Integration");
  console.log("  " + "─".repeat(40));

  try {
    execSync("claude mcp add figma -- npx figma-mcp-write", { stdio: "ignore" });
    console.log('  Added "figma" MCP server to Claude Code');
  } catch {
    console.log('  Could not auto-configure Claude Code.');
    console.log('  Run manually: claude mcp add figma -- npx figma-mcp-write');
  }

  // Plugin info
  console.log();
  console.log("  Step 3: Figma Plugin (for write access)");
  console.log("  " + "─".repeat(40));
  console.log("  Reads work immediately via REST API.");
  console.log("  For write access, install the Figma plugin:");
  console.log("  → https://www.figma.com/community/plugin/figma-mcp-write");
  console.log("  (Run it in your Figma file via Plugins menu)");
  console.log();
  console.log("  Setup complete! Open Claude Code and start designing.");
  console.log();

  rl.close();
}
