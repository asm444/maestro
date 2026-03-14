import type {
  MaestroModule,
  Kernel,
  TicketTemplate,
  TemplateType,
  TemplateContext,
  MaestroPlan,
  Ticket,
} from '../../kernel/types.js';
import type { StateModule } from '../state/index.js';
import type { DiscoveryModule } from '../discovery/index.js';
import type { RouterModule } from '../router/index.js';
import { featureTemplate } from './templates/feature.js';
import { bugfixTemplate } from './templates/bugfix.js';
import { refactorTemplate } from './templates/refactor.js';
import { migrationTemplate } from './templates/migration.js';
import { dryRunTemplate } from './templates/dry-run.js';

const TEMPLATE_KEYWORDS: Record<TemplateType, RegExp[]> = {
  'feature': [/feature/i, /add/i, /implement/i, /create/i, /new/i],
  'bugfix': [/bug/i, /fix/i, /error/i, /broken/i, /crash/i, /fail/i],
  'refactor': [/refactor/i, /clean/i, /improve/i, /optimize/i, /restructure/i],
  'migration': [/migrat/i, /upgrade/i, /move/i, /transfer/i],
  'dry-run': [/dry.?run/i, /test.*maestro/i, /validat.*maestro/i],
};

export class PlannerModule implements MaestroModule {
  readonly name = 'planner';
  readonly version = '2.0.0';
  readonly dependencies = ['state', 'discovery'];

  private templates = new Map<TemplateType, TicketTemplate>();
  private kernel!: Kernel;

  async init(kernel: Kernel): Promise<void> {
    this.kernel = kernel;
    this.registerTemplate(featureTemplate);
    this.registerTemplate(bugfixTemplate);
    this.registerTemplate(refactorTemplate);
    this.registerTemplate(migrationTemplate);
    this.registerTemplate(dryRunTemplate);
  }

  async dispose(): Promise<void> {}

  registerTemplate(template: TicketTemplate): void {
    this.templates.set(template.type, template);
  }

  async plan(objective: string, templateType?: TemplateType): Promise<MaestroPlan> {
    const stateModule = this.kernel.getModule<StateModule>('state');
    const discoveryModule = this.kernel.getModule<DiscoveryModule>('discovery');
    const routerModule = this.kernel.getModule<RouterModule>('router');

    // Discover environment
    const discovery = await discoveryModule.discover(this.kernel.config.repoRoot);

    // Detect template type if not specified
    const detectedType = templateType || this.detectTemplateType(objective);
    const template = this.templates.get(detectedType);
    if (!template) {
      throw new Error(`Template "${detectedType}" not found. Available: ${[...this.templates.keys()].join(', ')}`);
    }

    // Build context
    const context: TemplateContext = {
      objective,
      stack: discovery.stack,
      mcps: discovery.mcps,
      skills: discovery.skills,
    };

    // Generate tickets
    let tickets = template.generate(context);

    // Route and inject skills
    tickets = tickets.map(ticket => {
      const routed = routerModule.routeTicket(ticket);
      return routerModule.injectSkills({ ...ticket, department: routed });
    });

    // Build plan with phases
    const plan = this.buildPlan(objective, tickets, discovery);

    // Save tickets and plan
    for (const ticket of tickets) {
      await stateModule.saveTicket(ticket);
    }
    await stateModule.savePlan(plan);

    // Update state
    const state = await stateModule.readState();
    if (state) {
      state.status = 'planning';
      for (const ticket of tickets) {
        state.tickets[ticket.id] = ticket.status;
      }
      state.last_updated = new Date().toISOString();
      await stateModule.writeState(state);
    }

    return plan;
  }

  private detectTemplateType(objective: string): TemplateType {
    for (const [type, patterns] of Object.entries(TEMPLATE_KEYWORDS)) {
      for (const pattern of patterns) {
        if (pattern.test(objective)) {
          return type as TemplateType;
        }
      }
    }
    return 'feature'; // default
  }

  private buildPlan(objective: string, tickets: Ticket[], discovery: import('../../kernel/types.js').DiscoveryResult): MaestroPlan {
    // Group into phases
    const sequential = tickets.filter(t => t.mode === 'sequential' && !t.depends_on?.length);
    const parallel = tickets.filter(t => t.mode === 'parallel');
    const dependent = tickets.filter(t => t.depends_on?.length);

    const phases: MaestroPlan['phases'] = [];
    let phaseNum = 1;

    // Sequential tickets first
    for (const ticket of sequential) {
      if (!dependent.some(d => d.id === ticket.id)) {
        phases.push({
          name: `Fase ${phaseNum}: ${ticket.title.split(':')[0] || ticket.department}`,
          mode: 'sequential',
          ticket_ids: [ticket.id],
        });
        phaseNum++;
      }
    }

    // Parallel group
    if (parallel.length > 0) {
      phases.push({
        name: `Fase ${phaseNum}: Paralelo (${parallel.map(t => t.department).join(' + ')})`,
        mode: 'parallel',
        ticket_ids: parallel.map(t => t.id),
      });
      phaseNum++;
    }

    // Dependent tickets
    for (const ticket of dependent) {
      phases.push({
        name: `Fase ${phaseNum}: ${ticket.title.split(':')[0] || ticket.department}`,
        mode: 'sequential',
        ticket_ids: [ticket.id],
      });
      phaseNum++;
    }

    return {
      objective,
      created_at: new Date().toISOString(),
      phases,
      discovery: discovery!,
    };
  }
}
