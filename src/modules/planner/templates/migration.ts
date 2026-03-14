// ============================================================
// Maestro v2 — Migration Template
// ============================================================

import type {
  TicketTemplate,
  TemplateContext,
  Ticket,
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
      'Migration must be reversible',
      'No data loss permitted',
      'Rollback plan must be documented before execution',
      'Execute during low-traffic window if applicable',
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

export const migrationTemplate: TicketTemplate = {
  type: 'migration',

  generate(context: TemplateContext): Ticket[] {
    const { objective, stack } = context;

    // ── 1. Backup / preparation ticket (infra-devops) ─────────
    const backupId = makeId('MIG-BACKUP');
    const backupTicket = baseTicket({
      id: backupId,
      title: `[Migration] Backup & prepare: ${objective}`,
      department: 'infra-devops',
      priority: 'high',
      repo_paths: context.repo_paths ?? ['infra/', 'scripts/'],
      definition_of_done: [
        'Full backup created and verified',
        'Backup restoration tested successfully',
        'Rollback procedure documented',
        'Environment variables / config captured',
        'Migration window communicated if applicable',
      ],
      skills_required: [...DEPARTMENT_SKILLS['infra-devops'], 'seguranca-cia'],
      validation_commands: ['echo "Backup verification required — manual step"'],
      outputs: ['Backup archive or snapshot reference', 'Rollback runbook'],
      depends_on: [],
    });

    // ── 2. Migration ticket (backend) ─────────────────────────
    const migId = makeId('MIG-EXEC');
    const migTicket = baseTicket({
      id: migId,
      title: `[Migration] Execute: ${objective}`,
      department: 'backend',
      priority: 'high',
      repo_paths: context.repo_paths ?? ['db/', 'migrations/', 'src/'],
      definition_of_done: [
        'Migration script idempotent (safe to re-run)',
        'Schema/data changes applied successfully',
        'Application still starts and responds',
        'No data corruption detected',
        'Migration logged with timestamp',
      ],
      skills_required: DEPARTMENT_SKILLS['backend'],
      validation_commands: [
        stack.detected_commands.test ?? 'npm test',
        stack.detected_commands.start ? `${stack.detected_commands.start} --dry-run || true` : 'echo "Start command not detected"',
      ],
      outputs: ['Migration script', 'Execution log', 'Post-migration schema snapshot'],
      depends_on: [backupId],
    });

    // ── 3. Verification ticket (qa-verifier) ──────────────────
    const verifyId = makeId('MIG-VERIFY');
    const verifyTicket = baseTicket({
      id: verifyId,
      title: `[QA] Verify migration: ${objective}`,
      department: 'qa-verifier',
      priority: 'high',
      repo_paths: ['test/', 'tests/'],
      definition_of_done: [
        'All integration tests pass post-migration',
        'Data integrity checks pass',
        'Application fully functional',
        'Performance within acceptable range',
        'Verification report generated',
      ],
      skills_required: DEPARTMENT_SKILLS['qa-verifier'],
      validation_commands: [
        stack.detected_commands.test ?? 'npm test',
        stack.detected_commands.build ?? 'npm run build',
      ],
      outputs: ['Post-migration verification report'],
      depends_on: [migId],
    });

    // ── 4. Rollback plan ticket (infra-devops) ────────────────
    const rollbackId = makeId('MIG-ROLLBACK');
    const rollbackTicket = baseTicket({
      id: rollbackId,
      title: `[Infra] Document rollback plan: ${objective}`,
      department: 'infra-devops',
      priority: 'high',
      repo_paths: context.repo_paths ?? ['infra/', 'docs/'],
      constraints: [
        'Rollback must be executable in < 30 minutes',
        'Must not require manual data reconstruction',
        ...baseTicket({ id: '', title: '', department: 'infra-devops' }).constraints,
      ],
      definition_of_done: [
        'Step-by-step rollback procedure written',
        'Rollback script tested in staging if possible',
        'Recovery time objective (RTO) documented',
        'Responsible party and escalation path defined',
      ],
      skills_required: DEPARTMENT_SKILLS['infra-devops'],
      validation_commands: ['echo "Rollback plan review required — manual step"'],
      outputs: ['Rollback runbook', 'Tested rollback script'],
      depends_on: [backupId],
      mode: 'parallel', // Can be done in parallel with migration execution
    });

    return [backupTicket, migTicket, verifyTicket, rollbackTicket];
  },
};

export default migrationTemplate;
