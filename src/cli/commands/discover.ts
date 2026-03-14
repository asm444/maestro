import type { MaestroKernel } from '../../kernel/index.js';
import type { DiscoveryModule } from '../../modules/discovery/index.js';

export async function discoverCommand(kernel: MaestroKernel): Promise<void> {
  const discoveryModule = kernel.getModule<DiscoveryModule>('discovery');
  const result = await discoveryModule.discover(kernel.config.repoRoot);

  console.log('=== Maestro v2 Discovery ===');
  console.log('');

  console.log('Stack:');
  console.log(`  Linguagens: ${result.stack.languages.join(', ') || 'nenhuma'}`);
  console.log(`  Frameworks: ${result.stack.frameworks.join(', ') || 'nenhum'}`);
  console.log(`  Pkg Managers: ${result.stack.package_managers.join(', ') || 'nenhum'}`);
  console.log(`  Build Tools: ${result.stack.build_tools.join(', ') || 'nenhum'}`);
  console.log(`  Test Frameworks: ${result.stack.test_frameworks.join(', ') || 'nenhum'}`);
  console.log(`  CI/CD: ${result.stack.ci_cd.join(', ') || 'nenhum'}`);
  console.log('');

  console.log('Comandos Detectados:');
  const cmds = result.stack.detected_commands;
  for (const [key, val] of Object.entries(cmds)) {
    if (val) console.log(`  ${key}: ${val}`);
  }
  console.log('');

  console.log(`MCPs (${result.mcps.length}):`);
  for (const mcp of result.mcps) {
    console.log(`  ${mcp.name.padEnd(20)} ${mcp.type.padEnd(8)} ${mcp.config_source.padEnd(8)} ${mcp.available ? 'OK' : '--'} tools: ${mcp.tools.length}`);
  }
  console.log('');

  console.log(`Skills (${result.skills.length}):`);
  for (const skill of result.skills) {
    console.log(`  ${skill.name.padEnd(30)} ${skill.description.substring(0, 60)}`);
  }
  console.log('');
}
