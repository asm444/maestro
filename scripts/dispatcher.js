#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { getTicketPath, readState, logDecision } = require('./state');
const { routeTicket } = require('./router');
const { parseYamlSimple } = require('./ticket-builder');

function readTicket(repoRoot, ticketId) {
  const ticketPath = getTicketPath(repoRoot, ticketId);
  if (!fs.existsSync(ticketPath)) {
    throw new Error(`Ticket não encontrado: ${ticketPath}`);
  }
  const raw = fs.readFileSync(ticketPath, 'utf8');
  return parseYamlSimple(raw);
}

function readTicketRaw(repoRoot, ticketId) {
  const ticketPath = getTicketPath(repoRoot, ticketId);
  if (!fs.existsSync(ticketPath)) {
    throw new Error(`Ticket não encontrado: ${ticketPath}`);
  }
  return fs.readFileSync(ticketPath, 'utf8');
}

function dispatchInfo(repoRoot, ticketId) {
  const ticket = readTicket(repoRoot, ticketId);
  const rawYaml = readTicketRaw(repoRoot, ticketId);
  const department = ticket.department || routeTicket(ticket);

  // Lê apenas os arquivos de repo_paths que existem
  const repoPaths = Array.isArray(ticket.repo_paths) ? ticket.repo_paths : [];
  const fileContents = {};
  for (const filePath of repoPaths) {
    const absPath = path.join(repoRoot, filePath);
    if (fs.existsSync(absPath)) {
      fileContents[filePath] = fs.readFileSync(absPath, 'utf8');
    }
  }

  logDecision(repoRoot, `DISPATCH: Ticket ${ticketId} → departamento ${department}`);

  return {
    ticketId,
    department,
    rawYaml,
    ticket,
    fileContents,
    contextCapsule: buildContextCapsule(ticket, rawYaml, fileContents),
  };
}

function buildContextCapsule(ticket, rawYaml, fileContents) {
  const lines = [
    '# Context Capsule',
    '',
    '## Ticket',
    '```yaml',
    rawYaml.trim(),
    '```',
    '',
  ];

  if (Object.keys(fileContents).length > 0) {
    lines.push('## Arquivos Existentes');
    for (const [filePath, content] of Object.entries(fileContents)) {
      const ext = path.extname(filePath).slice(1) || 'text';
      lines.push(`\n### ${filePath}`);
      lines.push(`\`\`\`${ext}`);
      lines.push(content.trim());
      lines.push('```');
    }
  }

  return lines.join('\n');
}

module.exports = { readTicket, readTicketRaw, dispatchInfo, buildContextCapsule };
