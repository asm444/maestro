#!/usr/bin/env node
'use strict';

const path = require('path');

const COMMANDS = {
  init: () => require('./init').initMaestro,
  'create-template': () => require('./dry-run-template').createTemplate,
  'create-dry-run-tickets': () => require('./planner').writeDryRunTickets,
  dispatch: () => require('./dispatcher').dispatchInfo,
  verify: () => require('./verifier').verify,
  status: () => getStatus,
  'dry-run-report': () => generateDryRunReportWrapper,
};

function getStatus(repoRoot) {
  const { readState, listTickets } = require('./state');
  const state = readState(repoRoot);
  const tickets = listTickets(repoRoot);
  console.log('=== Maestro Status ===');
  console.log(`Inicializado: ${state.initialized}`);
  console.log(`Stack: ${(state.stack || []).join(', ') || 'N/A'}`);
  console.log(`Tickets: ${tickets.join(', ') || 'nenhum'}`);
  console.log(`Último update: ${state.lastUpdated || 'N/A'}`);
  return state;
}

function generateDryRunReportWrapper(repoRoot) {
  const { generateDryRunReport } = require('./report-generator');
  const { listTickets, readState } = require('./state');
  const { parseYamlSimple } = require('./ticket-builder');
  const fs = require('fs');
  const { getTicketPath } = require('./state');

  const ticketIds = listTickets(repoRoot);
  const results = ticketIds.map(id => {
    const ticketPath = getTicketPath(repoRoot, id);
    const raw = fs.existsSync(ticketPath) ? fs.readFileSync(ticketPath, 'utf8') : '';
    const ticket = parseYamlSimple(raw);
    const state = readState(repoRoot);
    const ticketState = (state.tickets || {})[id] || {};
    return {
      ticketId: id,
      title: ticket.title || id,
      department: ticket.department || 'N/A',
      verdict: ticketState.verdict || ticketState.status === 'completed' ? 'APPROVED' : 'PENDING',
      notes: ticketState.notes || '',
    };
  });

  return generateDryRunReport(repoRoot, results);
}

function printHelp() {
  console.log(`
maestro <command> [repoRoot]

Comandos:
  init <repoRoot>                   Inicializa .maestro/ e detecta stack
  create-template <repoRoot>        Cria projeto Node.js mínimo
  create-dry-run-tickets <repoRoot> Cria os 5 tickets de dry-run
  dispatch <repoRoot> <ticketId>    Exibe context capsule de um ticket
  verify <repoRoot>                 Executa lint/test/build detectados
  status <repoRoot>                 Exibe estado atual
  dry-run-report <repoRoot>         Gera relatório do dry-run
  --help                            Exibe esta ajuda
`);
}

// Entry point CLI
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    printHelp();
    process.exit(0);
  }

  const command = args[0];
  const repoRoot = path.resolve(args[1] || process.cwd());

  if (!COMMANDS[command]) {
    console.error(`[maestro] Comando desconhecido: ${command}`);
    console.error(`Comandos disponíveis: ${Object.keys(COMMANDS).join(', ')}`);
    process.exit(1);
  }

  try {
    const fn = COMMANDS[command]();

    if (command === 'dispatch') {
      const ticketId = args[2];
      if (!ticketId) {
        console.error('[maestro] dispatch requer <ticketId>');
        process.exit(1);
      }
      const result = fn(repoRoot, ticketId);
      console.log('\n' + result.contextCapsule);
    } else {
      const result = fn(repoRoot);
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        // Não imprime objetos gigantes, apenas uma confirmação
        if (result.maestroDir) console.log(`[maestro] Diretório: ${result.maestroDir}`);
        if (result.reportPath) console.log(`[maestro] Relatório: ${result.reportPath}`);
      }
    }
  } catch (e) {
    console.error(`[maestro] Erro ao executar '${command}': ${e.message}`);
    process.exit(1);
  }
}

main();
