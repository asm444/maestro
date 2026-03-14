// ============================================================
// Maestro v2 — Refactor Template
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
    priority: 'medium',
    mode: 'sequential',
    repo_paths: [],
    constraints: [
      'No behavior changes — only structural improvements',
      'All existing tests must pass before and after',
      'Refactor in small, reviewable increments',
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

function routeByFiles(context: TemplateContext): Department {
  const { repo_paths, objective } = context;
  const lower = objective.toLowerCase();

  if (repo_paths && repo_paths.length > 0) {
    const joined = repo_paths.join(' ').toLowerCase();
    if (/\.github|dockerfile|docker-compose|infra\//.test(joined)) return 'infra-devops';
    if (/frontend|component|ui|public|view/.test(joined)) return 'frontend';
    if (/secret|auth|security/.test(joined)) return 'security';
    if (/agent|prompt|template|policy|routing/.test(joined)) return 'agentops';
  }

  if (/infra|docker|pipeline|ci/.test(lower)) return 'infra-devops';
  if (/frontend|component|ui|view|css|style/.test(lower)) return 'frontend';
  if (/agent|prompt|policy/.test(lower)) return 'agentops';

  return 'backend';
}

export const refactorTemplate: TicketTemplate = {
  type: 'refactor',

  generate(context: TemplateContext): Ticket[] {
    const { objective, stack } = context;
    const dept = routeByFiles(context);

    // ── 1. Analysis ticket ────────────────────────────────────
    const analysisId = makeId('REF-ANALYSIS');
    const analysisTicket = baseTicket({
      id: analysisId,
      title: `[Refactor] Analyze scope: ${objective}`,
      department: dept,
      priority: 'medium',
      repo_paths: context.repo_paths ?? [],
      definition_of_done: [
        'All files in scope identified',
        'Current structure documented',
        'Target structure defined',
        'Risk areas flagged',
        'Incremental steps outlined',
      ],
      skills_required: [...DEPARTMENT_SKILLS[dept], 'analise-impacto'],
      validation_commands: [stack.detected_commands.lint ?? 'npm run lint'],
      outputs: ['Scope analysis document', 'List of files to change'],
      depends_on: [],
    });

    // ── 2. Implementation ticket ──────────────────────────────
    const implId = makeId('REF-IMPL');
    const implTicket = baseTicket({
      id: implId,
      title: `[Refactor] Implement: ${objective}`,
      department: dept,
      priority: 'medium',
      repo_paths: context.repo_paths ?? [],
      definition_of_done: [
        'Code restructured per analysis plan',
        'No dead code, unused imports, or orphan variables remaining',
        'Lint passes with no new warnings',
        'All tests still pass',
        'Module interfaces unchanged (if public API)',
      ],
      skills_required: [...DEPARTMENT_SKILLS[dept], 'auditoria-codigo'],
      validation_commands: [
        stack.detected_commands.lint ?? 'npm run lint',
        stack.detected_commands.test ?? 'npm test',
      ],
      outputs: ['Refactored source files'],
      depends_on: [analysisId],
    });

    // ── 3. Regression test ticket (qa-verifier) ───────────────
    const regressionId = makeId('REF-REGRESSION');
    const regressionTicket = baseTicket({
      id: regressionId,
      title: `[QA] Regression test: ${objective}`,
      department: 'qa-verifier',
      priority: 'high',
      repo_paths: ['test/', 'tests/'],
      definition_of_done: [
        'Full test suite passes (no regressions)',
        'Build succeeds end-to-end',
        'Performance unchanged or improved',
        'Regression report generated',
      ],
      skills_required: DEPARTMENT_SKILLS['qa-verifier'],
      validation_commands: [
        stack.detected_commands.test ?? 'npm test',
        stack.detected_commands.build ?? 'npm run build',
      ],
      outputs: ['Regression test report'],
      depends_on: [implId],
    });

    return [analysisTicket, implTicket, regressionTicket];
  },
};

export default refactorTemplate;
