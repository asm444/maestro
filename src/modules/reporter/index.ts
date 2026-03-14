import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  MaestroModule,
  Kernel,
  CycleReport,
  CycleMetrics,
  TicketReport,
} from '../../kernel/types.js';
import type { StateModule } from '../state/index.js';
import { MetricsCollector } from './metrics-collector.js';
import { MarkdownFormatter } from './formatters/markdown.js';
import { JsonFormatter } from './formatters/json.js';

export class ReporterModule implements MaestroModule {
  readonly name = 'reporter';
  readonly version = '2.0.0';
  readonly dependencies = ['state'];

  private kernel!: Kernel;
  private metricsCollector = new MetricsCollector();
  private markdownFormatter = new MarkdownFormatter();
  private jsonFormatter = new JsonFormatter();
  private cycleHandler: ((payload: unknown) => Promise<void>) | null = null;

  async init(kernel: Kernel): Promise<void> {
    this.kernel = kernel;

    this.cycleHandler = async (payload: unknown) => {
      const report = payload as CycleReport;
      await this.saveReport(report);
    };
    kernel.bus.on('cycle:completed', this.cycleHandler);
  }

  async dispose(): Promise<void> {
    if (this.cycleHandler) {
      this.kernel.bus.off('cycle:completed', this.cycleHandler);
      this.cycleHandler = null;
    }
  }

  async generateReport(
    cycleId: string,
    ticketReports: TicketReport[],
    metrics: CycleMetrics,
    startedAt: string,
  ): Promise<CycleReport> {
    const report: CycleReport = {
      id: cycleId,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      tickets: ticketReports,
      metrics,
      verdict: metrics.failed === 0 ? 'success' : metrics.completed > 0 ? 'partial' : 'failed',
    };

    await this.saveReport(report);
    return report;
  }

  async generateDryRunReport(
    ticketReports: TicketReport[],
    metrics: CycleMetrics,
  ): Promise<CycleReport> {
    const report: CycleReport = {
      id: 'dry-run',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      tickets: ticketReports,
      metrics,
      verdict: (metrics.failed === 0 && metrics.escalated === 0) ? 'success' : 'failed',
    };

    const reportsDir = path.join(this.kernel.config.maestroDir, 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const mdContent = this.markdownFormatter.formatDryRunReport(report);
    await fs.writeFile(path.join(reportsDir, 'dry_run.md'), mdContent);

    const jsonContent = this.jsonFormatter.formatCycleReport(report);
    await fs.writeFile(path.join(reportsDir, 'dry_run.json'), jsonContent);

    await this.metricsCollector.collect(report, this.kernel.config.maestroDir);

    return report;
  }

  async generateDryRunReportFromState(): Promise<void> {
    const stateModule = this.kernel.getModule<StateModule>('state');
    const tickets = await stateModule.listTickets();

    const ticketReports: TicketReport[] = tickets.map(t => ({
      id: t.id,
      title: t.title,
      department: t.department,
      status: t.status,
      duration_ms: 0,
      retries: t.retries,
      files_touched: t.outputs || [],
      errors: t.error_history || [],
      dod_results: (t.definition_of_done || []).map(criterion => ({
        criterion,
        passed: t.status === 'completed',
      })),
    }));

    const completed = ticketReports.filter(t => t.status === 'completed').length;
    const failed = ticketReports.filter(t => t.status === 'failed').length;

    const metrics: CycleMetrics = {
      total_tickets: ticketReports.length,
      completed,
      failed,
      retried: tickets.filter(t => t.retries > 0).length,
      escalated: tickets.filter(t => t.status === 'escalated').length,
      duration_ms: 0,
      files_touched: ticketReports.reduce((sum, t) => sum + t.files_touched.length, 0),
      skills_invoked: [],
      mcps_used: [],
    };

    await this.generateDryRunReport(ticketReports, metrics);
    console.log('Relatorio gerado em .maestro/reports/dry_run.md');
  }

  private sanitizeId(id: string): string {
    return id.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100);
  }

  private async saveReport(report: CycleReport): Promise<void> {
    const reportsDir = path.join(this.kernel.config.maestroDir, 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const safeId = this.sanitizeId(report.id);
    const mdContent = this.markdownFormatter.formatCycleReport(report);
    await fs.writeFile(path.join(reportsDir, `cycle_${safeId}.md`), mdContent);

    const jsonContent = this.jsonFormatter.formatCycleReport(report);
    await fs.writeFile(path.join(reportsDir, `cycle_${safeId}.json`), jsonContent);

    await this.metricsCollector.collect(report, this.kernel.config.maestroDir);
  }

  getMetricsCollector(): MetricsCollector {
    return this.metricsCollector;
  }
}
