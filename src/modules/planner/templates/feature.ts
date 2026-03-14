// ============================================================
// Maestro v2 — Feature Template
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
    constraints: ['No external libs without approval', 'Follow existing patterns'],
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

function detectBackend(stack: TemplateContext['stack']): boolean {
  return (
    stack.frameworks.some((f) =>
      /express|fastify|nestjs|django|flask|rails|spring|gin|echo|fiber/i.test(f),
    ) ||
    stack.languages.some((l) => /python|java|go|ruby|rust|php/i.test(l)) ||
    stack.languages.includes('typescript') ||
    stack.languages.includes('javascript')
  );
}

function detectFrontend(stack: TemplateContext['stack']): boolean {
  return stack.frameworks.some((f) =>
    /react|vue|angular|svelte|next|nuxt|remix|solid/i.test(f),
  );
}

function inferRepoPaths(dept: Department, context: TemplateContext): string[] {
  if (context.repo_paths && context.repo_paths.length > 0) return context.repo_paths;
  switch (dept) {
    case 'backend': return ['src/', 'api/', 'backend/'];
    case 'frontend': return ['src/components/', 'frontend/', 'ui/'];
    case 'security': return ['src/', 'config/'];
    case 'qa-verifier': return ['test/', 'tests/'];
    default: return [];
  }
}

export const featureTemplate: TicketTemplate = {
  type: 'feature',

  generate(context: TemplateContext): Ticket[] {
    const { objective, stack } = context;
    const tickets: Ticket[] = [];
    const allIds: string[] = [];

    const hasBackend = detectBackend(stack);
    const hasFrontend = detectFrontend(stack);

    // ── Backend ticket ────────────────────────────────────────
    let backendId: string | undefined;
    if (hasBackend) {
      backendId = makeId('FEAT-BE');
      allIds.push(backendId);
      tickets.push(
        baseTicket({
          id: backendId,
          title: `[Feature] Backend implementation: ${objective}`,
          department: 'backend',
          priority: 'high',
          repo_paths: inferRepoPaths('backend', context),
          definition_of_done: [
            'Implementation matches specification',
            'Unit tests written and passing',
            'No lint errors',
            'API documented if applicable',
          ],
          skills_required: DEPARTMENT_SKILLS['backend'],
          validation_commands: [
            stack.detected_commands.lint ?? 'npm run lint',
            stack.detected_commands.test ?? 'npm test',
          ],
          outputs: ['Implementation files', 'Test files'],
          depends_on: [],
        }),
      );
    }

    // ── Frontend ticket ───────────────────────────────────────
    let frontendId: string | undefined;
    if (hasFrontend) {
      frontendId = makeId('FEAT-FE');
      allIds.push(frontendId);
      const deps = backendId ? [backendId] : [];
      tickets.push(
        baseTicket({
          id: frontendId,
          title: `[Feature] Frontend implementation: ${objective}`,
          department: 'frontend',
          priority: 'high',
          repo_paths: inferRepoPaths('frontend', context),
          definition_of_done: [
            'UI components implemented and functional',
            'Integrates correctly with backend API',
            'Component tests written and passing',
            'Responsive and accessible',
          ],
          skills_required: DEPARTMENT_SKILLS['frontend'],
          validation_commands: [
            stack.detected_commands.lint ?? 'npm run lint',
            stack.detected_commands.test ?? 'npm test',
          ],
          outputs: ['Component files', 'Test files'],
          depends_on: deps,
        }),
      );
    }

    // ── Security review ticket ────────────────────────────────
    const securityId = makeId('FEAT-SEC');
    allIds.push(securityId);
    const secDeps = [backendId, frontendId].filter(Boolean) as string[];
    tickets.push(
      baseTicket({
        id: securityId,
        title: `[Security] Review: ${objective}`,
        department: 'security',
        priority: 'high',
        repo_paths: inferRepoPaths('security', context),
        definition_of_done: [
          'No secrets or credentials in code',
          'Input validation present',
          'Authentication/authorization checked',
          'Dependencies free of known CVEs',
        ],
        skills_required: DEPARTMENT_SKILLS['security'],
        validation_commands: ['git grep -rn "password\\|secret\\|token" src/ || true'],
        outputs: ['Security review report'],
        depends_on: secDeps,
      }),
    );

    // ── QA ticket ─────────────────────────────────────────────
    const qaId = makeId('FEAT-QA');
    tickets.push(
      baseTicket({
        id: qaId,
        title: `[QA] Validate: ${objective}`,
        department: 'qa-verifier',
        priority: 'high',
        repo_paths: inferRepoPaths('qa-verifier', context),
        definition_of_done: [
          'All previous tickets passed',
          'Integration tests pass end-to-end',
          'Definition of done verified for each ticket',
          'Report generated',
        ],
        skills_required: DEPARTMENT_SKILLS['qa-verifier'],
        validation_commands: [
          stack.detected_commands.test ?? 'npm test',
          stack.detected_commands.build ?? 'npm run build',
        ],
        outputs: ['QA validation report'],
        depends_on: [securityId, ...secDeps],
      }),
    );

    return tickets;
  },
};

export default featureTemplate;
