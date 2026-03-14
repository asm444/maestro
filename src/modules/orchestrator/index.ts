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
  saveTicket(ticket: Ticket): Promise<void>;
  listTickets(): Promise<Ticket[]>;
  getTicket(id: string): Promise<Ticket | null>;
}

interface DiscoveryModuleRef extends MaestroModule {
  getCached(): import('../../kernel/types.js').DiscoveryResult | null;
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
    const allTickets = await this.collectTickets(plan);

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
    const allTickets = await this.collectTickets(plan);
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
    const stateModule = this.kernel.getModule<StateModule>('state');
    const MAX_LOOP = (this.kernel.config.maxRetries || 2) + 2;
    let loopCount = 0;

    ticket.status = 'in_progress';
    await stateModule.saveTicket(ticket);
    await this.kernel.bus.emit(EV.TICKET_DISPATCHED, { ticketId: ticket.id });

    let response: SubagentResponse | null = null;
    let lastError = '';

    while (loopCount++ < MAX_LOOP) {
      try {
        response = await this.dispatchToSubagent(ticket, plan);
        ticket.status = 'completed';
        await stateModule.saveTicket(ticket);

        await this.kernel.bus.emit(EV.TICKET_COMPLETED, {
          ticket,
          response,
        });

        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        this.retryEngine.recordError(ticket, lastError);

        if (this.retryEngine.shouldRetry(ticket, lastError)) {
          ticket.status = 'retrying';
          await stateModule.saveTicket(ticket);
          await this.kernel.bus.emit(EV.TICKET_RETRYING, {
            ticketId: ticket.id,
            attempt: ticket.retries,
            error: lastError,
          });

          await this.delay(this.kernel.config.retryDelayMs);
        } else {
          ticket.status = 'escalated';
          await stateModule.saveTicket(ticket);
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
    const ticket = await stateModule.getTicket(ticketId);
    if (!ticket) return null;
    const discoveryModule = this.kernel.getModule<DiscoveryModuleRef>('discovery');
    const discovery = discoveryModule.getCached();
    const defaultDiscovery: import('../../kernel/types.js').DiscoveryResult = {
      stack: { languages: [], frameworks: [], package_managers: [], build_tools: [], test_frameworks: [], ci_cd: [], detected_commands: {} },
      mcps: [],
      skills: [],
    };
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

    // Emit event for external runners (CLI, Agent tool, etc.)
    // Note: actual subagent execution is done by Claude Code Agent tool,
    // not programmatically. This event allows listeners to capture the prompt.
    await this.kernel.bus.emit('subagent:invoke', {
      ticket,
      capsule,
      prompt,
    });

    // In programmatic mode, return stub. Real execution happens via Claude Code slash commands.
    return this.stubResponse(ticket);
  }

  // ── Private: helpers ──────────────────────────────────────────

  private async collectTickets(plan: MaestroPlan): Promise<Ticket[]> {
    const stateModule = this.kernel.getModule<StateModule>('state');

    // Load tickets in plan phase order
    const orderedIds = plan.phases.flatMap(p => p.ticket_ids);
    const tickets: Ticket[] = [];

    for (const id of orderedIds) {
      const ticket = await stateModule.getTicket(id);
      if (ticket) tickets.push(ticket);
    }

    if (tickets.length > 0) return tickets;

    // Fallback: load all tickets from state
    return stateModule.listTickets();
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
