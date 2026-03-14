import type {
  Ticket,
  ErrorType,
  RetryContext,
  ErrorEntry,
} from '../../kernel/index.js';

// ============================================================
// RetryEngine — classifies errors, decides retries, escalates
// ============================================================

/** Regex patterns used to classify error messages. Evaluated in order. */
const ERROR_PATTERNS: Array<{ type: ErrorType; pattern: RegExp }> = [
  { type: 'syntax',       pattern: /SyntaxError|ParseError|unexpected token|unexpected end of input|IndentationError/i },
  { type: 'test_failure', pattern: /AssertionError|FAIL|failing test|test.*failed|expected.*received|✕|✗/i },
  { type: 'build_error',  pattern: /Cannot find module|Module not found|error TS\d+|ENOENT|compilation failed|build failed|tsc\s/i },
  { type: 'timeout',      pattern: /ETIMEDOUT|timed out|timeout exceeded|operation timed out/i },
  { type: 'permission',   pattern: /EACCES|EPERM|permission denied|access denied|Operation not permitted/i },
];

/** Human-readable analysis messages per error type. */
const ERROR_ANALYSIS: Record<ErrorType, string> = {
  syntax:       'The previous attempt produced a syntax error. Verify all brackets, parentheses, and quotes are balanced. Check for missing semicolons or incorrect indentation.',
  test_failure: 'One or more tests failed. Review the assertion messages, ensure the implementation matches the expected behavior, and re-run the tests before submitting.',
  build_error:  'The build failed, likely due to a missing module, incorrect import path, or a TypeScript type error. Verify all imports and type signatures.',
  timeout:      'The operation timed out. Consider breaking the work into smaller units or optimising the I/O operations that might be blocking.',
  permission:   'A permission error occurred. Ensure the target paths are writable and that no sudo-level operations are required.',
  unknown:      'An unknown error occurred. Read the stack trace carefully and attempt a minimal fix that addresses the root cause rather than the symptom.',
};

export class RetryEngine {
  private readonly maxRetries: number;

  constructor(maxRetries = 2) {
    this.maxRetries = maxRetries;
  }

  /**
   * Returns true if the ticket has not yet exhausted its retry budget.
   */
  shouldRetry(ticket: Ticket, _error: string): boolean {
    return ticket.retries < this.maxRetries;
  }

  /**
   * Classifies an error string into a known ErrorType using regex patterns.
   * Falls back to 'unknown' when no pattern matches.
   */
  analyzeError(error: string): ErrorType {
    for (const { type, pattern } of ERROR_PATTERNS) {
      if (pattern.test(error)) return type;
    }
    return 'unknown';
  }

  /**
   * Builds a RetryContext to be included in the next capsule, enriching
   * the subagent with information about what went wrong and how to fix it.
   */
  buildRetryContext(ticket: Ticket, error: string): RetryContext {
    const errorType = this.analyzeError(error);
    const analysis = ERROR_ANALYSIS[errorType];

    const enriched: string[] = [
      `Error type classified as: **${errorType}**`,
      '',
      '### Previous attempts',
    ];

    for (const entry of ticket.error_history) {
      enriched.push(
        `- Attempt ${entry.attempt} (${entry.timestamp}): ${entry.error_type} — ${entry.message.slice(0, 200)}`,
      );
    }

    enriched.push('');
    enriched.push('### Recommended approach');
    enriched.push(analysis);

    return {
      attempt: ticket.retries + 1,
      previous_error: error,
      analysis,
      enriched_context: enriched.join('\n'),
    };
  }

  /**
   * Creates a QA escalation ticket when a ticket exhausts all retries.
   * The new ticket has mode 'sequential' so it runs after the failed one.
   */
  createEscalationTicket(originalTicket: Ticket, errorHistory: ErrorEntry[]): Ticket {
    const escalationId = `ESC-${originalTicket.id}-${Date.now()}`;
    const errorSummary = errorHistory
      .map((e) => `Attempt ${e.attempt}: [${e.error_type}] ${e.message.slice(0, 150)}`)
      .join(' | ');

    return {
      id: escalationId,
      title: `[ESCALATION] ${originalTicket.title} — max retries exceeded`,
      department: 'qa-verifier',
      priority: 'high',
      mode: 'sequential',
      repo_paths: originalTicket.repo_paths,
      constraints: [
        `Original ticket ${originalTicket.id} failed after ${errorHistory.length} attempt(s): ${errorSummary}`,
        'Do not re-implement from scratch — diagnose the root cause first',
        'Produce a minimal, targeted fix',
      ],
      definition_of_done: [
        `Root cause of ${originalTicket.id} failure identified and documented`,
        'Fix applied and all validation commands pass',
        'No regressions introduced',
      ],
      skills_required: ['testagem-inteligente', 'verification-before-completion'],
      tools_allowed: originalTicket.tools_allowed,
      validation_commands: originalTicket.validation_commands,
      outputs: [
        ...originalTicket.outputs,
        `.maestro/reports/escalation-${escalationId}.md`,
      ],
      status: 'pending',
      retries: 0,
      error_history: [],
      depends_on: [originalTicket.id],
    };
  }

  /**
   * Records an error onto the ticket's error_history and increments retries.
   * Mutates the ticket in-place (caller should persist state afterwards).
   */
  recordError(ticket: Ticket, error: string): ErrorEntry {
    const errorType = this.analyzeError(error);
    const entry: ErrorEntry = {
      attempt: ticket.retries + 1,
      timestamp: new Date().toISOString(),
      error_type: errorType,
      message: error.slice(0, 1000),
    };
    ticket.error_history.push(entry);
    ticket.retries += 1;
    return entry;
  }
}
