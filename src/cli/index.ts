import { MaestroKernel } from '../kernel/index.js';
import { StateModule } from '../modules/state/index.js';
import { PlannerModule } from '../modules/planner/index.js';
import { RouterModule } from '../modules/router/index.js';
import { OrchestratorModule } from '../modules/orchestrator/index.js';
import { DiscoveryModule } from '../modules/discovery/index.js';
import { VerifierModule } from '../modules/verifier/index.js';
import { ReporterModule } from '../modules/reporter/index.js';

import { initCommand } from './commands/init.js';
import { planCommand } from './commands/plan.js';
import { dispatchCommand } from './commands/dispatch.js';
import { verifyCommand } from './commands/verify.js';
import { statusCommand } from './commands/status.js';
import { discoverCommand } from './commands/discover.js';

async function createKernel(repoRoot: string): Promise<MaestroKernel> {
  const kernel = new MaestroKernel(repoRoot);

  kernel.registerModule(new StateModule());
  kernel.registerModule(new DiscoveryModule());
  kernel.registerModule(new RouterModule());
  kernel.registerModule(new PlannerModule());
  kernel.registerModule(new OrchestratorModule());
  kernel.registerModule(new VerifierModule());
  kernel.registerModule(new ReporterModule());

  await kernel.boot();
  return kernel;
}

async function main(): Promise<void> {
  const path = await import('node:path');
  const args = process.argv.slice(2);
  const command = args[0];
  const repoRoot = path.resolve(args[1] || process.cwd());

  if (!command) {
    console.log('Uso: maestro <command> [repoRoot] [args...]');
    console.log('Commands: init, plan, dispatch, verify, status, discover');
    process.exit(1);
  }

  const kernel = await createKernel(repoRoot);

  try {
    switch (command) {
      case 'init':
        await initCommand(kernel);
        break;
      case 'plan':
        await planCommand(kernel, args.slice(2));
        break;
      case 'dispatch':
        await dispatchCommand(kernel, args[2]);
        break;
      case 'verify':
        await verifyCommand(kernel);
        break;
      case 'status':
        await statusCommand(kernel);
        break;
      case 'discover':
        await discoverCommand(kernel);
        break;
      case 'create-template':
        // Legacy compatibility
        await initCommand(kernel, { createTemplate: true });
        break;
      case 'create-dry-run-tickets':
        await planCommand(kernel, ['--template=dry-run']);
        break;
      case 'dry-run-report':
        // Legacy compatibility — report generated via reporter module
        const reporter = kernel.getModule<ReporterModule>('reporter');
        await reporter.generateDryRunReportFromState();
        break;
      default:
        console.error(`Comando desconhecido: ${command}`);
        process.exit(1);
    }
  } finally {
    await kernel.shutdown();
  }
}

main().catch((err: Error) => {
  console.error(`[maestro] Erro: ${err.message}`);
  process.exit(1);
});
