#!/usr/bin/env node
'use strict';

// Regras de roteamento: padrão de arquivo → departamento
const ROUTING_RULES = [
  {
    department: 'infra-devops',
    patterns: [
      /\.github\/workflows\//,
      /Dockerfile/,
      /docker-compose/,
      /^infra\//,
      /\.gitlab-ci/,
      /Makefile/,
      /\.dockerignore/,
    ],
  },
  {
    department: 'redes',
    patterns: [
      /nginx\.conf/,
      /caddy/i,
      /traefik/i,
      /\/dns\//,
      /tls\./,
      /ssl\./,
      /proxy/i,
      /network/i,
    ],
  },
  {
    department: 'backend',
    patterns: [
      /src\/server/,
      /api\//,
      /backend\//,
      /db\//,
      /migrations?\//,
      /routes\//,
      /controllers?\//,
      /models?\//,
      /services?\//,
    ],
  },
  {
    department: 'frontend',
    patterns: [
      /src\/components/,
      /frontend\//,
      /ui\//,
      /pages\//,
      /views\//,
      /public\//,
      /assets\//,
      /\.css$/,
      /\.scss$/,
      /\.vue$/,
      /\.svelte$/,
    ],
  },
  {
    department: 'security',
    patterns: [
      /auth/i,
      /\.env/,
      /secrets?\//,
      /credentials?\//,
      /permissions?\//,
      /package-lock\.json/,
      /yarn\.lock/,
      /pnpm-lock/,
    ],
  },
  {
    department: 'qa-verifier',
    patterns: [
      /test/i,
      /spec/i,
      /\.test\./,
      /\.spec\./,
      /__tests__\//,
      /cypress\//,
      /playwright\//,
    ],
  },
  {
    department: 'agentops',
    patterns: [
      /prompts?\//,
      /templates?\//,
      /policy/i,
      /guardrail/i,
      /routing/i,
      /agents?\//,
    ],
  },
];

// Palavras-chave no título do ticket → departamento
const KEYWORD_RULES = [
  { department: 'qa-verifier', keywords: ['teste', 'falha', 'reprodução', 'flaky', 'bug', 'fix', 'reproduct', 'verificar', 'validar'] },
  { department: 'security', keywords: ['secret', 'credential', 'auth', 'cve', 'vuln', 'permission', 'hardening', 'scan'] },
  { department: 'infra-devops', keywords: ['docker', 'ci', 'cd', 'deploy', 'pipeline', 'workflow', 'build', 'infra'] },
  { department: 'backend', keywords: ['api', 'endpoint', 'database', 'migration', 'server', 'backend', 'service'] },
  { department: 'frontend', keywords: ['ui', 'component', 'view', 'page', 'frontend', 'css', 'html'] },
  { department: 'redes', keywords: ['dns', 'tls', 'ssl', 'proxy', 'nginx', 'rede', 'network', 'latencia'] },
  { department: 'agentops', keywords: ['prompt', 'template', 'routing', 'agentops', 'guardrail', 'metric'] },
];

function routeByFiles(filePaths) {
  const scores = {};
  for (const filePath of filePaths) {
    for (const rule of ROUTING_RULES) {
      if (rule.patterns.some(p => p.test(filePath))) {
        scores[rule.department] = (scores[rule.department] || 0) + 1;
      }
    }
  }
  if (Object.keys(scores).length === 0) return null;
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

function routeByKeywords(title) {
  const lower = title.toLowerCase();
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some(k => lower.includes(k))) {
      return rule.department;
    }
  }
  return null;
}

function routeTicket(ticket) {
  // 1. Tenta por arquivos primeiro
  if (ticket.repo_paths && ticket.repo_paths.length > 0) {
    const dept = routeByFiles(ticket.repo_paths);
    if (dept) return dept;
  }
  // 2. Fallback por palavras-chave no título
  if (ticket.title) {
    const dept = routeByKeywords(ticket.title);
    if (dept) return dept;
  }
  // 3. Fallback explícito no ticket
  if (ticket.department) return ticket.department;
  // 4. Default
  return 'backend';
}

module.exports = { routeTicket, routeByFiles, routeByKeywords };
