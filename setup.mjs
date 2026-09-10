#!/usr/bin/env node
/**
 * Fills mcp.json with real paths for your machine.
 *
 *   node setup.mjs
 *
 * Creates mcp.ready.json — merge those servers into your MCP client config.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const home = os.homedir();
const toPosix = (p) => p.split(path.sep).join("/");
const dataRoot = toPosix(path.join(home, ".browser-image-mcp"));

const config = {
  mcpServers: {
    "chatgpt-image": {
      command: "node",
      args: [toPosix(path.join(repoRoot, "chatgpt-image-mcp", "index.mjs"))],
      env: {
        IMAGE_OUTPUT_DIR: `${dataRoot}/chatgpt-image-output`,
        CHATGPT_PROFILE_DIR: `${dataRoot}/chatgpt-browser-profile`,
        CHATGPT_HEADLESS: "false",
      },
    },
    "gemini-image": {
      command: "node",
      args: [toPosix(path.join(repoRoot, "gemini-image-mcp", "index.mjs"))],
      env: {
        IMAGE_OUTPUT_DIR: `${dataRoot}/gemini-image-output`,
        GEMINI_PROFILE_DIR: `${dataRoot}/gemini-browser-profile`,
        GEMINI_HEADLESS: "false",
      },
    },
  },
};

const outFile = path.join(repoRoot, "mcp.ready.json");
fs.writeFileSync(outFile, JSON.stringify(config, null, 2) + "\n", "utf8");

console.log("Done. Wrote mcp.ready.json with YOUR paths.\n");
console.log("Repo:  " + toPosix(repoRoot));
console.log("Data:  " + dataRoot);
console.log("\nPaste the servers from mcp.ready.json into your MCP client:\n");
console.log("  Cursor          ~/.cursor/mcp.json");
console.log("  Claude Desktop  ~/Library/Application Support/Claude/claude_desktop_config.json");
console.log("                  (Windows: %APPDATA%\\\\Claude\\\\claude_desktop_config.json)");
console.log("  Claude Code     claude mcp add ...  (use paths/env from mcp.ready.json)");
console.log("  VS Code         .vscode/mcp.json or MCP settings UI");
console.log("  Windsurf        ~/.codeium/windsurf/mcp_config.json");
console.log("  Codex           ~/.codex/config.toml  (convert JSON → TOML; see README)");
console.log("  Cline / other   same command + args + env block\n");
console.log("Then reload/restart that client and run check_session to log in once.");
console.log("\nManual edit tip — in mcp.json replace:");
console.log("  C:/FULL/PATH/TO/THIS/REPO  →  " + toPosix(repoRoot));
console.log("  C:/FULL/PATH/TO/HOME       →  " + toPosix(home));
