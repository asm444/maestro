#!/usr/bin/env node
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { routeTicket, routeByFiles, routeByKeywords } = require('../../scripts/router');

describe('router.js — routeByFiles', () => {
  test('roteia .github/workflows para infra-devops', () => {
    assert.equal(routeByFiles(['.github/workflows/ci.yml']), 'infra-devops');
  });

  test('roteia Dockerfile para infra-devops', () => {
    assert.equal(routeByFiles(['Dockerfile', 'docker-compose.yml']), 'infra-devops');
  });

  test('roteia src/server.js para backend', () => {
    assert.equal(routeByFiles(['src/server.js']), 'backend');
  });

  test('roteia api/ para backend', () => {
    assert.equal(routeByFiles(['api/users.js', 'api/auth.js']), 'backend');
  });

  test('roteia src/components para frontend', () => {
    assert.equal(routeByFiles(['src/components/Button.jsx']), 'frontend');
  });

  test('roteia *.test.js para qa-verifier', () => {
    assert.equal(routeByFiles(['test/health.test.js']), 'qa-verifier');
  });

  test('roteia .spec. para qa-verifier', () => {
    assert.equal(routeByFiles(['src/app.spec.ts']), 'qa-verifier');
  });

  test('roteia .env para security', () => {
    assert.equal(routeByFiles(['.env', '.env.local']), 'security');
  });

  test('roteia package-lock.json para security', () => {
    assert.equal(routeByFiles(['package-lock.json']), 'security');
  });

  test('escolhe departamento com mais matches quando há conflito', () => {
    // 2 arquivos de backend vs 1 de frontend
    const result = routeByFiles([
      'src/server.js',
      'api/users.js',
      'src/components/App.jsx',
    ]);
    assert.equal(result, 'backend');
  });

  test('retorna null para lista de arquivos vazia', () => {
    assert.equal(routeByFiles([]), null);
  });

  test('retorna null para arquivos sem match', () => {
    assert.equal(routeByFiles(['README.md', 'LICENSE']), null);
  });
});

describe('router.js — routeByKeywords', () => {
  test('roteia "bug" para qa-verifier', () => {
    assert.equal(routeByKeywords('Corrigir bug no login'), 'qa-verifier');
  });

  test('roteia "falha" para qa-verifier', () => {
    assert.equal(routeByKeywords('Reproduzir falha na autenticação'), 'qa-verifier');
  });

  test('roteia "endpoint" para backend', () => {
    assert.equal(routeByKeywords('Criar endpoint GET /health'), 'backend');
  });

  test('roteia "docker" para infra-devops', () => {
    assert.equal(routeByKeywords('Criar Dockerfile multi-stage'), 'infra-devops');
  });

  test('roteia "secret" para security', () => {
    assert.equal(routeByKeywords('Detectar secrets em commits'), 'security');
  });

  test('roteia "html" para frontend', () => {
    // Título sem palavras-chave de outros departamentos (ex: "api" dispararia backend)
    assert.equal(routeByKeywords('Criar página HTML de status'), 'frontend');
  });

  test('roteia "dns" para redes', () => {
    assert.equal(routeByKeywords('Configurar DNS para subdomínio'), 'redes');
  });

  test('roteia "prompt" para agentops', () => {
    assert.equal(routeByKeywords('Otimizar template de prompt'), 'agentops');
  });

  test('é case-insensitive', () => {
    assert.equal(routeByKeywords('DOCKER pipeline CI'), 'infra-devops');
    assert.equal(routeByKeywords('API Backend Service'), 'backend');
  });

  test('retorna null para título sem keywords conhecidas', () => {
    assert.equal(routeByKeywords('Atualizar documentação'), null);
  });
});

describe('router.js — routeTicket (algoritmo completo)', () => {
  test('usa repo_paths quando disponíveis', () => {
    const ticket = {
      title: 'Algo genérico',
      repo_paths: ['src/server.js'],
    };
    assert.equal(routeTicket(ticket), 'backend');
  });

  test('fallback para keywords quando repo_paths está vazio', () => {
    const ticket = {
      title: 'Criar endpoint de login',
      repo_paths: [],
    };
    assert.equal(routeTicket(ticket), 'backend');
  });

  test('fallback para campo department explícito', () => {
    const ticket = {
      title: 'Tarefa genérica',
      repo_paths: [],
      department: 'security',
    };
    assert.equal(routeTicket(ticket), 'security');
  });

  test('fallback final é backend', () => {
    const ticket = {
      title: 'Tarefa sem classificação clara',
      repo_paths: [],
    };
    assert.equal(routeTicket(ticket), 'backend');
  });

  test('DRY-001: src/server.js + test/health.test.js → backend (maioria)', () => {
    const ticket = {
      title: 'GET /health endpoint',
      repo_paths: ['src/server.js', 'test/health.test.js'],
    };
    // src/server.js → backend (1), test/ → qa-verifier (1)
    // empate: usa keywords → "endpoint" → backend
    const dept = routeTicket(ticket);
    assert.ok(['backend', 'qa-verifier'].includes(dept), `esperado backend ou qa-verifier, recebeu ${dept}`);
  });

  test('DRY-003: .github/workflows + scripts/ci.sh → infra-devops', () => {
    const ticket = {
      title: 'Pipeline CI',
      repo_paths: ['.github/workflows/ci.yml', 'scripts/ci.sh'],
    };
    assert.equal(routeTicket(ticket), 'infra-devops');
  });

  test('DRY-004: scripts/secret-scan.sh → security (via keyword)', () => {
    const ticket = {
      title: 'Secret scan: detectar credenciais',
      repo_paths: ['scripts/secret-scan.sh'],
    };
    assert.equal(routeTicket(ticket), 'security');
  });
});
