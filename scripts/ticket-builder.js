#!/usr/bin/env node
'use strict';

// Serialização YAML simples sem dependências externas
function serializeYaml(obj, indent = 0) {
  const pad = '  '.repeat(indent);
  let out = '';

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      if (value.length === 0) {
        out += `${pad}${key}: []\n`;
      } else {
        out += `${pad}${key}:\n`;
        for (const item of value) {
          if (typeof item === 'object') {
            out += `${pad}  -\n`;
            out += serializeYaml(item, indent + 2);
          } else {
            out += `${pad}  - ${escapeYamlValue(item)}\n`;
          }
        }
      }
    } else if (typeof value === 'object') {
      out += `${pad}${key}:\n`;
      out += serializeYaml(value, indent + 1);
    } else {
      out += `${pad}${key}: ${escapeYamlValue(value)}\n`;
    }
  }
  return out;
}

function escapeYamlValue(val) {
  if (typeof val === 'boolean' || typeof val === 'number') return String(val);
  const str = String(val);
  // Adiciona aspas se contém caracteres especiais
  if (/[:#\[\]{},|>&*!'"@`%]/.test(str) || str.includes('\n') || str.startsWith(' ') || str.endsWith(' ')) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return str;
}

function parseYamlSimple(content) {
  const result = {};
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) { i++; continue; }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) { i++; continue; }

    const key = trimmed.slice(0, colonIdx).trim();
    const rest = trimmed.slice(colonIdx + 1).trim();

    if (rest === '' || rest === '|' || rest === '>') {
      // Array ou objeto aninhado
      const arr = [];
      i++;
      while (i < lines.length) {
        const next = lines[i];
        if (!next.trim()) { i++; break; }
        const indent = next.search(/\S/);
        if (indent === 0) break;
        const val = next.trim().replace(/^-\s*/, '');
        if (val) arr.push(val);
        i++;
      }
      result[key] = arr.length > 0 ? arr : {};
    } else {
      result[key] = rest;
      i++;
    }
  }
  return result;
}

function buildTicket({
  id,
  title,
  priority = 'medium',
  mode = 'sequential',
  department,
  repoPaths = [],
  constraints = [],
  definitionOfDone = [],
  toolsAllowed = [],
  validationCommands = [],
  outputs = [],
}) {
  return {
    id,
    title,
    priority,
    mode,
    department,
    repo_paths: repoPaths,
    constraints,
    definition_of_done: definitionOfDone,
    tools_allowed: toolsAllowed,
    validation_commands: validationCommands,
    outputs,
    created_at: new Date().toISOString(),
    status: 'pending',
  };
}

module.exports = { buildTicket, serializeYaml, parseYamlSimple, escapeYamlValue };
