import type { MaestroKernel } from '../../kernel/index.js';
import type { StateModule } from '../../modules/state/index.js';

export async function statusCommand(kernel: MaestroKernel): Promise<void> {
  const stateModule = kernel.getModule<StateModule>('state');
  const state = await stateModule.readState();

  if (!state) {
    console.log('Maestro nao inicializado. Execute /maestro-init primeiro.');
    return;
  }

  console.log('=== Maestro v2 Status ===');
  console.log('');
  console.log(`Versao: ${state.version}`);
  console.log(`Status: ${state.status}`);
  console.log(`Atualizado: ${state.last_updated}`);

  if (state.stack) {
    console.log(`Stack: ${state.stack.languages.join(', ')}`);
  }

  const tickets = await stateModule.listTickets();
  if (tickets.length > 0) {
    console.log('');
    console.log(`Tickets (${tickets.length}):`);
    for (const ticket of tickets) {
      console.log(`  ${ticket.id.padEnd(12)} ${ticket.status.padEnd(12)} ${ticket.department.padEnd(14)} ${ticket.title}`);
    }
  }

  console.log('');
}
