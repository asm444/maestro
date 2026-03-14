import { readFile } from 'fs/promises';
import type {
  Ticket,
  ContextCapsule,
  FileContent,
  DiscoveryResult,
  RetryContext,
  StackInfo,
} from '../../kernel/index.js';

// ============================================================
// Dispatcher — builds context capsules and formats prompts
// ============================================================

export class Dispatcher {
  /**
   * Builds a minimal ContextCapsule for a subagent by reading only the
   * files listed in ticket.repo_paths and assembling the relevant context.
   */
  async buildCapsule(
    ticket: Ticket,
    discoveryResult: DiscoveryResult,
    retryCtx?: RetryContext,
  ): Promise<ContextCapsule> {
    const relevant_files = await this.readFiles(ticket.repo_paths);
    const skills_prompt = this.buildSkillsPrompt(ticket.skills_required);
    const mcp_available = discoveryResult.mcps
      .filter((m) => m.available)
      .map((m) => m.name);

    return {
      ticket,
      relevant_files,
      skills_prompt,
      mcp_available,
      stack_info: discoveryResult.stack,
      retry_context: retryCtx,
    };
  }

  /**
   * Converts a ContextCapsule to a Markdown-formatted prompt string
   * suitable for passing to a subagent.
   */
  formatCapsuleAsPrompt(capsule: ContextCapsule): string {
    const { ticket, relevant_files, skills_prompt, mcp_available, stack_info, retry_context } =
      capsule;

    const lines: string[] = [];

    // ── Header ────────────────────────────────────────────────
    lines.push(`# Ticket ${ticket.id}: ${ticket.title}`);
    lines.push('');
    lines.push(`**Department**: ${ticket.department}`);
    lines.push(`**Priority**: ${ticket.priority}`);
    lines.push(`**Mode**: ${ticket.mode}`);
    lines.push('');

    // ── Stack info ────────────────────────────────────────────
    lines.push('## Stack');
    lines.push(this.formatStackInfo(stack_info));
    lines.push('');

    // ── Skills ────────────────────────────────────────────────
    if (skills_prompt) {
      lines.push('## Required Skills');
      lines.push(skills_prompt);
      lines.push('');
    }

    // ── MCP tools available ───────────────────────────────────
    if (mcp_available.length > 0) {
      lines.push('## Available MCP Tools');
      for (const mcp of mcp_available) {
        lines.push(`- ${mcp}`);
      }
      lines.push('');
    }

    // ── Constraints ───────────────────────────────────────────
    if (ticket.constraints.length > 0) {
      lines.push('## Constraints');
      for (const c of ticket.constraints) {
        lines.push(`- ${c}`);
      }
      lines.push('');
    }

    // ── Definition of Done ────────────────────────────────────
    lines.push('## Definition of Done');
    for (const dod of ticket.definition_of_done) {
      lines.push(`- [ ] ${dod}`);
    }
    lines.push('');

    // ── Validation commands ───────────────────────────────────
    if (ticket.validation_commands.length > 0) {
      lines.push('## Validation Commands');
      lines.push('Run these commands after completing the work:');
      lines.push('```bash');
      for (const cmd of ticket.validation_commands) {
        lines.push(cmd);
      }
      lines.push('```');
      lines.push('');
    }

    // ── Expected outputs ──────────────────────────────────────
    if (ticket.outputs.length > 0) {
      lines.push('## Expected Outputs');
      for (const out of ticket.outputs) {
        lines.push(`- ${out}`);
      }
      lines.push('');
    }

    // ── Relevant files ────────────────────────────────────────
    if (relevant_files.length > 0) {
      lines.push('## Relevant Files');
      for (const file of relevant_files) {
        if (file.exists) {
          lines.push(`### \`${file.path}\``);
          lines.push('```');
          lines.push(file.content);
          lines.push('```');
        } else {
          lines.push(`### \`${file.path}\` *(does not exist yet — create it)*`);
        }
        lines.push('');
      }
    }

    // ── Retry context ─────────────────────────────────────────
    if (retry_context) {
      lines.push('## Retry Context');
      lines.push(`> **Attempt**: ${retry_context.attempt}`);
      lines.push('');
      lines.push('### Previous Error');
      lines.push('```');
      lines.push(retry_context.previous_error);
      lines.push('```');
      lines.push('');
      lines.push('### Error Analysis');
      lines.push(retry_context.analysis);
      lines.push('');
      if (retry_context.enriched_context) {
        lines.push('### Enriched Context');
        lines.push(retry_context.enriched_context);
        lines.push('');
      }
    }

    // ── Response format ───────────────────────────────────────
    lines.push('## Response Format');
    lines.push(
      'Return a JSON object with exactly these fields:',
    );
    lines.push('```json');
    lines.push(
      JSON.stringify(
        {
          touched_files: ['<path>'],
          patch_summary: '<what was done>',
          commands_run: ['<cmd>'],
          command_results: [
            { command: '<cmd>', exit_code: 0, stdout: '', stderr: '' },
          ],
          risks: ['<optional risk>'],
          next_steps: ['<optional next step>'],
        },
        null,
        2,
      ),
    );
    lines.push('```');

    return lines.join('\n');
  }

  // ── Private helpers ───────────────────────────────────────────

  private async readFiles(paths: string[]): Promise<FileContent[]> {
    return Promise.all(
      paths.map(async (p) => {
        try {
          const content = await readFile(p, 'utf-8');
          return { path: p, content, exists: true };
        } catch {
          return { path: p, content: '', exists: false };
        }
      }),
    );
  }

  private buildSkillsPrompt(skills: string[]): string {
    if (skills.length === 0) return '';
    const lines: string[] = [
      'Apply the following skills during implementation:',
      '',
    ];
    for (const skill of skills) {
      lines.push(`- **${skill}**: Use /${skill} methodology when applicable`);
    }
    return lines.join('\n');
  }

  private formatStackInfo(stack: StackInfo): string {
    const lines: string[] = [];
    if (stack.languages.length > 0) {
      lines.push(`- **Languages**: ${stack.languages.join(', ')}`);
    }
    if (stack.frameworks.length > 0) {
      lines.push(`- **Frameworks**: ${stack.frameworks.join(', ')}`);
    }
    if (stack.package_managers.length > 0) {
      lines.push(`- **Package Managers**: ${stack.package_managers.join(', ')}`);
    }
    if (stack.test_frameworks.length > 0) {
      lines.push(`- **Test Frameworks**: ${stack.test_frameworks.join(', ')}`);
    }
    const cmds = stack.detected_commands;
    const cmdEntries = Object.entries(cmds).filter(([, v]) => v != null);
    if (cmdEntries.length > 0) {
      lines.push('- **Commands**:');
      for (const [k, v] of cmdEntries) {
        lines.push(`  - ${k}: \`${v}\``);
      }
    }
    return lines.length > 0 ? lines.join('\n') : '_No stack info available_';
  }
}
