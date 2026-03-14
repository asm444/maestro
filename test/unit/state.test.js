#!/usr/bin/env node
'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  readState,
  writeState,
  updateTicketStatus,
  logDecision,
  getMaestroDir,
  getStatePath,
  getTicketPath,
  listTickets,
} = require('../../scripts/state');

// Diretório temporário isolado por teste
let tmpDir;

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-state-test-'));
}

function teardown() {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

describe('state.js — readState', () => {
  beforeEach(setup);
  afterEach(teardown);

  test('retorna estado padrão quando .maestro/state.json não existe', () => {
    const state = readState(tmpDir);
    assert.equal(state.initialized, false);
    assert.equal(state.version, '0.1.0');
    assert.deepEqual(state.stack, []);
    assert.equal(state.currentCycle, null);
  });

  test('lê estado existente do disco', () => {
    const maestroDir = path.join(tmpDir, '.maestro');
    fs.mkdirSync(maestroDir, { recursive: true });
    fs.writeFileSync(
      path.join(maestroDir, 'state.json'),
      JSON.stringify({ version: '0.1.0', initialized: true, stack: ['node'], tickets: {} }),
      'utf8'
    );

    const state = readState(tmpDir);
    assert.equal(state.initialized, true);
    assert.deepEqual(state.stack, ['node']);
  });

  test('retorna estado padrão se state.json contém JSON inválido', () => {
    const maestroDir = path.join(tmpDir, '.maestro');
    fs.mkdirSync(maestroDir, { recursive: true });
    fs.writeFileSync(path.join(maestroDir, 'state.json'), '{ INVALID JSON }', 'utf8');

    const state = readState(tmpDir);
    assert.equal(state.initialized, false);
  });
});

describe('state.js — writeState', () => {
  beforeEach(setup);
  afterEach(teardown);

  test('cria .maestro/ automaticamente se não existir', () => {
    const maestroDir = path.join(tmpDir, '.maestro');
    assert.equal(fs.existsSync(maestroDir), false);

    writeState(tmpDir, { initialized: true, stack: ['node'] });

    assert.equal(fs.existsSync(maestroDir), true);
    assert.equal(fs.existsSync(path.join(maestroDir, 'state.json')), true);
  });

  test('persiste estado no disco corretamente', () => {
    const stateIn = { version: '0.1.0', initialized: true, stack: ['node', 'typescript'], tickets: {} };
    writeState(tmpDir, { ...stateIn });

    const raw = fs.readFileSync(getStatePath(tmpDir), 'utf8');
    const stateOut = JSON.parse(raw);

    assert.equal(stateOut.initialized, true);
    assert.deepEqual(stateOut.stack, ['node', 'typescript']);
  });

  test('atualiza lastUpdated automaticamente', () => {
    const before = Date.now();
    writeState(tmpDir, { initialized: true });
    const after = Date.now();

    const state = readState(tmpDir);
    const lastUpdated = new Date(state.lastUpdated).getTime();
    assert.ok(lastUpdated >= before, 'lastUpdated deve ser >= ao tempo de escrita');
    assert.ok(lastUpdated <= after, 'lastUpdated deve ser <= ao tempo após escrita');
  });
});

describe('state.js — updateTicketStatus', () => {
  beforeEach(setup);
  afterEach(teardown);

  test('cria entrada de ticket inexistente', () => {
    updateTicketStatus(tmpDir, 'DRY-001', 'in_progress');
    const state = readState(tmpDir);
    assert.equal(state.tickets['DRY-001'].status, 'in_progress');
  });

  test('atualiza status de ticket existente', () => {
    updateTicketStatus(tmpDir, 'DRY-001', 'in_progress');
    updateTicketStatus(tmpDir, 'DRY-001', 'completed', { verdict: 'APPROVED' });

    const state = readState(tmpDir);
    assert.equal(state.tickets['DRY-001'].status, 'completed');
    assert.equal(state.tickets['DRY-001'].verdict, 'APPROVED');
  });

  test('preserva outros campos ao atualizar', () => {
    updateTicketStatus(tmpDir, 'DRY-001', 'in_progress', { department: 'backend' });
    updateTicketStatus(tmpDir, 'DRY-001', 'completed');

    const state = readState(tmpDir);
    assert.equal(state.tickets['DRY-001'].department, 'backend');
  });
});

describe('state.js — logDecision', () => {
  beforeEach(setup);
  afterEach(teardown);

  test('cria decisions.log com entrada formatada', () => {
    logDecision(tmpDir, 'INIT: Stack detectada: [node]');

    const logPath = path.join(getMaestroDir(tmpDir), 'decisions.log');
    assert.equal(fs.existsSync(logPath), true);

    const content = fs.readFileSync(logPath, 'utf8');
    assert.match(content, /^\[.+\] INIT: Stack detectada: \[node\]\n$/);
  });

  test('acumula múltiplas entradas', () => {
    logDecision(tmpDir, 'INIT: inicializado');
    logDecision(tmpDir, 'PLAN: 5 tickets criados');
    logDecision(tmpDir, 'DISPATCH: DRY-001 → backend');

    const logPath = path.join(getMaestroDir(tmpDir), 'decisions.log');
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.trim().split('\n');
    assert.equal(lines.length, 3);
  });

  test('timestamp está no formato ISO 8601', () => {
    logDecision(tmpDir, 'TEST: entrada');
    const logPath = path.join(getMaestroDir(tmpDir), 'decisions.log');
    const content = fs.readFileSync(logPath, 'utf8');
    assert.match(content, /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
  });
});

describe('state.js — listTickets', () => {
  beforeEach(setup);
  afterEach(teardown);

  test('retorna array vazio quando tasks/ não existe', () => {
    const tickets = listTickets(tmpDir);
    assert.deepEqual(tickets, []);
  });

  test('retorna IDs dos tickets .yaml existentes', () => {
    const tasksDir = path.join(getMaestroDir(tmpDir), 'tasks');
    fs.mkdirSync(tasksDir, { recursive: true });
    fs.writeFileSync(path.join(tasksDir, 'DRY-001.yaml'), 'id: DRY-001', 'utf8');
    fs.writeFileSync(path.join(tasksDir, 'DRY-002.yaml'), 'id: DRY-002', 'utf8');
    fs.writeFileSync(path.join(tasksDir, 'README.txt'), 'not a ticket', 'utf8');

    const tickets = listTickets(tmpDir);
    assert.ok(tickets.includes('DRY-001'));
    assert.ok(tickets.includes('DRY-002'));
    assert.equal(tickets.length, 2); // não inclui README.txt
  });
});
