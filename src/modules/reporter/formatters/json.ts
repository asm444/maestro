import type { CycleReport, CycleMetrics } from '../../../kernel/types.js';

export class JsonFormatter {
  formatCycleReport(report: CycleReport): string {
    return JSON.stringify(report, null, 2);
  }

  formatMetrics(metrics: CycleMetrics): string {
    return JSON.stringify(metrics, null, 2);
  }
}
