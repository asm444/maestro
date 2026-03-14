#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { buildTicket, serializeYaml } = require('./ticket-builder');
const { routeTicket } = require('./router');
const { logDecision, getMaestroDir, readState } = require('./state');

// Cria os 5 tickets obrigatórios do dry-run
function createDryRunTickets(repoRoot) {
  const tickets = [
    buildTicket({
      id: 'DRY-001',
      title: 'GET /health endpoint + teste Node.js built-in',
      priority: 'high',
      mode: 'sequential',
      department: 'backend',
      repoPaths: ['src/server.js', 'test/health.test.js'],
      constraints: [
        'Usar apenas Node.js built-in (http module)',
        'Sem dependências externas',
        'Servidor na porta 3000',
      ],
      definitionOfDone: [
        'GET /health retorna 200 com { status: "ok", timestamp: <ISO> }',
        'Teste automatizado usando node:test passa sem erros',
        'node src/server.js inicia sem erros',
      ],
      validationCommands: ['node --test test/health.test.js'],
      outputs: ['src/server.js', 'test/health.test.js'],
    }),

    buildTicket({
      id: 'DRY-002',
      title: 'HTML view chamando /health e mostrando status + teste',
      priority: 'high',
      mode: 'sequential',
      department: 'frontend',
      repoPaths: ['public/index.html', 'test/frontend.test.js'],
      constraints: [
        'HTML puro sem frameworks',
        'Fetch para http://localhost:3000/health',
        'Mostrar status e timestamp na tela',
      ],
      definitionOfDone: [
        'public/index.html existe e é HTML válido',
        'Faz fetch para /health e exibe resultado',
        'Teste verifica estrutura do HTML',
      ],
      validationCommands: ['node --test test/frontend.test.js'],
      outputs: ['public/index.html', 'test/frontend.test.js'],
    }),

    buildTicket({
      id: 'DRY-003',
      title: 'Pipeline CI local (ci.sh) + GitHub Actions yml',
      priority: 'medium',
      mode: 'parallel',
      department: 'infra-devops',
      repoPaths: ['scripts/ci.sh', '.github/workflows/ci.yml'],
      constraints: [
        'ci.sh deve ser executável (chmod +x)',
        'Sequência: lint → test → build',
        'Sair com código não-zero se qualquer etapa falhar',
      ],
      definitionOfDone: [
        'scripts/ci.sh existe e é executável',
        '.github/workflows/ci.yml existe e é YAML válido',
        'bash scripts/ci.sh executa sem erros em projeto limpo',
      ],
      validationCommands: ['bash scripts/ci.sh'],
      outputs: ['scripts/ci.sh', '.github/workflows/ci.yml'],
    }),

    buildTicket({
      id: 'DRY-004',
      title: 'Secret scan: detectar credenciais em commits (regex)',
      priority: 'medium',
      mode: 'parallel',
      department: 'security',
      repoPaths: ['scripts/secret-scan.sh'],
      constraints: [
        'Usar apenas bash + grep',
        'Detectar: AWS keys, tokens, passwords em variáveis, private keys',
        'Sair com código 1 se encontrar secrets',
        'Escanear todos os arquivos .js, .ts, .env, .json rastreados pelo git',
      ],
      definitionOfDone: [
        'scripts/secret-scan.sh existe e é executável',
        'Detecta padrões: AWS_SECRET, password=, token=, BEGIN PRIVATE KEY',
        'bash scripts/secret-scan.sh retorna 0 em projeto limpo',
        'bash scripts/secret-scan.sh retorna 1 se encontrar secrets',
      ],
      validationCommands: ['bash scripts/secret-scan.sh'],
      outputs: ['scripts/secret-scan.sh'],
    }),

    buildTicket({
      id: 'DRY-005',
      title: 'QA: Verificar DoD de todos os tickets + gerar dry_run.md',
      priority: 'high',
      mode: 'sequential',
      department: 'qa-verifier',
      repoPaths: [
        'src/server.js',
        'test/health.test.js',
        'public/index.html',
        'test/frontend.test.js',
        'scripts/ci.sh',
        '.github/workflows/ci.yml',
        'scripts/secret-scan.sh',
        '.maestro/reports/dry_run.md',
      ],
      constraints: [
        'Verificar TODOS os DoD dos tickets DRY-001 a DRY-004',
        'Executar todos os validation_commands',
        'Gerar relatório Markdown em .maestro/reports/dry_run.md',
        'Veredicto: APPROVED ou REJECTED com justificativa por ticket',
      ],
      definitionOfDone: [
        'Todos os arquivos listados existem',
        'Todos os validation_commands passam',
        '.maestro/reports/dry_run.md gerado com veredicto por ticket',
        'Veredicto geral: APPROVED (todos aprovados) ou REJECTED (algum falhou)',
      ],
      validationCommands: [
        'node --test test/health.test.js',
        'node --test test/frontend.test.js',
        'bash scripts/ci.sh',
        'bash scripts/secret-scan.sh',
      ],
      outputs: ['.maestro/reports/dry_run.md'],
    }),
  ];

  return tickets;
}

function writeDryRunTickets(repoRoot) {
  const tasksDir = path.join(getMaestroDir(repoRoot), 'tasks');
  if (!fs.existsSync(tasksDir)) {
    fs.mkdirSync(tasksDir, { recursive: true });
  }

  const tickets = createDryRunTickets(repoRoot);
  for (const ticket of tickets) {
    const ticketPath = path.join(tasksDir, `${ticket.id}.yaml`);
    fs.writeFileSync(ticketPath, serializeYaml(ticket), 'utf8');
    console.log(`[planner] Ticket criado: ${ticketPath}`);
  }

  logDecision(repoRoot, `PLAN: Criados ${tickets.length} tickets de dry-run: ${tickets.map(t => t.id).join(', ')}`);
  return tickets;
}

function writePlanYaml(repoRoot, objective, tickets) {
  const plan = {
    version: '0.1.0',
    objective,
    created_at: new Date().toISOString(),
    tickets: tickets.map(t => ({
      id: t.id,
      title: t.title,
      department: t.department,
      mode: t.mode,
      priority: t.priority,
    })),
  };

  const planPath = path.join(getMaestroDir(repoRoot), 'plan.yaml');
  fs.writeFileSync(planPath, serializeYaml(plan), 'utf8');
  console.log(`[planner] Plan escrito em ${planPath}`);
  return planPath;
}

module.exports = { createDryRunTickets, writeDryRunTickets, writePlanYaml };
