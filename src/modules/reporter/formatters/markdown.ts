import type { CycleReport, TicketReport } from '../../../kernel/types.js';

export class MarkdownFormatter {
  formatCycleReport(report: CycleReport): string {
    const lines: string[] = [];

    lines.push(`# Maestro v2 — Cycle Report`);
    lines.push('');
    lines.push(`- **Cycle ID**: ${report.id}`);
    lines.push(`- **Started**: ${report.started_at}`);
    lines.push(`- **Completed**: ${report.completed_at}`);
    lines.push(`- **Verdict**: ${report.verdict.toUpperCase()}`);
    lines.push('');

    // Summary
    const m = report.metrics;
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|---|---|`);
    lines.push(`| Total tickets | ${m.total_tickets} |`);
    lines.push(`| Completed | ${m.completed} |`);
    lines.push(`| Failed | ${m.failed} |`);
    lines.push(`| Retried | ${m.retried} |`);
    lines.push(`| Escalated | ${m.escalated} |`);
    lines.push(`| Duration | ${(m.duration_ms / 1000).toFixed(1)}s |`);
    lines.push(`| Files touched | ${m.files_touched} |`);
    lines.push('');

    if (m.skills_invoked.length > 0) {
      lines.push(`**Skills invoked**: ${m.skills_invoked.join(', ')}`);
    }
    if (m.mcps_used.length > 0) {
      lines.push(`**MCPs used**: ${m.mcps_used.join(', ')}`);
    }
    lines.push('');

    // Per-ticket
    lines.push('## Tickets');
    lines.push('');
    for (const ticket of report.tickets) {
      lines.push(this.formatTicketReport(ticket));
    }

    return lines.join('\n');
  }

  formatDryRunReport(report: CycleReport): string {
    const lines: string[] = [];

    lines.push('# Maestro v2 — Dry-Run Report');
    lines.push('');
    lines.push(`**Date**: ${report.started_at}`);
    lines.push(`**Verdict**: ${report.verdict === 'success' ? 'APPROVED' : 'REJECTED'}`);
    lines.push('');

    lines.push('## Results');
    lines.push('');
    lines.push('| Ticket | Department | Status | Duration |');
    lines.push('|---|---|---|---|');
    for (const t of report.tickets) {
      const icon = t.status === 'completed' ? 'PASSED' : 'FAILED';
      lines.push(`| ${t.id} | ${t.department} | ${icon} | ${(t.duration_ms / 1000).toFixed(1)}s |`);
    }
    lines.push('');

    // DoD Checklist
    lines.push('## Definition of Done');
    lines.push('');
    for (const t of report.tickets) {
      lines.push(`### ${t.id}: ${t.title}`);
      for (const dod of t.dod_results) {
        const icon = dod.passed ? '[x]' : '[ ]';
        lines.push(`- ${icon} ${dod.criterion}`);
        if (dod.evidence) {
          lines.push(`  - Evidence: ${dod.evidence}`);
        }
      }
      if (t.errors.length > 0) {
        lines.push(`- Errors: ${t.errors.map(e => e.message).join('; ')}`);
      }
      lines.push('');
    }

    // Metrics
    const m = report.metrics;
    lines.push('## Metrics');
    lines.push('');
    lines.push(`- Total duration: ${(m.duration_ms / 1000).toFixed(1)}s`);
    lines.push(`- Files touched: ${m.files_touched}`);
    lines.push(`- Retries: ${m.retried}`);
    lines.push(`- Escalations: ${m.escalated}`);
    lines.push('');

    return lines.join('\n');
  }

  private formatTicketReport(ticket: TicketReport): string {
    const lines: string[] = [];
    const icon = ticket.status === 'completed' ? 'PASSED' : 'FAILED';

    lines.push(`### ${ticket.id}: ${ticket.title} — ${icon}`);
    lines.push('');
    lines.push(`- Department: ${ticket.department}`);
    lines.push(`- Duration: ${(ticket.duration_ms / 1000).toFixed(1)}s`);
    lines.push(`- Retries: ${ticket.retries}`);
    lines.push(`- Files: ${ticket.files_touched.join(', ') || 'none'}`);
    lines.push('');

    if (ticket.dod_results.length > 0) {
      lines.push('**DoD**:');
      for (const dod of ticket.dod_results) {
        const check = dod.passed ? '[x]' : '[ ]';
        lines.push(`- ${check} ${dod.criterion}`);
      }
      lines.push('');
    }

    if (ticket.errors.length > 0) {
      lines.push('**Errors**:');
      for (const err of ticket.errors) {
        lines.push(`- [${err.error_type}] ${err.message}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
