import type {
  MaestroModule,
  Kernel,
  Ticket,
  Department,
  RoutingRule,
} from '../../kernel/types.js';
import { DEPARTMENTS, DEPARTMENT_SKILLS } from '../../kernel/types.js';

const ROUTING_RULES: RoutingRule[] = [
  {
    department: 'infra-devops',
    file_patterns: [
      /\.github\/workflows\//,
      /Dockerfile/,
      /docker-compose/,
      /^infra\//,
      /Makefile$/,
      /\.gitlab-ci\.yml$/,
      /Jenkinsfile$/,
      /\.circleci\//,
    ],
    keywords: [/docker/i, /\bci\b/i, /\bcd\b/i, /deploy/i, /pipeline/i, /workflow/i, /infra/i],
  },
  {
    department: 'redes',
    file_patterns: [
      /nginx\.conf/,
      /caddy/i,
      /traefik/i,
      /tls\./,
      /ssl\./,
      /proxy/i,
      /network/i,
    ],
    keywords: [/dns/i, /tls/i, /ssl/i, /proxy/i, /nginx/i, /rede/i, /network/i, /latencia/i],
  },
  {
    department: 'security',
    file_patterns: [
      /auth/i,
      /\.env/,
      /secrets?\//,
      /credentials?\//,
      /package-lock\.json$/,
      /yarn\.lock$/,
    ],
    keywords: [/secret/i, /credential/i, /auth/i, /cve/i, /vuln/i, /permission/i, /hardening/i, /scan/i],
  },
  {
    department: 'qa-verifier',
    file_patterns: [
      /\.test\./,
      /\.spec\./,
      /^test\//,
      /__tests__\//,
      /cypress\//,
      /playwright\//,
    ],
    keywords: [/teste/i, /falha/i, /reproducao/i, /flaky/i, /bug/i, /\bfix\b/i, /verificar/i, /validar/i],
  },
  {
    department: 'backend',
    file_patterns: [
      /src\/server/,
      /^api\//,
      /^backend\//,
      /^db\//,
      /migrations?\//,
      /routes?\//,
      /controllers?\//,
      /services?\//,
    ],
    keywords: [/api/i, /endpoint/i, /database/i, /migration/i, /server/i, /backend/i, /service/i],
  },
  {
    department: 'frontend',
    file_patterns: [
      /src\/components/,
      /^frontend\//,
      /^ui\//,
      /pages?\//,
      /views?\//,
      /\.css$/,
      /\.vue$/,
      /\.svelte$/,
      /^public\//,
    ],
    keywords: [/\bui\b/i, /component/i, /\bview\b/i, /\bpage\b/i, /frontend/i, /css/i, /html/i],
  },
  {
    department: 'agentops',
    file_patterns: [
      /prompts?\//,
      /templates?\//,
      /policy/i,
      /guardrail/i,
    ],
    keywords: [/prompt/i, /template/i, /routing/i, /agentops/i, /guardrail/i, /metric/i],
  },
];

export class RouterModule implements MaestroModule {
  readonly name = 'router';
  readonly version = '2.0.0';

  async init(_kernel: Kernel): Promise<void> {}
  async dispose(): Promise<void> {}

  routeTicket(ticket: Ticket): Department {
    // If ticket already has explicit department from template, respect it
    if (ticket.department && DEPARTMENTS.includes(ticket.department)) {
      return ticket.department;
    }

    // 1. By file patterns
    const scores = new Map<Department, number>();
    for (const rule of ROUTING_RULES) {
      let score = 0;
      for (const filePath of ticket.repo_paths) {
        for (const pattern of rule.file_patterns) {
          if (pattern.test(filePath)) {
            score++;
            break;
          }
        }
      }
      if (score > 0) {
        scores.set(rule.department, (scores.get(rule.department) || 0) + score);
      }
    }

    if (scores.size > 0) {
      let best: Department = 'backend';
      let bestScore = 0;
      for (const [dept, score] of scores) {
        if (score > bestScore) {
          bestScore = score;
          best = dept;
        }
      }
      return best;
    }

    // 2. By keywords in title
    for (const rule of ROUTING_RULES) {
      for (const kw of rule.keywords) {
        if (kw.test(ticket.title)) {
          return rule.department;
        }
      }
    }

    // 3. Explicit department in ticket
    if (ticket.department && DEPARTMENTS.includes(ticket.department)) {
      return ticket.department;
    }

    // 4. Default
    return 'backend';
  }

  injectSkills(ticket: Ticket): Ticket {
    const dept = ticket.department || this.routeTicket(ticket);
    const skills = DEPARTMENT_SKILLS[dept] || [];

    return {
      ...ticket,
      department: dept,
      skills_required: [...new Set([...ticket.skills_required, ...skills])],
    };
  }

  getRoutingRules(): RoutingRule[] {
    return ROUTING_RULES;
  }
}
