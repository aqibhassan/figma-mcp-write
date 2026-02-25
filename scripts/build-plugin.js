// scripts/build-plugin.js
import { build } from "esbuild";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

async function buildPlugin() {
  try {
    await build({
      entryPoints: [resolve(root, "plugin/code.ts")],
      bundle: true,
      outfile: resolve(root, "plugin/code.js"),
      format: "iife",
      target: "es2020",
      platform: "browser",
      sourcemap: true,
      minify: process.argv.includes("--minify"),
      define: {
        "process.env.NODE_ENV": JSON.stringify(
          process.argv.includes("--minify") ? "production" : "development"
        ),
      },
    });
    console.log("Plugin built successfully → plugin/code.js");
  } catch (error) {
    console.error("Plugin build failed:", error);
    process.exit(1);
  }
}

buildPlugin();
