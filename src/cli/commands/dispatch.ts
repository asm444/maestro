import type { MaestroKernel } from '../../kernel/index.js';
import type { OrchestratorModule } from '../../modules/orchestrator/index.js';

export async function dispatchCommand(kernel: MaestroKernel, ticketId?: string): Promise<void> {
  if (!ticketId) {
    console.error('Erro: dispatch requer <TICKET_ID>');
    process.exit(1);
  }

  const orchestrator = kernel.getModule<OrchestratorModule>('orchestrator');
  const capsule = await orchestrator.buildCapsuleForTicket(ticketId);

  if (!capsule) {
    console.error(`Ticket ${ticketId} nao encontrado`);
    process.exit(1);
  }

  // Output capsule as Markdown for Claude Code agents
  console.log(orchestrator.formatCapsuleAsPrompt(capsule));
}
