import type { MaestroKernel } from '../../kernel/index.js';
import type { VerifierModule, VerificationResult } from '../../modules/verifier/index.js';

export async function verifyCommand(kernel: MaestroKernel): Promise<void> {
  const verifier = kernel.getModule<VerifierModule>('verifier');
  const result: VerificationResult = await verifier.verifyAll(kernel.config.repoRoot);

  console.log('=== Maestro v2 Verify ===');
  console.log('');

  // Command results summary
  for (const cr of result.command_results) {
    const icon = cr.exit_code === 0 ? 'PASSED' : 'FAILED';
    console.log(`${cr.command.padEnd(40)} ${icon}`);
    if (cr.exit_code !== 0 && cr.stderr) {
      console.log(`  ${cr.stderr.split('\n')[0]}`);
    }
  }

  if (result.command_results.length === 0) {
    console.log('Nenhum comando de validacao detectado na stack.');
  }

  if (result.security_findings.length > 0) {
    console.log('');
    console.log(`Security: ${result.security_findings.length} findings`);
    for (const f of result.security_findings) {
      console.log(`  [${f.severity}] ${f.file}:${f.line} — ${f.pattern}`);
    }
  }

  // DoD results
  if (result.dod_results.length > 0) {
    console.log('');
    console.log('DoD:');
    for (const dod of result.dod_results) {
      const icon = dod.passed ? '[x]' : '[ ]';
      console.log(`  ${icon} ${dod.criterion}`);
    }
  }

  console.log('');
  console.log(`Veredicto: ${result.passed ? 'PASSED' : 'FAILED'}`);
}
