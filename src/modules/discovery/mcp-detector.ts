import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { McpInfo } from '../../kernel/index.js';

// ============================================================
// McpDetector — finds configured MCP servers from project and
// global Claude settings files
// ============================================================

// Raw shapes from settings files (flexible — fields may be missing)
interface RawMcpServer {
  type?: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  tools?: string[];
}

interface RawMcpJson {
  mcpServers?: Record<string, RawMcpServer>;
}

interface RawClaudeSettings {
  mcpServers?: Record<string, RawMcpServer>;
}

export class McpDetector {
  /**
   * Reads MCP configuration from:
   *   1. `<repoRoot>/.mcp.json`  (project-level)
   *   2. `~/.claude/settings.json`  (global)
   *
   * Both sources are merged; project-level entries take precedence on
   * name collision. Returns an empty array if neither file exists.
   */
  async detect(repoRoot: string): Promise<McpInfo[]> {
    const [projectServers, globalServers] = await Promise.all([
      this.readProjectMcp(repoRoot),
      this.readGlobalMcp(),
    ]);

    // Merge: project overrides global on name collision
    const merged = new Map<string, { server: RawMcpServer; source: McpInfo['config_source'] }>();

    for (const [name, server] of Object.entries(globalServers)) {
      merged.set(name, { server, source: 'global' });
    }
    for (const [name, server] of Object.entries(projectServers)) {
      merged.set(name, { server, source: 'project' });
    }

    const results: McpInfo[] = [];
    for (const [name, { server, source }] of merged.entries()) {
      results.push(this.normalise(name, server, source));
    }

    return results;
  }

  // ── Private helpers ─────────────────────────────────────────

  private async readProjectMcp(
    repoRoot: string,
  ): Promise<Record<string, RawMcpServer>> {
    try {
      const raw = await readFile(join(repoRoot, '.mcp.json'), 'utf-8');
      const parsed = JSON.parse(raw) as RawMcpJson;
      return parsed.mcpServers ?? {};
    } catch {
      return {};
    }
  }

  private async readGlobalMcp(): Promise<Record<string, RawMcpServer>> {
    try {
      const settingsPath = join(homedir(), '.claude', 'settings.json');
      const raw = await readFile(settingsPath, 'utf-8');
      const parsed = JSON.parse(raw) as RawClaudeSettings;
      return parsed.mcpServers ?? {};
    } catch {
      return {};
    }
  }

  private normalise(
    name: string,
    server: RawMcpServer,
    source: McpInfo['config_source'],
  ): McpInfo {
    let type: McpInfo['type'] = 'stdio';

    if (server.type) {
      const t = server.type.toLowerCase();
      if (t === 'sse' || t === 'http' || t === 'websocket' || t === 'stdio') {
        type = t as McpInfo['type'];
      } else if (server.url) {
        // Infer from URL scheme when type is non-standard
        type = server.url.startsWith('ws') ? 'websocket' : 'http';
      }
    } else if (server.url) {
      type = server.url.startsWith('ws') ? 'websocket' : 'http';
    }

    return {
      name,
      type,
      // tools may be pre-declared in config; otherwise empty (discovered at runtime)
      tools: Array.isArray(server.tools) ? server.tools : [],
      available: true, // config exists → assume available; runtime check is elsewhere
      config_source: source,
    };
  }
}
