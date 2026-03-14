#!/usr/bin/env node
'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { createDryRunTickets, writeDryRunTickets, writePlanYaml } = require('../../scripts/planner');
const { getMaestroDir } = require('../../scripts/state');

let tmpDir;

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-planner-test-'));
  fs.mkdirSync(path.join(tmpDir, '.maestro', 'tasks'), { recursive: true });
  // Cria decisions.log vazio para evitar erro no logDecision
  fs.writeFileSync(path.join(tmpDir, '.maestro', 'decisions.log'), '', 'utf8');
}

function teardown() {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

describe('planner.js — createDryRunTickets', () => {
  test('cria exatamente 5 tickets', () => {
    const tickets = createDryRunTickets(tmpDir);
    assert.equal(tickets.length, 5);
  });

  test('tickets têm IDs DRY-001 a DRY-005 na ordem correta', () => {
    const tickets = createDryRunTickets(tmpDir);
    const ids = tickets.map(t => t.id);
    assert.deepEqual(ids, ['DRY-001', 'DRY-002', 'DRY-003', 'DRY-004', 'DRY-005']);
  });

  test('todos os tickets têm campos obrigatórios', () => {
    const tickets = createDryRunTickets(tmpDir);
    for (const ticket of tickets) {
      assert.ok(ticket.id, `${ticket.id} deve ter id`);
      assert.ok(ticket.title, `${ticket.id} deve ter title`);
      assert.ok(ticket.department, `${ticket.id} deve ter department`);
      assert.ok(ticket.definition_of_done.length > 0, `${ticket.id} deve ter definition_of_done`);
      assert.ok(ticket.validation_commands.length > 0, `${ticket.id} deve ter validation_commands`);
      assert.ok(ticket.outputs.length > 0, `${ticket.id} deve ter outputs`);
    }
  });

  test('DRY-001 é backend e sequential', () => {
    const tickets = createDryRunTickets(tmpDir);
    const dry001 = tickets.find(t => t.id === 'DRY-001');
    assert.equal(dry001.department, 'backend');
    assert.equal(dry001.mode, 'sequential');
    assert.equal(dry001.priority, 'high');
  });

  test('DRY-002 é frontend com public/index.html nos outputs', () => {
    const tickets = createDryRunTickets(tmpDir);
    const dry002 = tickets.find(t => t.id === 'DRY-002');
    assert.equal(dry002.department, 'frontend');
    assert.ok(dry002.outputs.includes('public/index.html'));
  });

  test('DRY-003 e DRY-004 são parallel (podem ser despachados simultâneamente)', () => {
    const tickets = createDryRunTickets(tmpDir);
    const dry003 = tickets.find(t => t.id === 'DRY-003');
    const dry004 = tickets.find(t => t.id === 'DRY-004');
    assert.equal(dry003.mode, 'parallel');
    assert.equal(dry004.mode, 'parallel');
  });

  test('DRY-003 e DRY-004 não têm sobreposição de repo_paths (paralelismo seguro)', () => {
    const tickets = createDryRunTickets(tmpDir);
    const dry003 = tickets.find(t => t.id === 'DRY-003');
    const dry004 = tickets.find(t => t.id === 'DRY-004');

    const paths003 = new Set(dry003.repo_paths);
    const overlap = dry004.repo_paths.filter(p => paths003.has(p));
    assert.deepEqual(overlap, [], `repo_paths não devem se sobrepor: ${overlap.join(', ')}`);
  });

  test('DRY-003 é infra-devops com .github/workflows nos outputs', () => {
    const tickets = createDryRunTickets(tmpDir);
    const dry003 = tickets.find(t => t.id === 'DRY-003');
    assert.equal(dry003.department, 'infra-devops');
    assert.ok(dry003.outputs.some(o => o.includes('.github/workflows')));
  });

  test('DRY-004 é security com scripts/secret-scan.sh nos outputs', () => {
    const tickets = createDryRunTickets(tmpDir);
    const dry004 = tickets.find(t => t.id === 'DRY-004');
    assert.equal(dry004.department, 'security');
    assert.ok(dry004.outputs.includes('scripts/secret-scan.sh'));
  });

  test('DRY-005 é qa-verifier e sequential (deve ser o último)', () => {
    const tickets = createDryRunTickets(tmpDir);
    const dry005 = tickets.find(t => t.id === 'DRY-005');
    assert.equal(dry005.department, 'qa-verifier');
    assert.equal(dry005.mode, 'sequential');
    // Deve ter todos os outputs dos outros tickets como repo_paths
    assert.ok(dry005.repo_paths.includes('src/server.js'));
    assert.ok(dry005.repo_paths.includes('public/index.html'));
    assert.ok(dry005.repo_paths.includes('scripts/ci.sh'));
    assert.ok(dry005.repo_paths.includes('scripts/secret-scan.sh'));
  });

  test('DRY-005 tem validation_commands de todos os outros tickets', () => {
    const tickets = createDryRunTickets(tmpDir);
    const dry005 = tickets.find(t => t.id === 'DRY-005');
    assert.ok(dry005.validation_commands.some(c => c.includes('health.test.js')));
    assert.ok(dry005.validation_commands.some(c => c.includes('frontend.test.js')));
    assert.ok(dry005.validation_commands.some(c => c.includes('ci.sh')));
    assert.ok(dry005.validation_commands.some(c => c.includes('secret-scan.sh')));
  });
});

describe('planner.js — writeDryRunTickets', () => {
  beforeEach(setup);
  afterEach(teardown);

  test('escreve 5 arquivos YAML em .maestro/tasks/', () => {
    writeDryRunTickets(tmpDir);
    const tasksDir = path.join(getMaestroDir(tmpDir), 'tasks');
    const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.yaml'));
    assert.equal(files.length, 5);
  });

  test('arquivos têm nomes DRY-001.yaml a DRY-005.yaml', () => {
    writeDryRunTickets(tmpDir);
    const tasksDir = path.join(getMaestroDir(tmpDir), 'tasks');
    for (let i = 1; i <= 5; i++) {
      const filePath = path.join(tasksDir, `DRY-00${i}.yaml`);
      assert.equal(fs.existsSync(filePath), true, `DRY-00${i}.yaml deve existir`);
    }
  });

  test('YAML dos tickets é não-vazio e contém o ID correto', () => {
    writeDryRunTickets(tmpDir);
    const tasksDir = path.join(getMaestroDir(tmpDir), 'tasks');
    for (let i = 1; i <= 5; i++) {
      const filePath = path.join(tasksDir, `DRY-00${i}.yaml`);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.ok(content.length > 0, `DRY-00${i}.yaml não deve estar vazio`);
      assert.match(content, new RegExp(`id: DRY-00${i}`));
    }
  });
});
