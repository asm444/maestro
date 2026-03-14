import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { MaestroKernel } from '../../kernel/index.js';
import type { StateModule } from '../../modules/state/index.js';
import type { DiscoveryModule } from '../../modules/discovery/index.js';

interface InitOptions {
  createTemplate?: boolean;
}

export async function initCommand(kernel: MaestroKernel, options: InitOptions = {}): Promise<void> {
  const { config } = kernel;
  const stateModule = kernel.getModule<StateModule>('state');
  const discoveryModule = kernel.getModule<DiscoveryModule>('discovery');

  if (options.createTemplate) {
    await createProjectTemplate(config.repoRoot);
  }

  // Create .maestro/ structure
  const dirs = ['tasks', 'reports'];
  for (const dir of dirs) {
    await fs.mkdir(path.join(config.maestroDir, dir), { recursive: true });
  }

  // Run discovery
  const discovery = await discoveryModule.discover(config.repoRoot);

  // Initialize state
  const state = {
    version: '2.0.0',
    status: 'idle' as const,
    stack: discovery.stack,
    tickets: {},
    last_updated: new Date().toISOString(),
  };
  await stateModule.writeState(state);

  // Log decision
  await stateModule.logDecision(
    'INIT',
    `Stack: [${discovery.stack.languages.join(', ')}]. ` +
    `MCPs: ${discovery.mcps.length}. ` +
    `Skills: ${discovery.skills.length}. ` +
    `Commands: ${JSON.stringify(discovery.stack.detected_commands)}`
  );

  // Output
  console.log('=== Maestro v2 Init ===');
  console.log('');
  console.log(`Stack: ${discovery.stack.languages.join(', ')}`);
  console.log(`Frameworks: ${discovery.stack.frameworks.join(', ') || 'nenhum detectado'}`);

  const cmds = discovery.stack.detected_commands;
  console.log(`Build: ${cmds.build || '-'} | Test: ${cmds.test || '-'} | Lint: ${cmds.lint || '-'}`);
  console.log('');

  console.log(`MCPs Detectados (${discovery.mcps.length}):`);
  for (const mcp of discovery.mcps) {
    console.log(`  - ${mcp.name} (${mcp.type}) ${mcp.available ? '✓' : '✗'}`);
  }
  console.log('');

  console.log(`Skills Disponiveis: ${discovery.skills.length}`);
  if (discovery.skills.length > 0) {
    const names = discovery.skills.map(s => s.name).slice(0, 8);
    console.log(`  ${names.join(', ')}${discovery.skills.length > 8 ? ', ...' : ''}`);
  }
  console.log('');
  console.log(`Maestro inicializado em ${config.maestroDir}`);
  console.log('Use /maestro-plan "<objetivo>" para criar um plano.');
}

async function createProjectTemplate(repoRoot: string): Promise<void> {
  const dirs = ['src', 'public', 'test', 'scripts', '.github/workflows'];
  for (const dir of dirs) {
    await fs.mkdir(path.join(repoRoot, dir), { recursive: true });
  }

  // Create minimal package.json if not exists
  const pkgPath = path.join(repoRoot, 'package.json');
  try {
    await fs.access(pkgPath);
  } catch {
    await fs.writeFile(pkgPath, JSON.stringify({
      name: 'maestro-project',
      version: '0.1.0',
      scripts: {
        test: 'node --test test/**/*.test.js',
        lint: 'echo "no linter configured"',
        build: 'echo "no build configured"',
        start: 'node src/server.js',
      },
    }, null, 2));
  }

  // Create .gitignore if not exists
  const gitignorePath = path.join(repoRoot, '.gitignore');
  try {
    await fs.access(gitignorePath);
  } catch {
    await fs.writeFile(gitignorePath, 'node_modules/\n.maestro/\ndist/\n.env\n');
  }
}
