#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { writeState, logDecision, getMaestroDir } = require('./state');

// Detecta a stack do projeto pelo conteúdo do diretório
function detectStack(repoRoot) {
  const stack = [];
  const checks = [
    { file: 'package.json', stack: 'node' },
    { file: 'tsconfig.json', stack: 'typescript' },
    { file: 'go.mod', stack: 'go' },
    { file: 'requirements.txt', stack: 'python' },
    { file: 'pyproject.toml', stack: 'python' },
    { file: 'Gemfile', stack: 'ruby' },
    { file: 'pom.xml', stack: 'java' },
    { file: 'build.gradle', stack: 'java' },
    { file: 'Cargo.toml', stack: 'rust' },
    { file: 'composer.json', stack: 'php' },
    { file: 'Dockerfile', stack: 'docker' },
    { file: 'docker-compose.yml', stack: 'docker-compose' },
    { file: 'docker-compose.yaml', stack: 'docker-compose' },
    { file: '.github/workflows', stack: 'github-actions' },
  ];

  for (const check of checks) {
    const fullPath = path.join(repoRoot, check.file);
    if (fs.existsSync(fullPath) && !stack.includes(check.stack)) {
      stack.push(check.stack);
    }
  }

  return stack.length > 0 ? stack : ['unknown'];
}

// Detecta comandos de lint/test/build disponíveis
function detectCommands(repoRoot) {
  const commands = { lint: [], test: [], build: [] };

  const pkgPath = path.join(repoRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const scripts = pkg.scripts || {};
      if (scripts.lint) commands.lint.push('npm run lint');
      if (scripts.test) commands.test.push('npm test');
      if (scripts.build) commands.build.push('npm run build');
      if (scripts['type-check']) commands.lint.push('npm run type-check');
    } catch (_) {}
  }

  // Fallbacks comuns
  if (fs.existsSync(path.join(repoRoot, 'Makefile'))) {
    commands.lint.push('make lint');
    commands.test.push('make test');
    commands.build.push('make build');
  }

  return commands;
}

function initMaestro(repoRoot) {
  const maestroDir = getMaestroDir(repoRoot);
  const tasksDir = path.join(maestroDir, 'tasks');
  const reportsDir = path.join(maestroDir, 'reports');

  // Cria estrutura de diretórios
  for (const dir of [maestroDir, tasksDir, reportsDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[init] Criado: ${dir}`);
    }
  }

  const stack = detectStack(repoRoot);
  const commands = detectCommands(repoRoot);

  const state = {
    version: '0.1.0',
    initialized: true,
    repoRoot,
    stack,
    detectedCommands: commands,
    currentCycle: null,
    tickets: {},
    lastUpdated: null,
  };

  writeState(repoRoot, state);
  logDecision(repoRoot, `INIT: Stack detectada: [${stack.join(', ')}]. Comandos: ${JSON.stringify(commands)}`);

  console.log(`[init] Stack detectada: ${stack.join(', ')}`);
  console.log(`[init] Maestro inicializado em ${maestroDir}`);

  return { maestroDir, stack, commands };
}

module.exports = { initMaestro, detectStack, detectCommands };
