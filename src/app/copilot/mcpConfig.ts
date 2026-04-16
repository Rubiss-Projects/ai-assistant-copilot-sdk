import fs from "fs";
import os from "os";
import path from "path";
import { MCPServerConfig } from "@github/copilot-sdk";

/**
 * Loads and merges MCP server configs from:
 *   1. ~/.config/Code/User/mcp.json  (global; "mcpServers" key)
 *   2. <workingDir>/.vscode/mcp.json (workspace; "servers" key)
 *
 * Workspace entries win on name conflict. The `tools: ["*"]` default is
 * injected when absent. Values matching `${input:xxx}` are resolved from
 * env vars named MCP_INPUT_<XXX> (uppercase, hyphens → underscores).
 * Servers that still contain unresolved `${input:...}` after resolution are
 * dropped and logged so the bot starts cleanly without crashing.
 */
export class McpConfigLoader {
  private static readonly GLOBAL_PATH =
    process.env.MCP_CONFIG_PATH ??
    path.join(os.homedir(), ".config", "Code", "User", "mcp.json");

  static load(workingDir?: string): Record<string, MCPServerConfig> {
    const global = this.readFile(this.GLOBAL_PATH, "mcpServers");
    const workspace = workingDir
      ? this.readFile(path.join(workingDir, ".vscode", "mcp.json"), "servers")
      : {};
    const merged = { ...global, ...workspace };
    return this.resolveAndFilter(merged);
  }

  private static readFile(
    filePath: string,
    key: string
  ): Record<string, unknown> {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      const servers = parsed[key];
      if (servers && typeof servers === "object" && !Array.isArray(servers)) {
        return servers as Record<string, unknown>;
      }
    } catch {
      // Missing or malformed — silently skip
    }
    return {};
  }

  private static resolveAndFilter(
    raw: Record<string, unknown>
  ): Record<string, MCPServerConfig> {
    const result: Record<string, MCPServerConfig> = {};
    for (const [name, cfg] of Object.entries(raw)) {
      try {
        const resolved = this.resolveInputs(JSON.stringify(cfg));
        if (resolved === null) {
          console.warn(`[McpConfigLoader] Skipping "${name}": unresolved \${input:...} values`);
          continue;
        }
        const server = JSON.parse(resolved) as Record<string, unknown>;
        if (!Array.isArray(server["tools"])) server["tools"] = ["*"];
        result[name] = server as unknown as MCPServerConfig;
      } catch {
        console.warn(`[McpConfigLoader] Skipping "${name}": invalid config`);
      }
    }
    return result;
  }

  /** Returns null if any ${input:xxx} remain after env resolution. */
  private static resolveInputs(json: string): string | null {
    const resolved = json.replace(/\$\{input:([\w-]+)\}/g, (match, id: string) => {
      const envKey = "MCP_INPUT_" + id.toUpperCase().replace(/[^A-Z0-9]/g, "_");
      return process.env[envKey] ?? match;
    });
    return /\$\{input:[\w-]+\}/.test(resolved) ? null : resolved;
  }

  /** Returns per-server status including whether it was skipped. */
  static status(workingDir?: string): { name: string; source: string; enabled: boolean }[] {
    const globalRaw = this.readFile(this.GLOBAL_PATH, "mcpServers");
    const workspaceRaw = workingDir
      ? this.readFile(path.join(workingDir, ".vscode", "mcp.json"), "servers")
      : {};
    const merged = { ...globalRaw, ...workspaceRaw };

    return Object.keys(merged).map((name) => {
      const source = name in workspaceRaw ? "workspace" : "global";
      const resolved = this.resolveInputs(JSON.stringify(merged[name]));
      return { name, source, enabled: resolved !== null };
    });
  }
}
