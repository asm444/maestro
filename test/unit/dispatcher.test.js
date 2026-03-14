#!/usr/bin/env node
'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { buildContextCapsule, dispatchInfo } = require('../../scripts/dispatcher');
const { buildTicket, serializeYaml } = require('../../scripts/ticket-builder');
const { getMaestroDir } = require('../../scripts/state');

let tmpDir;

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-dispatcher-test-'));
  const maestroDir = getMaestroDir(tmpDir);
  fs.mkdirSync(path.join(maestroDir, 'tasks'), { recursive: true });
  fs.writeFileSync(path.join(maestroDir, 'decisions.log'), '', 'utf8');
}

function teardown() {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function writeTicket(ticketObj) {
  const yaml = serializeYaml(ticketObj);
  const ticketPath = path.join(getMaestroDir(tmpDir), 'tasks', `${ticketObj.id}.yaml`);
  fs.writeFileSync(ticketPath, yaml, 'utf8');
  return yaml;
}

describe('dispatcher.js — buildContextCapsule', () => {
  test('inclui seção ## Ticket com YAML', () => {
    const ticket = buildTicket({ id: 'T-001', title: 'Teste', department: 'backend' });
    const yaml = serializeYaml(ticket);
    const capsule = buildContextCapsule(ticket, yaml, {});

    assert.match(capsule, /# Context Capsule/);
    assert.match(capsule, /## Ticket/);
    assert.match(capsule, /```yaml/);
    assert.match(capsule, /id: T-001/);
  });

  test('inclui conteúdo de arquivos existentes quando fileContents não está vazio', () => {
    const ticket = buildTicket({ id: 'T-001', title: 'Teste', department: 'backend' });
    const yaml = serializeYaml(ticket);
    const fileContents = {
      'src/server.js': "const http = require('http');\n// servidor aqui",
    };

    const capsule = buildContextCapsule(ticket, yaml, fileContents);
    assert.match(capsule, /## Arquivos Existentes/);
    assert.match(capsule, /### src\/server\.js/);
    assert.match(capsule, /servidor aqui/);
  });

  test('omite seção de arquivos quando fileContents está vazio', () => {
    const ticket = buildTicket({ id: 'T-001', title: 'Teste', department: 'backend' });
    const yaml = serializeYaml(ticket);
    const capsule = buildContextCapsule(ticket, yaml, {});

    assert.doesNotMatch(capsule, /## Arquivos Existentes/);
  });

  test('capsule tem formato markdown válido (começa com #)', () => {
    const ticket = buildTicket({ id: 'T-001', title: 'Teste', department: 'backend' });
    const capsule = buildContextCapsule(ticket, serializeYaml(ticket), {});
    assert.ok(capsule.startsWith('#'), 'Capsule deve começar com # (markdown heading)');
  });
});

describe('dispatcher.js — dispatchInfo', () => {
  beforeEach(setup);
  afterEach(teardown);

  test('lê ticket existente e retorna informações de dispatch', () => {
    const ticket = buildTicket({
      id: 'DRY-001',
      title: 'GET /health',
      department: 'backend',
    });
    writeTicket(ticket);

    const info = dispatchInfo(tmpDir, 'DRY-001');
    assert.equal(info.ticketId, 'DRY-001');
    assert.equal(info.department, 'backend');
    assert.ok(info.contextCapsule, 'deve ter contextCapsule');
    assert.ok(info.rawYaml, 'deve ter rawYaml');
  });

  test('lança erro para ticket inexistente', () => {
    assert.throws(
      () => dispatchInfo(tmpDir, 'INEXISTENTE-999'),
      /Ticket não encontrado/
    );
  });

  test('inclui conteúdo de arquivos existentes em repo_paths no capsule', () => {
    // Cria um arquivo de repo_path real no tmpDir
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'server.js'),
      "// servidor existente\nconst port = 3000;",
      'utf8'
    );

    const ticket = buildTicket({
      id: 'DRY-001',
      title: 'GET /health',
      department: 'backend',
      repoPaths: ['src/server.js'],
    });
    writeTicket(ticket);

    const info = dispatchInfo(tmpDir, 'DRY-001');
    assert.match(info.contextCapsule, /servidor existente/);
    assert.ok('src/server.js' in info.fileContents);
  });

  test('não falha quando repo_paths apontam para arquivos inexistentes', () => {
    const ticket = buildTicket({
      id: 'DRY-002',
      title: 'Frontend',
      department: 'frontend',
      repoPaths: ['public/index.html'], // arquivo não existe ainda
    });
    writeTicket(ticket);

    const info = dispatchInfo(tmpDir, 'DRY-002');
    assert.equal(info.ticketId, 'DRY-002');
    assert.deepEqual(info.fileContents, {}); // arquivo não existe, sem conteúdo
  });

  test('usa routeTicket quando ticket não tem campo department', () => {
    // Ticket sem department explícito mas com repo_paths que indicam backend
    const ticket = buildTicket({
      id: 'T-NODEPT',
      title: 'Algo',
      department: 'backend', // buildTicket sempre inclui department
      repoPaths: ['api/users.js'],
    });
    // Sobrescreve removendo o campo department do YAML
    const yaml = serializeYaml({ ...ticket, department: undefined });
    const ticketPath = path.join(getMaestroDir(tmpDir), 'tasks', 'T-NODEPT.yaml');
    fs.writeFileSync(ticketPath, yaml.replace(/^department:.*\n/m, ''), 'utf8');

    const info = dispatchInfo(tmpDir, 'T-NODEPT');
    // routeByFiles(['api/users.js']) → backend
    assert.equal(info.department, 'backend');
  });
});
