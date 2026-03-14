// ============================================================
// Maestro v2 — Definition of Done Checker
// ============================================================

import { existsSync } from 'fs';
import path from 'path';
import type { Ticket, SubagentResponse, DodResult } from '../../kernel/index.js';
import { QaRunner } from './qa-runner.js';

export class DodChecker {
  private runner = new QaRunner();

  /**
   * Evaluates each criterion in ticket.definition_of_done.
   *
   * Strategy per criterion:
   * 1. Check that all expected output files (ticket.outputs) exist on disk.
   * 2. Check that validation_commands pass (exit_code === 0).
   * 3. Check that touched_files covers at least the expected repo_paths.
   *
   * A criterion is considered passed if the relevant checks succeed.
   * Evidence strings are collected to explain the verdict.
   */
  checkDod(
    ticket: Ticket,
    response: SubagentResponse,
    repoRoot: string,
  ): DodResult[] {
    const criteria = ticket.definition_of_done ?? [];
    if (criteria.length === 0) return [];

    // Precompute shared checks once so we don't repeat IO per criterion.
    const outputChecks = this.checkOutputFiles(ticket.outputs, repoRoot);
    const commandChecks = this.checkValidationCommands(ticket.validation_commands, repoRoot);
    const pathCoverage = this.checkPathCoverage(ticket.repo_paths, response.touched_files);

    return criteria.map((criterion) => {
      const evidenceParts: string[] = [];
      let passed = true;

      // --- Output file existence ---
      const missingOutputs = outputChecks.filter((o) => !o.exists);
      if (missingOutputs.length > 0) {
        passed = false;
        evidenceParts.push(
          `Missing output files: ${missingOutputs.map((o) => o.file).join(', ')}`,
        );
      } else if (outputChecks.length > 0) {
        evidenceParts.push(
          `All ${outputChecks.length} output file(s) present`,
        );
      }

      // --- Validation commands ---
      const failedCmds = commandChecks.filter((c) => c.exit_code !== 0);
      if (failedCmds.length > 0) {
        passed = false;
        const summary = failedCmds
          .map((c) => `'${c.command}' (exit ${c.exit_code})`)
          .join(', ');
        evidenceParts.push(`Failing validation commands: ${summary}`);
      } else if (commandChecks.length > 0) {
        evidenceParts.push(
          `All ${commandChecks.length} validation command(s) passed`,
        );
      }

      // --- Path coverage ---
      if (!pathCoverage.covered) {
        // Uncovered paths are a warning rather than a hard failure because
        // a subagent might legitimately touch adjacent files.
        evidenceParts.push(
          `Uncovered repo_paths: ${pathCoverage.uncovered.join(', ')}`,
        );
        // We degrade to failed only when there are repo_paths specified but
        // nothing was touched at all — clear sign of a no-op.
        if (
          ticket.repo_paths.length > 0 &&
          response.touched_files.length === 0
        ) {
          passed = false;
        }
      } else if (ticket.repo_paths.length > 0) {
        evidenceParts.push('All expected repo_paths were touched');
      }

      return {
        criterion,
        passed,
        evidence: evidenceParts.join('; ') || undefined,
      } satisfies DodResult;
    });
  }

  // ── Private helpers ──────────────────────────────────────

  private checkOutputFiles(
    outputs: string[],
    repoRoot: string,
  ): Array<{ file: string; exists: boolean }> {
    return (outputs ?? []).map((file) => ({
      file,
      exists: existsSync(path.join(repoRoot, file)),
    }));
  }

  private checkValidationCommands(
    commands: string[],
    repoRoot: string,
  ): Array<{ command: string; exit_code: number }> {
    if (!commands || commands.length === 0) return [];
    const results = this.runner.runValidationCommands(commands, repoRoot);
    return results.map((r) => ({ command: r.command, exit_code: r.exit_code }));
  }

  private checkPathCoverage(
    expectedPaths: string[],
    touchedFiles: string[],
  ): { covered: boolean; uncovered: string[] } {
    if (!expectedPaths || expectedPaths.length === 0) {
      return { covered: true, uncovered: [] };
    }

    const touchedSet = new Set(touchedFiles ?? []);

    // A repo_path is "covered" when at least one touched file starts with
    // that path prefix (handles both exact matches and directory prefixes).
    const uncovered = expectedPaths.filter((expected) => {
      for (const touched of touchedSet) {
        if (touched === expected || touched.startsWith(expected + '/')) {
          return false;
        }
      }
      return true;
    });

    return { covered: uncovered.length === 0, uncovered };
  }
}
