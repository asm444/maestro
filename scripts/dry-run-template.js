#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// Cria um projeto Node.js mínimo para o dry-run (se não existir)
function createTemplate(repoRoot) {
  const created = [];

  // package.json mínimo
  const pkgPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    const pkg = {
      name: 'maestro-dry-run-project',
      version: '1.0.0',
      description: 'Projeto de teste do Maestro dry-run',
      scripts: {
        test: 'node --test test/**/*.test.js',
        lint: 'node --check src/**/*.js',
        build: 'echo "Build OK"',
        start: 'node src/server.js',
      },
      engines: { node: '>=18.0.0' },
    };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
    created.push('package.json');
    console.log('[template] Criado: package.json');
  }

  // Estrutura de diretórios
  const dirs = ['src', 'public', 'test', 'scripts', '.github/workflows'];
  for (const dir of dirs) {
    const dirPath = path.join(repoRoot, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      created.push(`${dir}/`);
      console.log(`[template] Criado diretório: ${dir}/`);
    }
  }

  // .gitignore básico
  const gitignorePath = path.join(repoRoot, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    const content = 'node_modules/\n.env\n.env.local\n*.secret\n*.key\ndist/\n.maestro/reports/\n';
    fs.writeFileSync(gitignorePath, content, 'utf8');
    created.push('.gitignore');
    console.log('[template] Criado: .gitignore');
  }

  console.log(`[template] Estrutura criada: ${created.join(', ') || 'nenhum arquivo novo'}`);
  return { created, repoRoot };
}

module.exports = { createTemplate };
