import type {
  MaestroModule,
  Kernel,
  Ticket,
  MaestroPlan,
  CycleReport,
  TicketReport,
  DodResult,
  SubagentResponse,
} from '../../kernel/index.js';
import { EVENTS as EV } from '../../kernel/index.js';
import { Scheduler } from './scheduler.js';
import { Dispatcher } from './dispatcher.js';
import { RetryEngine } from './retry-engine.js';
import { ConflictResolver } from './conflict-resolver.js';

// Forward-declare minimal interface for the modules we depend on
interface StateModule extends MaestroModule {
  updateTicketStatus(id: string, status: Ticket['status']): Promise<void>;
  persistTicket(ticket: Ticket): Promise<void>;
}

// ============================================================
// OrchestratorModule — full dispatch/retry/escalate cycle
// ============================================================

export class OrchestratorModule implements MaestroModule {
  readonly name = 'orchestrator';
  readonly version = '2.0.0';
  readonly dependencies = ['state', 'discovery', 'router'];

  private kernel!: Kernel;
  private scheduler = new Scheduler();
  private dispatcher = new Dispatcher();
  private retryEngine!: RetryEngine;
  private conflictResolver = new ConflictResolver();

  async init(kernel: Kernel): Promise<void> {
    this.kernel = kernel;
    this.retryEngine = new RetryEngine(kernel.config.maxRetries);
  }

  async dispose(): Promise<void> {
    // Nothing to clean up
  }

  // ── Public API ────────────────────────────────────────────────

  /**
   * Executes the full orchestration cycle for a given plan.
   * Emits bus events at each stage and returns a CycleReport.
   */
  async run(plan: MaestroPlan): Promise<CycleReport> {
    const cycleId = `cycle-${Date.now()}`;
    const startedAt = new Date().toISOString();
    const allTickets = this.collectTickets(plan);

    await this.kernel.bus.emit(EV.CYCLE_STARTED, { cycleId, plan });

    const executionPlan = this.scheduler.buildExecutionGraph(allTickets);
    const ticketMap = new Map<string, Ticket>(allTickets.map((t) => [t.id, t]));

    const ticketReports: TicketReport[] = [];
    const allResponses: SubagentResponse[] = [];

    for (const phase of executionPlan.phases) {
      if (phase.mode === 'parallel') {
        const results = await Promise.all(
          phase.tickets.map((t) => this.executeTicket(t, plan, ticketMap)),
        );
        for (const { report, response } of results) {
          ticketReports.push(report);
          if (response) allResponses.push(response);
        }
      } else {
        for (const ticket of phase.tickets) {
          const { report, response } = await this.executeTicket(ticket, plan, ticketMap);
          ticketReports.push(report);
          if (response) allResponses.push(response);
        }
      }
    }

    // Detect and log conflicts across all responses
    const conflicts = this.conflictResolver.detectConflicts(allResponses);
    if (conflicts.length > 0) {
      const resolution = this.conflictResolver.resolveConflicts(conflicts);
      await this.kernel.bus.emit('conflicts:resolved', resolution);
    }

    const completedAt = new Date().toISOString();
    const report = this.buildCycleReport(
      cycleId,
      startedAt,
      completedAt,
      ticketReports,
    );

    await this.kernel.bus.emit(EV.CYCLE_COMPLETED, report);
    return report;
  }

  /**
   * Dispatches a single ticket by ID, reading it from the plan's phase list.
   */
  async dispatchSingle(ticketId: string, plan: MaestroPlan): Promise<TicketReport> {
    const allTickets = this.collectTickets(plan);
    const ticket = allTickets.find((t) => t.id === ticketId);

    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }

    const ticketMap = new Map<string, Ticket>(allTickets.map((t) => [t.id, t]));
    const { report } = await this.executeTicket(ticket, plan, ticketMap);
    return report;
  }

  // ── Private: ticket execution ─────────────────────────────────

  private async executeTicket(
    ticket: Ticket,
    plan: MaestroPlan,
    _ticketMap: Map<string, Ticket>,
  ): Promise<{ report: TicketReport; response: SubagentResponse | null }> {
    const startMs = Date.now();
    ticket.status = 'in_progress';

    await this.kernel.bus.emit(EV.TICKET_DISPATCHED, { ticketId: ticket.id });

    let response: SubagentResponse | null = null;
    let lastError = '';

    while (true) {
      try {
        response = await this.dispatchToSubagent(ticket, plan);
        ticket.status = 'completed';

        await this.kernel.bus.emit(EV.TICKET_COMPLETED, {
          ticketId: ticket.id,
          response,
        });

        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        this.retryEngine.recordError(ticket, lastError);

        if (this.retryEngine.shouldRetry(ticket, lastError)) {
          ticket.status = 'retrying';
          await this.kernel.bus.emit(EV.TICKET_RETRYING, {
            ticketId: ticket.id,
            attempt: ticket.retries,
            error: lastError,
          });

          await this.delay(this.kernel.config.retryDelayMs);
        } else {
          // Escalate
          ticket.status = 'escalated';
          const escalation = this.retryEngine.createEscalationTicket(
            ticket,
            ticket.error_history,
          );

          await this.kernel.bus.emit(EV.TICKET_FAILED, {
            ticketId: ticket.id,
            error: lastError,
          });
          await this.kernel.bus.emit(EV.TICKET_ESCALATED, {
            originalTicketId: ticket.id,
            escalationTicket: escalation,
          });

          break;
        }
      }
    }

    const durationMs = Date.now() - startMs;
    const dod_results = this.evaluateDod(ticket, response);

    const report: TicketReport = {
      id: ticket.id,
      title: ticket.title,
      department: ticket.department,
      status: ticket.status,
      duration_ms: durationMs,
      retries: ticket.retries,
      files_touched: response?.touched_files ?? [],
      errors: ticket.error_history,
      dod_results,
    };

    return { report, response };
  }

  /**
   * Dispatches a ticket to its subagent by building a context capsule
   * and emitting it on the bus. Actual subagent invocation is handled
   * by whatever is listening on 'subagent:invoke'.
   *
   * This design keeps the orchestrator decoupled from the execution layer.
   */
  async buildCapsuleForTicket(ticketId: string): Promise<import('../../kernel/types.js').ContextCapsule | null> {
    const stateModule = this.kernel.getModule<StateModule>('state');
    const ticket = await (stateModule as unknown as { getTicket(id: string): Promise<Ticket | null> }).getTicket(ticketId);
    if (!ticket) return null;
    const discovery = (this.kernel.getModule('discovery') as unknown as { getCachedDiscovery(): import('../../kernel/types.js').DiscoveryResult | null }).getCachedDiscovery?.();
    const defaultDiscovery = { stack: { languages: [], frameworks: [], package_managers: [], build_tools: [], test_frameworks: [], ci_cd: [], detected_commands: {} }, mcps: [], skills: [] };
    return this.dispatcher.buildCapsule(ticket, discovery ?? defaultDiscovery);
  }

  formatCapsuleAsPrompt(capsule: import('../../kernel/types.js').ContextCapsule): string {
    return this.dispatcher.formatCapsuleAsPrompt(capsule);
  }

  private async dispatchToSubagent(
    ticket: Ticket,
    plan: MaestroPlan,
  ): Promise<SubagentResponse> {
    const discovery = plan.discovery;
    const retryCtx =
      ticket.retries > 0
        ? this.retryEngine.buildRetryContext(ticket, this.getLastError(ticket))
        : undefined;

    const capsule = await this.dispatcher.buildCapsule(ticket, discovery, retryCtx);
    const prompt = this.dispatcher.formatCapsuleAsPrompt(capsule);

    // Emit for external runners (CLI, Agent tool, etc.) to pick up
    const responsePayload = await this.kernel.bus.emit('subagent:invoke', {
      ticket,
      capsule,
      prompt,
    });

    // If no external handler returned a response, produce a stub
    // (useful in unit tests and dry-run mode)
    return (responsePayload as SubagentResponse | undefined) ?? this.stubResponse(ticket);
  }

  // ── Private: helpers ──────────────────────────────────────────

  private collectTickets(plan: MaestroPlan): Ticket[] {
    // Tickets are stored in plan.phases[].ticket_ids; actual ticket objects
    // must be loaded from state. If state module is available, use it.
    // Otherwise fall back to an empty list (caller must pre-populate tickets).
    try {
      const stateModule = this.kernel.getModule<StateModule>('state');
      // StateModule is expected to have a getTickets() method in practice;
      // here we use a best-effort cast.
      const tickets: Ticket[] = (stateModule as unknown as { getTickets(): Ticket[] }).getTickets?.() ?? [];
      if (tickets.length > 0) return tickets;
    } catch {
      // state module not loaded — fall through
    }

    // If plan carries inline tickets (not standard, but useful for testing)
    const inline = (plan as unknown as { tickets?: Ticket[] }).tickets;
    if (inline && Array.isArray(inline)) return inline;

    return [];
  }

  private evaluateDod(ticket: Ticket, response: SubagentResponse | null): DodResult[] {
    // Without a QA verifier, we do a best-effort check: a criterion is
    // considered passed if it appears in the patch summary or touched files.
    const evidence = [
      response?.patch_summary ?? '',
      ...(response?.touched_files ?? []),
      ...(response?.command_results?.map((r) => r.stdout + r.stderr) ?? []),
    ]
      .join(' ')
      .toLowerCase();

    return ticket.definition_of_done.map((criterion) => {
      const keywords = criterion.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const passed =
        keywords.length === 0 ||
        keywords.some((kw) => evidence.includes(kw));

      return { criterion, passed, evidence: passed ? 'Found in response' : undefined };
    });
  }

  private getLastError(ticket: Ticket): string {
    if (ticket.error_history.length === 0) return '';
    return ticket.error_history[ticket.error_history.length - 1].message;
  }

  private stubResponse(ticket: Ticket): SubagentResponse {
    return {
      touched_files: ticket.repo_paths,
      patch_summary: `[stub] No external runner handled ticket ${ticket.id}`,
      commands_run: [],
      command_results: [],
      risks: [],
      next_steps: [],
    };
  }

  private buildCycleReport(
    cycleId: string,
    startedAt: string,
    completedAt: string,
    ticketReports: TicketReport[],
  ): CycleReport {
    const completed = ticketReports.filter((r) => r.status === 'completed').length;
    const failed = ticketReports.filter((r) => r.status === 'failed').length;
    const retried = ticketReports.filter((r) => r.retries > 0).length;
    const escalated = ticketReports.filter((r) => r.status === 'escalated').length;
    const allFiles = [...new Set(ticketReports.flatMap((r) => r.files_touched))];
    const durationMs =
      new Date(completedAt).getTime() - new Date(startedAt).getTime();

    let verdict: CycleReport['verdict'];
    if (failed === 0 && escalated === 0) {
      verdict = 'success';
    } else if (completed > 0) {
      verdict = 'partial';
    } else {
      verdict = 'failed';
    }

    return {
      id: cycleId,
      started_at: startedAt,
      completed_at: completedAt,
      tickets: ticketReports,
      metrics: {
        total_tickets: ticketReports.length,
        completed,
        failed,
        retried,
        escalated,
        duration_ms: durationMs,
        files_touched: allFiles.length,
        skills_invoked: [],
        mcps_used: [],
      },
      verdict,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
  }
}
