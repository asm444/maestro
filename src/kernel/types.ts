// ============================================================
// Maestro v2 — Core Type Definitions
// ============================================================

// --- Module System ---

export interface MaestroModule {
  readonly name: string;
  readonly version: string;
  readonly dependencies?: string[];
  init(kernel: Kernel): Promise<void>;
  dispose(): Promise<void>;
}

export interface Kernel {
  readonly bus: EventBus;
  readonly config: MaestroConfig;
  getModule<T extends MaestroModule>(name: string): T;
  registerModule(mod: MaestroModule): void;
}

// --- Event Bus ---

export type EventHandler = (payload: unknown) => void | Promise<void>;

export interface EventBus {
  on(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void;
  emit(event: string, payload?: unknown): Promise<void>;
  once(event: string, handler: EventHandler): void;
}

// --- Events ---

export const EVENTS = {
  TICKET_DISPATCHED: 'ticket:dispatched',
  TICKET_COMPLETED: 'ticket:completed',
  TICKET_FAILED: 'ticket:failed',
  TICKET_RETRYING: 'ticket:retrying',
  TICKET_ESCALATED: 'ticket:escalated',
  CYCLE_STARTED: 'cycle:started',
  CYCLE_COMPLETED: 'cycle:completed',
  QA_APPROVED: 'qa:approved',
  QA_REJECTED: 'qa:rejected',
  DISCOVERY_COMPLETE: 'discovery:complete',
} as const;

// --- Config ---

export interface MaestroConfig {
  repoRoot: string;
  maestroDir: string;
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  parallelLimit: number;
}

export function defaultConfig(repoRoot: string): MaestroConfig {
  return {
    repoRoot,
    maestroDir: `${repoRoot}/.maestro`,
    maxRetries: 2,
    retryDelayMs: 1000,
    timeoutMs: 120_000,
    parallelLimit: 4,
  };
}

// --- Departments ---

export const DEPARTMENTS = [
  'backend',
  'frontend',
  'infra-devops',
  'redes',
  'security',
  'qa-verifier',
  'agentops',
] as const;

export type Department = (typeof DEPARTMENTS)[number];

// --- Tickets ---

export type TicketPriority = 'high' | 'medium' | 'low';
export type TicketMode = 'sequential' | 'parallel';
export type TicketStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'retrying' | 'escalated';

export interface Ticket {
  id: string;
  title: string;
  department: Department;
  priority: TicketPriority;
  mode: TicketMode;
  repo_paths: string[];
  constraints: string[];
  definition_of_done: string[];
  skills_required: string[];
  tools_allowed?: string[];
  validation_commands: string[];
  outputs: string[];
  status: TicketStatus;
  retries: number;
  error_history: ErrorEntry[];
  depends_on?: string[];
}

export interface ErrorEntry {
  attempt: number;
  timestamp: string;
  error_type: ErrorType;
  message: string;
  stack_trace?: string;
}

export type ErrorType = 'syntax' | 'test_failure' | 'build_error' | 'timeout' | 'permission' | 'unknown';

// --- Context Capsule ---

export interface ContextCapsule {
  ticket: Ticket;
  relevant_files: FileContent[];
  skills_prompt: string;
  mcp_available: string[];
  stack_info: StackInfo;
  retry_context?: RetryContext;
}

export interface FileContent {
  path: string;
  content: string;
  exists: boolean;
}

export interface RetryContext {
  attempt: number;
  previous_error: string;
  analysis: string;
  enriched_context: string;
}

// --- Discovery ---

export interface DiscoveryResult {
  stack: StackInfo;
  mcps: McpInfo[];
  skills: SkillInfo[];
}

export interface StackInfo {
  languages: string[];
  frameworks: string[];
  package_managers: string[];
  build_tools: string[];
  test_frameworks: string[];
  ci_cd: string[];
  detected_commands: DetectedCommands;
}

export interface DetectedCommands {
  lint?: string;
  test?: string;
  build?: string;
  start?: string;
  [key: string]: string | undefined;
}

export interface McpInfo {
  name: string;
  type: 'stdio' | 'sse' | 'http' | 'websocket';
  tools: string[];
  available: boolean;
  config_source: 'project' | 'global';
}

export interface SkillInfo {
  name: string;
  description: string;
  source: string;
}

// --- Subagent Response ---

export interface SubagentResponse {
  touched_files: string[];
  patch_summary: string;
  commands_run: string[];
  command_results: CommandResult[];
  risks: string[];
  next_steps: string[];
}

export interface CommandResult {
  command: string;
  exit_code: number;
  stdout: string;
  stderr: string;
}

// --- Reports ---

export interface CycleReport {
  id: string;
  started_at: string;
  completed_at: string;
  tickets: TicketReport[];
  metrics: CycleMetrics;
  verdict: 'success' | 'partial' | 'failed';
}

export interface TicketReport {
  id: string;
  title: string;
  department: Department;
  status: TicketStatus;
  duration_ms: number;
  retries: number;
  files_touched: string[];
  errors: ErrorEntry[];
  dod_results: DodResult[];
}

export interface DodResult {
  criterion: string;
  passed: boolean;
  evidence?: string;
}

export interface CycleMetrics {
  total_tickets: number;
  completed: number;
  failed: number;
  retried: number;
  escalated: number;
  duration_ms: number;
  files_touched: number;
  skills_invoked: string[];
  mcps_used: string[];
}

// --- State ---

export interface MaestroState {
  version: string;
  current_cycle?: string;
  status: 'idle' | 'planning' | 'running' | 'verifying' | 'completed' | 'failed';
  stack?: StackInfo;
  tickets: Record<string, TicketStatus>;
  last_updated: string;
}

// --- Plan ---

export interface MaestroPlan {
  objective: string;
  created_at: string;
  phases: PlanPhase[];
  discovery: DiscoveryResult;
}

export interface PlanPhase {
  name: string;
  mode: 'sequential' | 'parallel';
  ticket_ids: string[];
}

// --- Template ---

export type TemplateType = 'feature' | 'bugfix' | 'refactor' | 'migration' | 'dry-run';

export interface TicketTemplate {
  type: TemplateType;
  generate(context: TemplateContext): Ticket[];
}

export interface TemplateContext {
  objective: string;
  stack: StackInfo;
  mcps: McpInfo[];
  skills: SkillInfo[];
  repo_paths?: string[];
}

// --- Skill Mapping ---

export const DEPARTMENT_SKILLS: Record<Department, string[]> = {
  'backend': ['implementacao-inteligente', 'tdd', 'seguranca-cia'],
  'frontend': ['implementacao-inteligente', 'tdd', 'frontend-design'],
  'infra-devops': ['implementacao-inteligente', 'seguranca-cia'],
  'redes': ['implementacao-inteligente', 'seguranca-cia'],
  'security': ['seguranca-cia', 'auditoria-codigo'],
  'qa-verifier': ['testagem-inteligente', 'verification-before-completion'],
  'agentops': ['implementacao-inteligente'],
};

// --- Routing ---

export interface RoutingRule {
  department: Department;
  file_patterns: RegExp[];
  keywords: RegExp[];
}
