// ============================================================
// Maestro v2 — State Module
// ============================================================

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  MaestroModule,
  Kernel,
  MaestroState,
  MaestroPlan,
  Ticket,
  TicketStatus,
} from '../../kernel/types.js';

// ── YAML serializer/parser (zero external deps) ─────────────

function serializeYaml(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);

  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    // Quote strings that contain special YAML characters or look ambiguous
    if (
      value === '' ||
      value.includes(':') ||
      value.includes('#') ||
      value.includes('\n') ||
      value.startsWith(' ') ||
      value.startsWith("'") ||
      value.startsWith('"')
    ) {
      return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    }
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value
      .map((item) => `${pad}- ${serializeYaml(item, indent + 1)}`)
      .join('\n');
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    return entries
      .map(([k, v]) => {
        if (Array.isArray(v)) {
          if (v.length === 0) return `${pad}${k}: []`;
          return `${pad}${k}:\n${serializeYaml(v, indent + 1)}`;
        }
        if (v !== null && typeof v === 'object') {
          return `${pad}${k}:\n${serializeYaml(v, indent + 1)}`;
        }
        return `${pad}${k}: ${serializeYaml(v, indent)}`;
      })
      .join('\n');
  }

  return String(value);
}

function parseYaml(text: string): Record<string, unknown> {
  const lines = text.split('\n');
  let i = 0;

  function parseValue(raw: string): unknown {
    const trimmed = raw.trim();
    if (trimmed === 'null' || trimmed === '~') return null;
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === '[]') return [];
    if (trimmed === '{}') return {};
    const asNum = Number(trimmed);
    if (!isNaN(asNum) && trimmed !== '') return asNum;
    // Remove surrounding quotes
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed
        .slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }
    return trimmed;
  }

  function getIndent(line: string): number {
    let n = 0;
    for (const ch of line) {
      if (ch === ' ') n++;
      else break;
    }
    return n;
  }

  function parseBlock(baseIndent: number): Record<string, unknown> | unknown[] {
    // Peek ahead: if first non-empty line at this indent starts with '- ', it's a list
    let peekIdx = i;
    while (peekIdx < lines.length) {
      const pl = lines[peekIdx];
      if (pl.trim() === '') { peekIdx++; continue; }
      if (getIndent(pl) < baseIndent) break;
      if (pl.slice(baseIndent).startsWith('- ')) {
        return parseList(baseIndent);
      }
      break;
    }
    return parseMap(baseIndent);
  }

  function parseList(baseIndent: number): unknown[] {
    const arr: unknown[] = [];
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === '') { i++; continue; }
      const ind = getIndent(line);
      if (ind < baseIndent) break;
      const content = line.slice(baseIndent);
      if (!content.startsWith('- ')) break;
      const rawVal = content.slice(2);
      if (rawVal.trim() === '') {
        // Next lines form a nested block
        i++;
        arr.push(parseBlock(baseIndent + 2));
      } else if (rawVal.includes(': ') || rawVal.endsWith(':')) {
        // Inline map item not supported — treat as string
        i++;
        arr.push(parseValue(rawVal));
      } else {
        i++;
        arr.push(parseValue(rawVal));
      }
    }
    return arr;
  }

  function parseMap(baseIndent: number): Record<string, unknown> {
    const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
    const obj: Record<string, unknown> = Object.create(null);
    while (i < lines.length) {
      const line = lines[i];
      if (line.trim() === '' || line.trim().startsWith('#')) { i++; continue; }
      const ind = getIndent(line);
      if (ind < baseIndent) break;
      const content = line.slice(baseIndent);
      const colonIdx = content.indexOf(':');
      if (colonIdx === -1) { i++; continue; }
      const key = content.slice(0, colonIdx).trim();
      if (UNSAFE_KEYS.has(key)) { i++; continue; }
      const rest = content.slice(colonIdx + 1).trim();
      i++;
      if (rest === '' || rest === '|' || rest === '>') {
        // Value is next block
        const nextLine = lines[i];
        if (nextLine === undefined) {
          obj[key] = null;
        } else {
          const nextInd = getIndent(nextLine);
          if (nextInd > baseIndent && nextLine.trim() !== '') {
            obj[key] = parseBlock(nextInd);
          } else {
            obj[key] = null;
          }
        }
      } else {
        obj[key] = parseValue(rest);
      }
    }
    return obj;
  }

  i = 0;
  return parseMap(0);
}

// ── StateModule ──────────────────────────────────────────────

export class StateModule implements MaestroModule {
  readonly name = 'state';
  readonly version = '2.0.0';

  private maestroDir!: string;

  async init(kernel: Kernel): Promise<void> {
    this.maestroDir = kernel.config.maestroDir;
    await this.ensureDirectories();
  }

  async dispose(): Promise<void> {
    // No persistent handles to close
  }

  // ── Internal helpers ──────────────────────────────────────

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.maestroDir, { recursive: true });
    await fs.mkdir(path.join(this.maestroDir, 'tasks'), { recursive: true });
    await fs.mkdir(path.join(this.maestroDir, 'reports'), { recursive: true });
  }

  private get stateFile(): string {
    return path.join(this.maestroDir, 'state.json');
  }

  private get decisionsLog(): string {
    return path.join(this.maestroDir, 'decisions.log');
  }

  // ── Public API ────────────────────────────────────────────

  async readState(): Promise<MaestroState> {
    try {
      const raw = await fs.readFile(this.stateFile, 'utf-8');
      return JSON.parse(raw) as MaestroState;
    } catch {
      // Return a fresh default state if none exists
      const fresh: MaestroState = {
        version: '2.0.0',
        status: 'idle',
        tickets: {},
        last_updated: new Date().toISOString(),
      };
      return fresh;
    }
  }

  async writeState(state: MaestroState): Promise<void> {
    state.last_updated = new Date().toISOString();
    await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2), 'utf-8');
  }

  async updateTicketStatus(id: string, status: TicketStatus): Promise<void> {
    const state = await this.readState();
    state.tickets[id] = status;
    await this.writeState(state);
  }

  async logDecision(decision: string, reasoning: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const safeDec = decision.slice(0, 500).replace(/[\r\n]/g, ' ');
    const safeReas = reasoning.slice(0, 2000).replace(/[\r\n]/g, ' ');
    const entry = `[${timestamp}] ${safeDec}: ${safeReas}\n`;
    await fs.appendFile(this.decisionsLog, entry, 'utf-8');
  }

  async listTickets(): Promise<Ticket[]> {
    const tasksDir = path.join(this.maestroDir, 'tasks');
    let files: string[];
    try {
      files = await fs.readdir(tasksDir);
    } catch {
      return [];
    }
    const yamlFiles = files.filter((f) => f.endsWith('.yaml'));
    const tickets: Ticket[] = [];
    for (const file of yamlFiles) {
      try {
        const ticketPath = path.join(tasksDir, file);
        const raw = await fs.readFile(ticketPath, 'utf-8');
        const parsed = parseYaml(raw);
        tickets.push(parsed as unknown as Ticket);
      } catch {
        // Skip malformed files
      }
    }
    return tickets;
  }

  private validateTicketId(id: string): void {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) {
      throw new Error(`Invalid ticket ID: "${id}". Only alphanumeric, hyphens and underscores allowed.`);
    }
  }

  async getTicket(id: string): Promise<Ticket | null> {
    this.validateTicketId(id);
    const ticketPath = path.join(this.maestroDir, 'tasks', `${id}.yaml`);
    try {
      const raw = await fs.readFile(ticketPath, 'utf-8');
      const parsed = parseYaml(raw);
      return parsed as unknown as Ticket;
    } catch {
      return null;
    }
  }

  async saveTicket(ticket: Ticket): Promise<void> {
    this.validateTicketId(ticket.id);
    const ticketPath = path.join(this.maestroDir, 'tasks', `${ticket.id}.yaml`);
    const yaml = serializeYaml(ticket as unknown as Record<string, unknown>);
    await fs.writeFile(ticketPath, yaml + '\n', 'utf-8');

    // Keep state.tickets index in sync
    await this.updateTicketStatus(ticket.id, ticket.status);
  }

  async savePlan(plan: MaestroPlan): Promise<void> {
    const planPath = path.join(this.maestroDir, 'plan.yaml');
    const yaml = serializeYaml(plan as unknown as Record<string, unknown>);
    await fs.writeFile(planPath, yaml + '\n', 'utf-8');
  }

  getTicketPath(id: string): string {
    this.validateTicketId(id);
    return path.join(this.maestroDir, 'tasks', `${id}.yaml`);
  }
}

export default StateModule;
