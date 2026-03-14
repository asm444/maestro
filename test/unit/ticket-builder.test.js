#!/usr/bin/env node
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTicket,
  serializeYaml,
  parseYamlSimple,
  escapeYamlValue,
} = require('../../scripts/ticket-builder');

describe('ticket-builder.js — buildTicket', () => {
  test('cria ticket com campos obrigatórios', () => {
    const ticket = buildTicket({
      id: 'DRY-001',
      title: 'GET /health endpoint',
      department: 'backend',
    });

    assert.equal(ticket.id, 'DRY-001');
    assert.equal(ticket.title, 'GET /health endpoint');
    assert.equal(ticket.department, 'backend');
    assert.equal(ticket.status, 'pending');
    assert.equal(ticket.priority, 'medium'); // padrão
    assert.equal(ticket.mode, 'sequential'); // padrão
  });

  test('respeita campos explícitos sobrepondo defaults', () => {
    const ticket = buildTicket({
      id: 'T-001',
      title: 'Teste',
      department: 'infra-devops',
      priority: 'high',
      mode: 'parallel',
    });

    assert.equal(ticket.priority, 'high');
    assert.equal(ticket.mode, 'parallel');
  });

  test('cria arrays vazios para campos omitidos', () => {
    const ticket = buildTicket({ id: 'T-001', title: 'Teste', department: 'backend' });

    assert.deepEqual(ticket.repo_paths, []);
    assert.deepEqual(ticket.constraints, []);
    assert.deepEqual(ticket.definition_of_done, []);
    assert.deepEqual(ticket.validation_commands, []);
    assert.deepEqual(ticket.outputs, []);
    assert.deepEqual(ticket.tools_allowed, []);
  });

  test('persiste arrays de definitionOfDone e repoPaths', () => {
    const ticket = buildTicket({
      id: 'T-001',
      title: 'Teste',
      department: 'backend',
      repoPaths: ['src/server.js', 'test/health.test.js'],
      definitionOfDone: ['GET /health retorna 200', 'Teste passa'],
    });

    assert.deepEqual(ticket.repo_paths, ['src/server.js', 'test/health.test.js']);
    assert.deepEqual(ticket.definition_of_done, ['GET /health retorna 200', 'Teste passa']);
  });

  test('created_at é uma data ISO 8601 válida', () => {
    const ticket = buildTicket({ id: 'T-001', title: 'Teste', department: 'backend' });
    const date = new Date(ticket.created_at);
    assert.ok(!isNaN(date.getTime()), 'created_at deve ser data válida');
  });
});

describe('ticket-builder.js — escapeYamlValue', () => {
  test('valores simples sem aspas', () => {
    assert.equal(escapeYamlValue('hello'), 'hello');
    assert.equal(escapeYamlValue('DRY-001'), 'DRY-001');
    assert.equal(escapeYamlValue('sequential'), 'sequential');
  });

  test('booleans como string', () => {
    assert.equal(escapeYamlValue(true), 'true');
    assert.equal(escapeYamlValue(false), 'false');
  });

  test('números como string', () => {
    assert.equal(escapeYamlValue(42), '42');
  });

  test('adiciona aspas para valores com dois-pontos', () => {
    const result = escapeYamlValue('GET /health retorna 200 com { status: "ok" }');
    assert.match(result, /^".*"$/);
  });

  test('adiciona aspas para valores com colchetes', () => {
    const result = escapeYamlValue('[array]');
    assert.match(result, /^".*"$/);
  });
});

describe('ticket-builder.js — serializeYaml', () => {
  test('serializa objeto simples key:value', () => {
    const yaml = serializeYaml({ id: 'DRY-001', status: 'pending' });
    assert.match(yaml, /^id: DRY-001$/m);
    assert.match(yaml, /^status: pending$/m);
  });

  test('serializa arrays corretamente com items indentados', () => {
    const yaml = serializeYaml({
      repo_paths: ['src/server.js', 'test/health.test.js'],
    });
    assert.match(yaml, /repo_paths:/);
    assert.match(yaml, /- src\/server\.js/);
    assert.match(yaml, /- test\/health\.test\.js/);
  });

  test('serializa array vazio como []', () => {
    const yaml = serializeYaml({ tools_allowed: [] });
    assert.match(yaml, /tools_allowed: \[\]/);
  });

  test('ticket DRY-001 completo é serializável e contém campos críticos', () => {
    const ticket = buildTicket({
      id: 'DRY-001',
      title: 'GET /health endpoint + teste Node.js built-in',
      priority: 'high',
      mode: 'sequential',
      department: 'backend',
      repoPaths: ['src/server.js', 'test/health.test.js'],
      validationCommands: ['node --test test/health.test.js'],
      outputs: ['src/server.js', 'test/health.test.js'],
    });

    const yaml = serializeYaml(ticket);
    assert.match(yaml, /id: DRY-001/);
    assert.match(yaml, /department: backend/);
    assert.match(yaml, /priority: high/);
    assert.match(yaml, /mode: sequential/);
    assert.match(yaml, /status: pending/);
  });

  test('não serializa valores null ou undefined', () => {
    const yaml = serializeYaml({ id: 'T-001', nothing: null, undef: undefined });
    assert.doesNotMatch(yaml, /nothing/);
    assert.doesNotMatch(yaml, /undef/);
  });
});

describe('ticket-builder.js — parseYamlSimple', () => {
  test('parseia key:value simples', () => {
    const result = parseYamlSimple('id: DRY-001\nstatus: pending');
    assert.equal(result.id, 'DRY-001');
    assert.equal(result.status, 'pending');
  });

  test('ignora linhas vazias e comentários', () => {
    const yaml = `
# comentário
id: DRY-001

title: Teste
`;
    const result = parseYamlSimple(yaml);
    assert.equal(result.id, 'DRY-001');
    assert.equal(result.title, 'Teste');
  });

  test('parseia listas como arrays', () => {
    const yaml = `id: T-001\nrepo_paths:\n  - src/server.js\n  - test/foo.test.js\n`;
    const result = parseYamlSimple(yaml);
    assert.ok(Array.isArray(result.repo_paths), 'repo_paths deve ser array');
    assert.ok(result.repo_paths.includes('src/server.js'));
    assert.ok(result.repo_paths.includes('test/foo.test.js'));
  });

  test('round-trip: buildTicket → serializeYaml → parseYamlSimple preserva campos', () => {
    const original = buildTicket({
      id: 'RT-001',
      title: 'Round trip test',
      department: 'backend',
      mode: 'parallel',
      priority: 'high',
    });

    const yaml = serializeYaml(original);
    const parsed = parseYamlSimple(yaml);

    assert.equal(parsed.id, 'RT-001');
    assert.equal(parsed.department, 'backend');
    assert.equal(parsed.mode, 'parallel');
    assert.equal(parsed.priority, 'high');
    assert.equal(parsed.status, 'pending');
  });
});
