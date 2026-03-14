// ============================================================
// Maestro v2 — Verifier Module
// ============================================================

import * as path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import type {
  MaestroModule,
  Kernel,
  Ticket,
  SubagentResponse,
  DodResult,
  CommandResult,
} from '../../kernel/index.js';
import { EVENTS } from '../../kernel/index.js';
import { QaRunner } from './qa-runner.js';
import { DodChecker } from './dod-checker.js';
import { SecurityScanner, type SecurityFinding } from './security-scan.js';

// ── Local types ──────────────────────────────────────────────

export interface VerificationResult {
  passed: boolean;
  dod_results: DodResult[];
  security_findings: SecurityFinding[];
  command_results: CommandResult[];
}

// ── VerifierModule ───────────────────────────────────────────

export class VerifierModule implements MaestroModule {
  readonly name = 'verifier';
  readonly version = '2.0.0';
  readonly dependencies = ['state'];

  private kernel!: Kernel;
  private runner = new QaRunner();
  private dodChecker = new DodChecker();
  private secScanner = new SecurityScanner();

  async init(kernel: Kernel): Promise<void> {
    this.kernel = kernel;

    // Auto-verify whenever a ticket is completed
    kernel.bus.on(EVENTS.TICKET_COMPLETED, async (payload) => {
      const { ticket, response } = payload as {
        ticket: Ticket;
        response: SubagentResponse;
      };

      if (!ticket || !response) return;

      const repoRoot = kernel.config.repoRoot;
      const result = await this.verify(ticket, response, repoRoot);

      await kernel.bus.emit(
        result.passed ? EVENTS.QA_APPROVED : EVENTS.QA_REJECTED,
        { ticket, result },
      );
    });
  }

  async dispose(): Promise<void> {
    // Nothing to tear down
  }

  // ── Public API ────────────────────────────────────────────

  /**
   * Verifies a single ticket's response:
   * 1. Security scan on touched files
   * 2. DoD check
   * 3. Validation commands
   */
  async verify(
    ticket: Ticket,
    response: SubagentResponse,
    repoRoot: string,
  ): Promise<VerificationResult> {
    // 1 — Security scan: resolve paths relative to repoRoot, with containment check
    const resolvedBase = path.resolve(repoRoot);
    const absolutePaths = (response.touched_files ?? [])
      .map((f) => path.resolve(repoRoot, f))
      .filter((resolved) => resolved.startsWith(resolvedBase + path.sep) || resolved === resolvedBase);
    const securityFindings = this.secScanner.scanFiles(absolutePaths);
    const hasCritical = this.secScanner.hasCriticalFindings(securityFindings);

    // 2 — DoD check
    const dodResults = this.dodChecker.checkDod(ticket, response, repoRoot);
    const dodPassed = dodResults.every((d) => d.passed);

    // 3 — Validation commands from ticket
    const commandResults = this.runner.runValidationCommands(
      ticket.validation_commands ?? [],
      repoRoot,
    );
    const cmdsPassed = this.runner.allPassed(commandResults);

    const passed = !hasCritical && dodPassed && cmdsPassed;

    return { passed, dod_results: dodResults, security_findings: securityFindings, command_results: commandResults };
  }

  /**
   * Runs the full lint/test/build pipeline for the detected stack.
   * Uses detected_commands from the state module's stored stack info.
   */
  async verifyAll(repoRoot: string): Promise<VerificationResult> {
    const commands = await this.resolveStackCommands(repoRoot);

    const commandResults = this.runner.runValidationCommands(commands, repoRoot);
    const passed = this.runner.allPassed(commandResults);

    return {
      passed,
      dod_results: [],
      security_findings: [],
      command_results: commandResults,
    };
  }

  // ── Private helpers ───────────────────────────────────────

  private async resolveStackCommands(repoRoot: string): Promise<string[]> {
    // Try to retrieve stack info from the state module if available
    try {
      const stateModule = this.kernel.getModule('state') as unknown as {
        readState(): Promise<{ stack?: { detected_commands?: Record<string, string | undefined> } }>;
      };

      if (stateModule) {
        const state = await stateModule.readState();
        const cmds = state?.stack?.detected_commands;
        if (cmds) {
          const ordered: string[] = [];
          for (const key of ['lint', 'test', 'build'] as const) {
            const cmd = cmds[key];
            if (cmd) ordered.push(cmd);
          }
          if (ordered.length > 0) return ordered;
        }
      }
    } catch {
      // State module unavailable — fall through to heuristics
    }

    // Heuristic fallback: detect package.json scripts
    return this.detectFallbackCommands(repoRoot);
  }

  private detectFallbackCommands(repoRoot: string): string[] {
    const pkgPath = path.join(repoRoot, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
          scripts?: Record<string, string>;
        };
        const scripts = pkg.scripts ?? {};
        const cmds: string[] = [];
        if (scripts['lint']) cmds.push('npm run lint');
        if (scripts['test']) cmds.push('npm test');
        if (scripts['build']) cmds.push('npm run build');
        if (cmds.length > 0) return cmds;
      } catch {
        // Ignore parse errors
      }
    }

    return [];
  }
}

export default VerifierModule;
export { SecurityFinding };
