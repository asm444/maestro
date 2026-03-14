import type { SubagentResponse } from '../../kernel/index.js';

// ============================================================
// ConflictResolver — detects and resolves file-write conflicts
// ============================================================

export interface FileConflict {
  path: string;
  /** Indices into the responses array that touched this file */
  agents: number[];
}

export interface ConflictResolution {
  strategy: 'last-writer-wins' | 'manual-review';
  conflicts: FileConflict[];
  /** Map of path → index of winning response */
  winners: Map<string, number>;
  /** Paths flagged for manual review (currently none, reserved for future) */
  flagged: string[];
  report: string;
}

export class ConflictResolver {
  /**
   * Scans all subagent responses for files touched by more than one agent.
   * Returns an array of conflicts (one entry per conflicting path).
   */
  detectConflicts(responses: SubagentResponse[]): FileConflict[] {
    // path → list of response indices that claimed to touch it
    const fileOwners = new Map<string, number[]>();

    for (let i = 0; i < responses.length; i++) {
      for (const path of responses[i].touched_files) {
        const normalised = this.normalisePath(path);
        if (!fileOwners.has(normalised)) {
          fileOwners.set(normalised, []);
        }
        fileOwners.get(normalised)!.push(i);
      }
    }

    const conflicts: FileConflict[] = [];
    for (const [path, agents] of fileOwners.entries()) {
      if (agents.length > 1) {
        conflicts.push({ path, agents });
      }
    }

    return conflicts;
  }

  /**
   * Applies "last-writer-wins" strategy: for each conflict the response with
   * the highest index (latest in the responses array) is declared the winner.
   *
   * All conflicts are flagged in the report so the operator can review them.
   */
  resolveConflicts(conflicts: FileConflict[]): ConflictResolution {
    const winners = new Map<string, number>();
    const flagged: string[] = [];

    for (const conflict of conflicts) {
      // last writer = highest index
      const winner = Math.max(...conflict.agents);
      winners.set(conflict.path, winner);
      flagged.push(conflict.path);
    }

    const report = this.buildReport(conflicts, winners);

    return {
      strategy: 'last-writer-wins',
      conflicts,
      winners,
      flagged,
      report,
    };
  }

  // ── Private helpers ─────────────────────────────────────────

  /**
   * Normalises a path for comparison: strips leading "./" and collapses
   * duplicate separators. Does NOT resolve symlinks (no I/O).
   */
  private normalisePath(p: string): string {
    return p
      .replace(/\\/g, '/')
      .replace(/^\.\//, '')
      .replace(/\/+/g, '/');
  }

  private buildReport(
    conflicts: FileConflict[],
    winners: Map<string, number>,
  ): string {
    if (conflicts.length === 0) {
      return 'No file conflicts detected.';
    }

    const lines: string[] = [
      `## Conflict Resolution Report`,
      '',
      `Strategy: **last-writer-wins**`,
      `Conflicts detected: **${conflicts.length}**`,
      '',
      '| File | Competing Agents | Winner (agent index) |',
      '|------|-----------------|----------------------|',
    ];

    for (const conflict of conflicts) {
      const winner = winners.get(conflict.path) ?? -1;
      lines.push(
        `| \`${conflict.path}\` | ${conflict.agents.join(', ')} | ${winner} |`,
      );
    }

    lines.push('');
    lines.push(
      '> All conflicting files have been flagged for manual review. ' +
      'Verify that the winning response did not accidentally discard ' +
      'valid changes from an earlier agent.',
    );

    return lines.join('\n');
  }
}
