import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { SkillInfo } from '../../kernel/index.js';

// ============================================================
// SkillDetector — discovers SKILL.md files from plugin dirs
// ============================================================

/** Fallback list of known built-in skills (no filesystem read required). */
const BUILT_IN_SKILLS: SkillInfo[] = [
  {
    name: 'brainstorming',
    description: 'Explorar alternativas e validar abordagem antes de implementar',
    source: 'built-in',
  },
  {
    name: 'writing-plans',
    description: 'Gerar plano de execução em plans/ com fases ordenadas',
    source: 'built-in',
  },
  {
    name: 'executing-plans',
    description: 'Executar plano salvo com checkpoints de revisão',
    source: 'built-in',
  },
  {
    name: 'tdd',
    description: 'Test-Driven Development: escreva o teste antes do código',
    source: 'built-in',
  },
  {
    name: 'testagem-inteligente',
    description: 'Design for testability: separe lógica pura de I/O',
    source: 'built-in',
  },
  {
    name: 'systematic-debugging',
    description: 'Reproduzir → isolar → hipótese → fix mínimo → verificar',
    source: 'built-in',
  },
  {
    name: 'resolucao-problemas',
    description: 'Resolução de problemas complexos e bugs resistentes',
    source: 'built-in',
  },
  {
    name: 'verification-before-completion',
    description: 'Rodar testes e confirmar output real antes de dizer "pronto"',
    source: 'built-in',
  },
  {
    name: 'seguranca-cia',
    description: 'CIA (Confidencialidade, Integridade, Disponibilidade) em toda decisão',
    source: 'built-in',
  },
  {
    name: 'implementacao-inteligente',
    description: 'Patterns que previnem problemas: retry+backoff, idempotência, timeouts',
    source: 'built-in',
  },
  {
    name: 'auditoria-codigo',
    description: 'Remover dead code, imports órfãos, variáveis não usadas',
    source: 'built-in',
  },
  {
    name: 'analise-impacto',
    description: 'Mapear blast radius antes de refatoração ou mudança em módulo compartilhado',
    source: 'built-in',
  },
  {
    name: 'pesquisa-profunda',
    description: 'Pesquisa técnica para fundamentar escolha de tecnologia',
    source: 'built-in',
  },
  {
    name: 'subagent-driven-development',
    description: 'Delegar tasks independentes a subagentes em paralelo',
    source: 'built-in',
  },
  {
    name: 'requesting-code-review',
    description: 'Solicitar code review antes de merge',
    source: 'built-in',
  },
  {
    name: 'receiving-code-review',
    description: 'Processar feedback de code review de forma estruturada',
    source: 'built-in',
  },
  {
    name: 'frontend-design',
    description: 'Design de componentes e UI com foco em usabilidade',
    source: 'built-in',
  },
];

export class SkillDetector {
  /**
   * Discovers skill definitions from the filesystem and merges them with
   * the built-in list. Filesystem skills take precedence on name collision.
   */
  async detect(): Promise<SkillInfo[]> {
    const skillPaths = await this.collectSkillPaths();
    const fsSkills = await this.parseSkillFiles(skillPaths);

    // Merge: filesystem entries override built-ins by name
    const byName = new Map<string, SkillInfo>();
    for (const skill of BUILT_IN_SKILLS) {
      byName.set(skill.name, skill);
    }
    for (const skill of fsSkills) {
      byName.set(skill.name, skill);
    }

    return [...byName.values()];
  }

  // ── Private helpers ─────────────────────────────────────────

  /**
   * Finds all SKILL.md files under known plugin locations.
   */
  private async collectSkillPaths(): Promise<string[]> {
    const searchRoots = [
      join(homedir(), '.claude', 'plugins'),
      join(homedir(), '.claude', 'skills'),
      // Common alternative locations
      join(homedir(), '.local', 'share', 'claude', 'plugins'),
    ];

    const allPaths: string[] = [];

    for (const root of searchRoots) {
      try {
        const paths = await this.findSkillFiles(root);
        allPaths.push(...paths);
      } catch {
        // Directory does not exist — skip
      }
    }

    return allPaths;
  }

  /**
   * Recursively finds SKILL.md files under a directory (max depth 4).
   */
  private async findSkillFiles(dir: string, depth = 0): Promise<string[]> {
    if (depth > 4) return [];

    const results: string[] = [];

    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return results;
    }

    await Promise.all(
      entries.map(async (entry) => {
        const full = join(dir, entry);
        try {
          const info = await stat(full);
          if (info.isDirectory()) {
            const nested = await this.findSkillFiles(full, depth + 1);
            results.push(...nested);
          } else if (
            entry.toUpperCase() === 'SKILL.MD' ||
            entry.toLowerCase().endsWith('.skill.md')
          ) {
            results.push(full);
          }
        } catch {
          // Inaccessible entry — skip
        }
      }),
    );

    return results;
  }

  /**
   * Parses a SKILL.md file to extract name and description.
   *
   * Convention:
   *   # <skill-name>
   *   <first non-empty paragraph is the description>
   */
  private async parseSkillFiles(paths: string[]): Promise<SkillInfo[]> {
    return Promise.all(
      paths.map(async (path) => {
        try {
          const content = await readFile(path, 'utf-8');
          return this.parseSkillContent(content, path);
        } catch {
          return null;
        }
      }),
    ).then((results) => results.filter((r): r is SkillInfo => r !== null));
  }

  private parseSkillContent(content: string, sourcePath: string): SkillInfo {
    const lines = content.split('\n');
    let name = '';
    let description = '';

    for (const line of lines) {
      const trimmed = line.trim();

      // First H1 heading → name
      if (!name && trimmed.startsWith('# ')) {
        name = trimmed.slice(2).trim().toLowerCase().replace(/\s+/g, '-');
        continue;
      }

      // First non-empty non-heading line after the name → description
      if (name && !description && trimmed && !trimmed.startsWith('#')) {
        description = trimmed;
        break;
      }
    }

    if (!name) {
      // Derive name from filename: /path/to/my-skill/SKILL.md → my-skill
      const parts = sourcePath.split('/');
      const parentDir = parts[parts.length - 2] ?? 'unknown';
      name = parentDir.toLowerCase();
    }

    return {
      name,
      description: description || `Skill loaded from ${sourcePath}`,
      source: sourcePath,
    };
  }
}
