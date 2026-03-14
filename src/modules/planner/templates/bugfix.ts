// ============================================================
// Maestro v2 — Bugfix Template
// ============================================================

import type {
  TicketTemplate,
  TemplateContext,
  Ticket,
  Department,
} from '../../../kernel/types.js';
import { DEPARTMENT_SKILLS } from '../../../kernel/types.js';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function baseTicket(overrides: Partial<Ticket> & Pick<Ticket, 'id' | 'title' | 'department'>): Ticket {
  return {
    priority: 'high',
    mode: 'sequential',
    repo_paths: [],
    constraints: [
      'Fix must be minimal — no unrelated changes',
      'Must include test that fails before fix and passes after',
    ],
    definition_of_done: [],
    skills_required: DEPARTMENT_SKILLS[overrides.department],
    tools_allowed: undefined,
    validation_commands: [],
    outputs: [],
    status: 'pending',
    retries: 0,
    error_history: [],
    depends_on: [],
    ...overrides,
  };
}

function routeByContext(context: TemplateContext): Department {
  const { objective, stack, repo_paths } = context;
  const lower = objective.toLowerCase();

  // File paths take priority
  if (repo_paths && repo_paths.length > 0) {
    const joined = repo_paths.join(' ').toLowerCase();
    if (/frontend|component|ui|public|view/.test(joined)) return 'frontend';
    if (/infra|docker|ci|cd|workflow/.test(joined)) return 'infra-devops';
    if (/secret|auth|security|permission/.test(joined)) return 'security';
  }

  // Objective keywords
  if (/frontend|component|ui|view|page|style|css|html/.test(lower)) return 'frontend';
  if (/infra|docker|deploy|ci|pipeline/.test(lower)) return 'infra-devops';
  if (/auth|secret|permission|security|vulnerability/.test(lower)) return 'security';
  if (/network|dns|proxy|tls|ssl|cert/.test(lower)) return 'redes';

  // Stack fallback
  const hasFrontend = stack.frameworks.some((f) =>
    /react|vue|angular|svelte|next|nuxt/i.test(f),
  );
  if (hasFrontend && /render|display|show|click|button|form/.test(lower)) {
    return 'frontend';
  }

  return 'backend';
}

export const bugfixTemplate: TicketTemplate = {
  type: 'bugfix',

  generate(context: TemplateContext): Ticket[] {
    const { objective, stack } = context;
    const fixDept = routeByContext(context);

    // ── 1. Reproduction ticket (qa-verifier) ─────────────────
    const reproId = makeId('BUG-REPRO');
    const reproTicket = baseTicket({
      id: reproId,
      title: `[Bug] Reproduce: ${objective}`,
      department: 'qa-verifier',
      priority: 'high',
      repo_paths: context.repo_paths ?? ['test/', 'tests/'],
      definition_of_done: [
        'Bug reproduced in isolated test case',
        'Failing test written that captures the bug',
        'Root cause identified and documented',
        'Affected files listed',
      ],
      skills_required: DEPARTMENT_SKILLS['qa-verifier'],
      validation_commands: [stack.detected_commands.test ?? 'npm test'],
      outputs: ['Failing test file', 'Root cause analysis'],
      depends_on: [],
    });

    // ── 2. Fix ticket (routed department) ─────────────────────
    const fixId = makeId('BUG-FIX');
    const fixTicket = baseTicket({
      id: fixId,
      title: `[Bug] Fix: ${objective}`,
      department: fixDept,
      priority: 'high',
      repo_paths: context.repo_paths ?? [],
      definition_of_done: [
        'Root cause addressed (not just symptom)',
        'Previously failing test now passes',
        'No existing tests broken',
        'Lint passes',
        'Change is minimal and focused',
      ],
      skills_required: DEPARTMENT_SKILLS[fixDept],
      validation_commands: [
        stack.detected_commands.lint ?? 'npm run lint',
        stack.detected_commands.test ?? 'npm test',
      ],
      outputs: ['Fixed source file(s)', 'Updated tests'],
      depends_on: [reproId],
    });

    // ── 3. Verification ticket (qa-verifier) ─────────────────
    const verifyId = makeId('BUG-VERIFY');
    const verifyTicket = baseTicket({
      id: verifyId,
      title: `[QA] Verify fix: ${objective}`,
      department: 'qa-verifier',
      priority: 'high',
      repo_paths: context.repo_paths ?? ['test/', 'tests/'],
      definition_of_done: [
        'Original reproduction test passes',
        'No regression in related areas',
        'Build succeeds',
        'Verification report generated',
      ],
      skills_required: DEPARTMENT_SKILLS['qa-verifier'],
      validation_commands: [
        stack.detected_commands.test ?? 'npm test',
        stack.detected_commands.build ?? 'npm run build',
      ],
      outputs: ['Verification report', 'Updated test suite'],
      depends_on: [fixId],
    });

    return [reproTicket, fixTicket, verifyTicket];
  },
};

export default bugfixTemplate;
