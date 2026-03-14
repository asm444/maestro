// ============================================================
// Maestro v2 — QA Runner
// ============================================================

import { spawnSync } from 'child_process';
import type { CommandResult } from '../../kernel/index.js';

export class QaRunner {
  /**
   * Executes an array of validation commands using spawnSync (no shell injection).
   * Each command string is split on whitespace to derive the executable and args.
   * Timeout per command: 120 seconds.
   */
  runValidationCommands(commands: string[], repoRoot: string): CommandResult[] {
    if (commands.length === 0) return [];

    return commands.map((cmd) => {
      const parts = cmd.trim().split(/\s+/).filter((p) => p.length > 0);
      if (parts.length === 0) {
        return {
          command: cmd,
          exit_code: 1,
          stdout: '',
          stderr: 'Empty command string',
        } satisfies CommandResult;
      }

      const [executable, ...args] = parts;

      const result = spawnSync(executable, args, {
        cwd: repoRoot,
        encoding: 'utf-8',
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024, // 10 MB
      });

      const stdout = result.stdout ?? '';
      const stderr = result.stderr ?? '';

      // spawnSync sets status to null on timeout or signal
      let exitCode: number;
      if (result.status !== null && result.status !== undefined) {
        exitCode = result.status;
      } else if (result.error) {
        // ETIMEDOUT or ENOENT → treat as failure
        exitCode = 1;
        const errMsg = result.error.message ?? String(result.error);
        return {
          command: cmd,
          exit_code: exitCode,
          stdout,
          stderr: stderr + (stderr ? '\n' : '') + errMsg,
        } satisfies CommandResult;
      } else {
        exitCode = 1;
      }

      return {
        command: cmd,
        exit_code: exitCode,
        stdout,
        stderr,
      } satisfies CommandResult;
    });
  }

  /**
   * Returns true only when every result has exit_code === 0.
   * An empty results array is considered passing (vacuously true).
   */
  allPassed(results: CommandResult[]): boolean {
    if (results.length === 0) return true;
    return results.every((r) => r.exit_code === 0);
  }
}
