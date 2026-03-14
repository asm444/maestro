import type { MaestroKernel } from '../../kernel/index.js';
import type { PlannerModule } from '../../modules/planner/index.js';
import type { StateModule } from '../../modules/state/index.js';
import type { TemplateType } from '../../kernel/types.js';

export async function planCommand(kernel: MaestroKernel, args: string[]): Promise<void> {
  const planner = kernel.getModule<PlannerModule>('planner');
  const stateModule = kernel.getModule<StateModule>('state');

  let templateType: TemplateType | undefined;
  let objective = '';

  for (const arg of args) {
    if (arg.startsWith('--template=')) {
      templateType = arg.split('=')[1] as TemplateType;
    } else {
      objective = arg;
    }
  }

  if (!templateType && !objective) {
    templateType = 'dry-run';
  }

  if (!objective && templateType === 'dry-run') {
    objective = 'Validacao end-to-end do Maestro com 5 tickets obrigatorios';
  }

  const plan = await planner.plan(objective, templateType);

  // Save plan
  await stateModule.logDecision(
    'PLAN',
    `Criados ${plan.phases.reduce((sum, p) => sum + p.ticket_ids.length, 0)} tickets. ` +
    `Template: ${templateType || 'auto'}. Objetivo: ${objective}`
  );

  // Output
  console.log('=== Maestro v2 Plan ===');
  console.log('');
  console.log(`Objetivo: ${objective}`);
  console.log(`Template: ${templateType || 'auto-detected'}`);
  console.log('');

  for (const phase of plan.phases) {
    console.log(`${phase.name} (${phase.mode}):`);
    for (const ticketId of phase.ticket_ids) {
      console.log(`  - ${ticketId}`);
    }
  }

  console.log('');
  console.log('Tickets salvos em .maestro/tasks/');
  console.log('Execute /maestro-run para iniciar.');
}
