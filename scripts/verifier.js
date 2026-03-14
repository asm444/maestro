#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { readState, logDecision } = require('./state');

// Executa um comando de forma segura usando spawnSync com shell=false quando possível
function runCommand(cmd, cwd) {
  // Divide o comando em programa + argumentos para evitar injeção via shell
  const parts = cmd.trim().split(/\s+/);
  const prog = parts[0];
  const args = parts.slice(1);

  const result = spawnSync(prog, args, {
    cwd,
    timeout: 120000,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  const output = (result.stdout || '') + (result.stderr || '');
  const success = result.status === 0 && !result.error;

  return { success, output: output.trim(), code: result.status || 0, error: result.error?.message };
}

function verify(repoRoot, options = {}) {
  const state = readState(repoRoot);
  const detectedCmds = state.detectedCommands || {};
  const results = [];

  const stages = ['lint', 'test', 'build'];

  for (const stage of stages) {
    const cmds = options[stage]
      ? [options[stage]]
      : (detectedCmds[stage] || []);

    if (cmds.length === 0) {
      results.push({ stage, skipped: true, reason: 'Nenhum comando detectado' });
      continue;
    }

    for (const cmd of cmds) {
      console.log(`[verify] ${stage}: ${cmd}`);
      const result = runCommand(cmd, repoRoot);
      results.push({ stage, cmd, ...result });
      if (!result.success) {
        console.error(`[verify] FALHOU: ${cmd}\n${result.output}`);
      } else {
        console.log(`[verify] OK: ${cmd}`);
      }
    }
  }

  const passed = results.every(r => r.skipped || r.success);
  logDecision(repoRoot, `VERIFY: ${passed ? 'PASSED' : 'FAILED'}. Resultados: ${JSON.stringify(results.map(r => ({ stage: r.stage, success: r.success, skipped: r.skipped })))}`);

  return { passed, results };
}

function verifyTicketCommands(repoRoot, validationCommands) {
  const results = [];
  for (const cmd of validationCommands) {
    console.log(`[verify] Executando: ${cmd}`);
    const result = runCommand(cmd, repoRoot);
    results.push({ cmd, ...result });
    if (!result.success) {
      console.error(`[verify] FALHOU: ${cmd}`);
    } else {
      console.log(`[verify] PASSOU: ${cmd}`);
    }
  }
  const passed = results.every(r => r.success);
  return { passed, results };
}

module.exports = { verify, verifyTicketCommands, runCommand };
