import type { Ticket } from '../../kernel/index.js';

// ============================================================
// Scheduler — builds phased execution graph from ticket list
// ============================================================

export interface ExecutionPhase {
  mode: 'sequential' | 'parallel';
  tickets: Ticket[];
}

export interface ExecutionPlan {
  phases: ExecutionPhase[];
}

export class Scheduler {
  /**
   * Builds a phased execution plan from a flat list of tickets.
   *
   * Rules:
   *  1. A ticket is "parallel-eligible" when mode === 'parallel' AND it has no
   *     unresolved depends_on entries pointing to tickets in the same batch.
   *  2. depends_on creates ordering: all dependencies must be resolved in earlier
   *     phases before the dependent ticket can be scheduled.
   *  3. Sequential tickets each get their own single-ticket phase so they run
   *     one-at-a-time in priority order (high → medium → low, then insertion order).
   *
   * Algorithm: topological-sort-like multi-pass.
   *   - resolved = set of ticket IDs already placed in a phase
   *   - each iteration collects tickets whose every dependency is resolved
   *   - those tickets are grouped into one phase (parallel buckets together,
   *     each sequential ticket in its own phase)
   *   - repeat until no tickets remain (cycle detection included)
   */
  buildExecutionGraph(tickets: Ticket[]): ExecutionPlan {
    if (tickets.length === 0) {
      return { phases: [] };
    }

    const phases: ExecutionPhase[] = [];
    const resolved = new Set<string>();
    const ticketMap = new Map<string, Ticket>(tickets.map((t) => [t.id, t]));
    const remaining = new Set<string>(tickets.map((t) => t.id));

    // Sort once for deterministic priority ordering within each phase
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const sorted = [...tickets].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    );

    let iterations = 0;
    const maxIterations = tickets.length + 1; // guard against cycles

    while (remaining.size > 0) {
      if (iterations++ > maxIterations) {
        // Cycle detected — place remaining tickets in a final sequential phase
        const stuck = sorted.filter((t) => remaining.has(t.id));
        for (const ticket of stuck) {
          phases.push({ mode: 'sequential', tickets: [ticket] });
          remaining.delete(ticket.id);
          resolved.add(ticket.id);
        }
        break;
      }

      // Collect tickets that are ready (all dependencies resolved)
      const ready = sorted.filter((t) => {
        if (!remaining.has(t.id)) return false;
        const deps = t.depends_on ?? [];
        return deps.every((dep) => resolved.has(dep) || !ticketMap.has(dep));
      });

      if (ready.length === 0) break; // nothing progressed — cycle, handled next iteration

      // Split ready tickets into parallel and sequential groups
      const parallelReady = ready.filter((t) => t.mode === 'parallel');
      const sequentialReady = ready.filter((t) => t.mode === 'sequential');

      // All parallel-ready tickets form a single concurrent phase
      if (parallelReady.length > 0) {
        phases.push({ mode: 'parallel', tickets: parallelReady });
        for (const t of parallelReady) {
          resolved.add(t.id);
          remaining.delete(t.id);
        }
      }

      // Each sequential ticket gets its own ordered phase
      for (const ticket of sequentialReady) {
        phases.push({ mode: 'sequential', tickets: [ticket] });
        resolved.add(ticket.id);
        remaining.delete(ticket.id);
      }
    }

    return { phases };
  }
}
