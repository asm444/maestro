#!/usr/bin/env node
'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { detectStack, detectCommands, initMaestro } = require('../../scripts/init');
const { getMaestroDir, readState } = require('../../scripts/state');

let tmpDir;

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-init-test-'));
}

function teardown() {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

describe('init.js — detectStack', () => {
  beforeEach(setup);
  afterEach(teardown);

  test('retorna ["unknown"] para diretório vazio', () => {
    const stack = detectStack(tmpDir);
    assert.deepEqual(stack, ['unknown']);
  });

  test('detecta node quando package.json existe', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}', 'utf8');
    const stack = detectStack(tmpDir);
    assert.ok(stack.includes('node'));
  });

  test('detecta typescript quando tsconfig.json existe', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}', 'utf8');
    const stack = detectStack(tmpDir);
    assert.ok(stack.includes('typescript'));
  });

  test('detecta docker quando Dockerfile existe', () => {
    fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), 'FROM node:alpine', 'utf8');
    const stack = detectStack(tmpDir);
    assert.ok(stack.includes('docker'));
  });

  test('detecta docker-compose quando docker-compose.yml existe', () => {
    fs.writeFileSync(path.join(tmpDir, 'docker-compose.yml'), 'version: "3"', 'utf8');
    const stack = detectStack(tmpDir);
    assert.ok(stack.includes('docker-compose'));
  });

  test('detecta múltiplas stacks simultaneamente', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), 'FROM node', 'utf8');
    const stack = detectStack(tmpDir);
    assert.ok(stack.includes('node'));
    assert.ok(stack.includes('typescript'));
    assert.ok(stack.includes('docker'));
  });

  test('detecta github-actions quando .github/workflows/ existe', () => {
    fs.mkdirSync(path.join(tmpDir, '.github', 'workflows'), { recursive: true });
    const stack = detectStack(tmpDir);
    assert.ok(stack.includes('github-actions'));
  });
});

describe('init.js — detectCommands', () => {
  beforeEach(setup);
  afterEach(teardown);

  test('retorna objetos vazios para projeto sem package.json', () => {
    const cmds = detectCommands(tmpDir);
    assert.deepEqual(cmds, { lint: [], test: [], build: [] });
  });

  test('detecta npm scripts de lint/test/build', () => {
    const pkg = {
      scripts: {
        lint: 'eslint src/',
        test: 'jest',
        build: 'tsc',
      },
    };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg), 'utf8');

    const cmds = detectCommands(tmpDir);
    assert.ok(cmds.lint.includes('npm run lint'));
    assert.ok(cmds.test.includes('npm test'));
    assert.ok(cmds.build.includes('npm run build'));
  });

  test('não adiciona comandos ausentes no package.json', () => {
    // Apenas test definido, sem lint e build
    const pkg = { scripts: { test: 'node --test' } };
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg), 'utf8');

    const cmds = detectCommands(tmpDir);
    assert.ok(cmds.test.includes('npm test'));
    assert.deepEqual(cmds.lint, []);
    assert.deepEqual(cmds.build, []);
  });
});

describe('init.js — initMaestro', () => {
  beforeEach(setup);
  afterEach(teardown);

  test('cria estrutura .maestro/ com subdiretórios', () => {
    initMaestro(tmpDir);
    assert.ok(fs.existsSync(path.join(tmpDir, '.maestro')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.maestro', 'tasks')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.maestro', 'reports')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.maestro', 'state.json')));
  });

  test('state.json tem initialized: true após init', () => {
    initMaestro(tmpDir);
    const state = readState(tmpDir);
    assert.equal(state.initialized, true);
  });

  test('state.json contém repoRoot correto', () => {
    initMaestro(tmpDir);
    const state = readState(tmpDir);
    assert.equal(state.repoRoot, tmpDir);
  });

  test('decisions.log é criado com entrada INIT', () => {
    initMaestro(tmpDir);
    const logPath = path.join(getMaestroDir(tmpDir), 'decisions.log');
    assert.ok(fs.existsSync(logPath));
    const content = fs.readFileSync(logPath, 'utf8');
    assert.match(content, /INIT:/);
  });

  test('retorna { maestroDir, stack, commands }', () => {
    const result = initMaestro(tmpDir);
    assert.ok(result.maestroDir, 'deve retornar maestroDir');
    assert.ok(Array.isArray(result.stack), 'stack deve ser array');
    assert.ok(result.commands, 'deve retornar commands');
    assert.ok('lint' in result.commands, 'commands deve ter lint');
    assert.ok('test' in result.commands, 'commands deve ter test');
    assert.ok('build' in result.commands, 'commands deve ter build');
  });

  test('segunda chamada não sobrescreve arquivos existentes no tasks/', () => {
    initMaestro(tmpDir);
    // Cria um arquivo em tasks/
    const taskFile = path.join(getMaestroDir(tmpDir), 'tasks', 'MANUAL.yaml');
    fs.writeFileSync(taskFile, 'id: MANUAL', 'utf8');

    // Re-inicializa
    initMaestro(tmpDir);

    // Arquivo manual deve ainda existir
    assert.ok(fs.existsSync(taskFile), 'arquivo manual em tasks/ deve persistir após re-init');
  });
});
