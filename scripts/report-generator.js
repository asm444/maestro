#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { getMaestroDir, readState } = require('./state');

function generateDryRunReport(repoRoot, ticketResults) {
  const reportsDir = path.join(getMaestroDir(repoRoot), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const state = readState(repoRoot);
  const now = new Date().toISOString();
  const allApproved = ticketResults.every(r => r.verdict === 'APPROVED');

  const lines = [
    '# Maestro Dry-Run Report',
    '',
    `**Data**: ${now}`,
    `**Stack detectada**: ${(state.stack || []).join(', ') || 'N/A'}`,
    `**Veredicto Geral**: ${allApproved ? '✅ APPROVED' : '❌ REJECTED'}`,
    '',
    '---',
    '',
    '## Resultados por Ticket',
    '',
  ];

  for (const result of ticketResults) {
    const icon = result.verdict === 'APPROVED' ? '✅' : '❌';
    lines.push(`### ${icon} ${result.ticketId} — ${result.title || ''}`);
    lines.push('');
    lines.push(`**Departamento**: ${result.department || 'N/A'}`);
    lines.push(`**Veredicto**: ${result.verdict}`);
    lines.push('');

    if (result.dodResults && result.dodResults.length > 0) {
      lines.push('**Definition of Done**:');
      for (const dod of result.dodResults) {
        const dodIcon = dod.passed ? '✅' : '❌';
        lines.push(`- ${dodIcon} ${dod.criterion}`);
      }
      lines.push('');
    }

    if (result.commandResults && result.commandResults.length > 0) {
      lines.push('**Comandos de Validação**:');
      for (const cr of result.commandResults) {
        const crIcon = cr.success ? '✅' : '❌';
        lines.push(`- ${crIcon} \`${cr.cmd}\``);
        if (!cr.success && cr.output) {
          lines.push(`  - Erro: \`${cr.output.slice(0, 200)}\``);
        }
      }
      lines.push('');
    }

    if (result.notes) {
      lines.push(`**Notas**: ${result.notes}`);
      lines.push('');
    }

    if (result.verdict === 'REJECTED' && result.correctionTicket) {
      lines.push(`**Ticket de Correção Gerado**: ${result.correctionTicket}`);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  lines.push('## Resumo');
  lines.push('');
  const approved = ticketResults.filter(r => r.verdict === 'APPROVED').length;
  const rejected = ticketResults.filter(r => r.verdict === 'REJECTED').length;
  lines.push(`- Total: ${ticketResults.length} tickets`);
  lines.push(`- Aprovados: ${approved}`);
  lines.push(`- Rejeitados: ${rejected}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`*Gerado por maestro v${state.version || '0.1.0'}*`);

  const content = lines.join('\n');
  const reportPath = path.join(reportsDir, 'dry_run.md');
  fs.writeFileSync(reportPath, content, 'utf8');

  console.log(`[report] Relatório gerado em ${reportPath}`);
  return { reportPath, content, allApproved };
}

function generateCycleReport(repoRoot, cycleId, ticketResults) {
  const reportsDir = path.join(getMaestroDir(repoRoot), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const now = new Date().toISOString();
  const allApproved = ticketResults.every(r => r.verdict === 'APPROVED');
  const lines = [
    `# Maestro Cycle Report — ${cycleId}`,
    '',
    `**Data**: ${now}`,
    `**Veredicto Geral**: ${allApproved ? '✅ APPROVED' : '❌ REJECTED'}`,
    '',
    '## Tickets',
    '',
  ];

  for (const r of ticketResults) {
    const icon = r.verdict === 'APPROVED' ? '✅' : '❌';
    lines.push(`- ${icon} **${r.ticketId}**: ${r.title || ''} (${r.department || ''})`);
  }

  const content = lines.join('\n');
  const reportPath = path.join(reportsDir, `cycle_${cycleId}.md`);
  fs.writeFileSync(reportPath, content, 'utf8');

  return { reportPath, content, allApproved };
}

module.exports = { generateDryRunReport, generateCycleReport };
