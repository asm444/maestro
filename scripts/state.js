#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_STATE = {
  version: '0.1.0',
  initialized: false,
  stack: [],
  currentCycle: null,
  tickets: {},
  lastUpdated: null,
};

function getMaestroDir(repoRoot) {
  return path.join(repoRoot, '.maestro');
}

function getStatePath(repoRoot) {
  return path.join(getMaestroDir(repoRoot), 'state.json');
}

function getDecisionsPath(repoRoot) {
  return path.join(getMaestroDir(repoRoot), 'decisions.log');
}

function readState(repoRoot) {
  const statePath = getStatePath(repoRoot);
  if (!fs.existsSync(statePath)) {
    return { ...DEFAULT_STATE };
  }
  try {
    const raw = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('[state] Erro ao ler state.json:', e.message);
    return { ...DEFAULT_STATE };
  }
}

function writeState(repoRoot, state) {
  const maestroDir = getMaestroDir(repoRoot);
  if (!fs.existsSync(maestroDir)) {
    fs.mkdirSync(maestroDir, { recursive: true });
  }
  const statePath = getStatePath(repoRoot);
  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
}

function updateTicketStatus(repoRoot, ticketId, status, extra = {}) {
  const state = readState(repoRoot);
  if (!state.tickets) state.tickets = {};
  state.tickets[ticketId] = {
    ...(state.tickets[ticketId] || {}),
    status,
    updatedAt: new Date().toISOString(),
    ...extra,
  };
  writeState(repoRoot, state);
}

function logDecision(repoRoot, entry) {
  const decisionsPath = getDecisionsPath(repoRoot);
  const maestroDir = getMaestroDir(repoRoot);
  if (!fs.existsSync(maestroDir)) {
    fs.mkdirSync(maestroDir, { recursive: true });
  }
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${entry}\n`;
  fs.appendFileSync(decisionsPath, line, 'utf8');
}

function getTicketPath(repoRoot, ticketId) {
  return path.join(getMaestroDir(repoRoot), 'tasks', `${ticketId}.yaml`);
}

function listTickets(repoRoot) {
  const tasksDir = path.join(getMaestroDir(repoRoot), 'tasks');
  if (!fs.existsSync(tasksDir)) return [];
  return fs.readdirSync(tasksDir)
    .filter(f => f.endsWith('.yaml'))
    .map(f => f.replace('.yaml', ''));
}

module.exports = {
  readState,
  writeState,
  updateTicketStatus,
  logDecision,
  getMaestroDir,
  getStatePath,
  getTicketPath,
  listTickets,
};
