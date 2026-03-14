import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { CycleMetrics, CycleReport } from '../../kernel/types.js';

export class MetricsCollector {
  startTimer(): { stop(): number } {
    const start = Date.now();
    return {
      stop(): number {
        return Date.now() - start;
      },
    };
  }

  async collect(report: CycleReport, maestroDir: string): Promise<void> {
    const metricsPath = path.join(maestroDir, 'metrics.json');
    const history = await this.getHistory(maestroDir);
    history.push(report.metrics);
    await fs.writeFile(metricsPath, JSON.stringify(history, null, 2));
  }

  async getHistory(maestroDir: string): Promise<CycleMetrics[]> {
    const metricsPath = path.join(maestroDir, 'metrics.json');
    try {
      const content = await fs.readFile(metricsPath, 'utf-8');
      return JSON.parse(content) as CycleMetrics[];
    } catch {
      return [];
    }
  }

  aggregate(metrics: CycleMetrics[]): {
    avg_duration: number;
    success_rate: number;
    total_files: number;
    total_cycles: number;
  } {
    if (metrics.length === 0) {
      return { avg_duration: 0, success_rate: 0, total_files: 0, total_cycles: 0 };
    }

    const totalDuration = metrics.reduce((sum, m) => sum + m.duration_ms, 0);
    const totalCompleted = metrics.reduce((sum, m) => sum + m.completed, 0);
    const totalTickets = metrics.reduce((sum, m) => sum + m.total_tickets, 0);
    const totalFiles = metrics.reduce((sum, m) => sum + m.files_touched, 0);

    return {
      avg_duration: Math.round(totalDuration / metrics.length),
      success_rate: totalTickets > 0 ? Math.round((totalCompleted / totalTickets) * 100) : 0,
      total_files: totalFiles,
      total_cycles: metrics.length,
    };
  }
}
