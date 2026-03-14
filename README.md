# Maestro v2 — Orquestrador Multiagente para Claude Code

Maestro e um plugin para [Claude Code](https://docs.anthropic.com/en/docs/claude-code) que transforma qualquer objetivo de desenvolvimento em tarefas verificaveis, roteia para departamentos especializados (subagentes), e valida tudo via QA automatico.

Ele funciona como um **gerente de projeto AI**: voce descreve o que quer, ele decompoe em tickets, delega para agentes especializados, verifica os resultados, e gera relatorios.

## O que o Maestro faz

```
Seu objetivo ("Implementar auth JWT")
  |
  v
[maestro plan] --> Decompoe em tickets tipados
  |                (feature, bugfix, refactor, migration)
  v
[maestro run]  --> Executa ciclo:
  |                dispatch -> subagente executa -> QA verifica
  |                           retry inteligente se falhar
  |                           escalacao para QA se persistir
  v
[relatorio]    --> Metricas, arquivos tocados, riscos, proximos passos
```

### Capacidades

- **Planejamento hibrido**: templates por tipo de tarefa + personalizacao por contexto do codebase
- **7 departamentos**: backend, frontend, infra/devops, security, qa, redes, agentops
- **Skills automaticas**: cada departamento recebe skills integradas (TDD, seguranca CIA, etc.)
- **Discovery dinamico**: detecta stack, MCPs e skills disponiveis no ambiente
- **Retry inteligente**: classifica erros, enriquece contexto, redespacha automaticamente
- **Escalacao QA**: apos 2 retries, escala para QA que diagnostica e cria sub-ticket
- **Observabilidade**: metricas por ciclo, relatorios Markdown/JSON, decisions.log

---

## Instalacao

### Requisitos

- Node.js >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) instalado

### Instalacao automatizada

```bash
git clone git@github.com:asm444/maestro.git
cd maestro
bash installer/install.sh
```

O script:
1. Verifica pre-requisitos (Node.js, npm, Claude Code)
2. Instala dependencias de desenvolvimento
3. Compila TypeScript
4. Roda testes
5. Instala o plugin no Claude Code

### Instalacao com perfil pessoal

```bash
bash installer/install.sh --profile=my-setup
```

Aplica configuracoes do arquivo `installer/my-setup.json` (MCPs preferidos, skills, hooks).

### Instalacao manual

```bash
# 1. Clone e entre no diretorio
git clone git@github.com:asm444/maestro.git
cd maestro

# 2. Instale dependencias e compile
npm install
npm run build

# 3. Instale o plugin no Claude Code
claude plugin install /caminho/para/maestro

# 4. (Opcional) Configure o ecossistema interativamente
# Dentro do Claude Code, execute:
/maestro-setup
```

### Verificar instalacao

Abra o Claude Code em qualquer projeto e execute:

```
/maestro-init
```

Se aparecer a stack detectada, MCPs e skills — esta funcionando.

---

## Uso

### Comandos disponiveis

| Comando | O que faz |
|---|---|
| `/maestro-init` | Inicializa Maestro no projeto (detecta stack, MCPs, skills) |
| `/maestro-plan "<objetivo>"` | Gera plano com tickets tipados a partir do objetivo |
| `/maestro-run` | Executa ciclo completo: dispatch -> verify -> retry -> report |
| `/maestro-dispatch <ID>` | Executa um unico ticket por ID |
| `/maestro-verify` | Roda lint + test + build + security scan |
| `/maestro-dry-run` | Validacao end-to-end com 5 tickets obrigatorios |
| `/maestro-setup` | Configuracao interativa do ecossistema (MCPs, skills, hooks) |

### CLI (sem AI, roda direto no terminal)

```bash
maestro init              # Inicializa .maestro/
maestro status            # Estado atual
maestro verify            # lint + test + build
maestro discover          # Re-detecta stack, MCPs, skills
maestro dispatch DRY-001  # Context capsule de um ticket
```

### Fluxo tipico

```bash
# 1. Inicialize no projeto
/maestro-init

# 2. Descreva seu objetivo
/maestro-plan "Adicionar endpoint REST /users com CRUD completo e testes"

# 3. Revise os tickets gerados e execute
/maestro-run

# 4. Acompanhe o relatorio em .maestro/reports/
```

### Dry-Run (primeira vez)

O dry-run valida que o Maestro funciona no seu ambiente. Cria um mini-projeto e executa 5 tickets:

```
/maestro-dry-run
```

| Ticket | Departamento | O que faz |
|---|---|---|
| DRY-001 | backend | Endpoint GET /health + teste automatizado |
| DRY-002 | frontend | View HTML que mostra status + teste |
| DRY-003 | infra-devops | Pipeline CI (ci.sh + GitHub Actions) |
| DRY-004 | security | Script de deteccao de secrets |
| DRY-005 | qa-verifier | Valida DoD de todos + gera relatorio |

---

## Arquitetura

### Visao geral

O Maestro usa uma arquitetura **kernel + modulos plugaveis**:

```
maestro/
├── src/
│   ├── kernel/                    # Core minimo
│   │   ├── types.ts               # Todas as interfaces
│   │   ├── event-bus.ts           # Comunicacao pub/sub entre modulos
│   │   ├── module-loader.ts       # Registry + init topologico
│   │   └── index.ts               # Bootstrap
│   │
│   ├── modules/
│   │   ├── state/                 # Persistencia (.maestro/)
│   │   ├── planner/               # Geracao de tickets (5 templates)
│   │   ├── router/                # Roteamento + skill injection
│   │   ├── orchestrator/          # Scheduler + dispatcher + retry
│   │   ├── discovery/             # Deteccao de stack/MCPs/skills
│   │   ├── verifier/              # QA + security scan + DoD check
│   │   └── reporter/              # Metricas + relatorios
│   │
│   └── cli/                       # Entry points dos comandos
│
├── commands/                      # Slash commands (Markdown para Claude)
├── agents/                        # 7 departamentos (Markdown para Claude)
├── skills/                        # Knowledge base (Markdown)
├── hooks/                         # Hook de seguranca (bloqueia secrets)
├── scripts/                       # Motor legacy JS (backward compatible)
├── installer/                     # install.sh + perfil pessoal
└── test/unit/                     # 180 testes unitarios
```

### Kernel

O kernel e minimo: carrega modulos, gerencia ciclo de vida (`init`/`dispose`), e fornece um event bus para comunicacao desacoplada.

```typescript
const kernel = new MaestroKernel('/path/to/project');
kernel.registerModule(new StateModule());
kernel.registerModule(new DiscoveryModule());
// ... outros modulos
await kernel.boot(); // init topologico respeitando dependencias
```

### Modulos

Cada modulo implementa `MaestroModule`:

```typescript
interface MaestroModule {
  name: string;
  version: string;
  dependencies?: string[];        // Nomes de modulos que precisa
  init(kernel: Kernel): Promise<void>;
  dispose(): Promise<void>;
}
```

Modulos se comunicam via **event bus** (pub/sub) — nenhum modulo importa outro diretamente:

```typescript
// Orchestrator emite
kernel.bus.emit('ticket:completed', { ticket, response });

// Verifier escuta
kernel.bus.on('ticket:completed', async ({ ticket, response }) => {
  const result = await this.verify(ticket, response);
  kernel.bus.emit(result.passed ? 'qa:approved' : 'qa:rejected', { ticket });
});
```

### Departamentos (Subagentes)

Cada departamento e um agente Claude Code (arquivo Markdown em `agents/`) com:
- Escopo definido (quais tipos de tarefa executa)
- Skills obrigatorias (injetadas automaticamente no prompt)
- MCPs disponiveis (detectados dinamicamente)
- Formato de resposta padronizado (JSON)

| Departamento | Skills Automaticas | MCPs Recomendados |
|---|---|---|
| `backend` | TDD, seguranca-CIA, implementacao-inteligente | github, docker, sentry, context7 |
| `frontend` | TDD, frontend-design, implementacao-inteligente | figma, playwright, context7 |
| `infra-devops` | seguranca-CIA, implementacao-inteligente | docker, github |
| `security` | seguranca-CIA, auditoria-codigo | sentry, github |
| `qa-verifier` | testagem-inteligente, verification-before-completion | playwright |
| `redes` | seguranca-CIA, implementacao-inteligente | — |
| `agentops` | implementacao-inteligente | — |

### Templates de Ticket

O planner usa templates hibridos para gerar tickets:

| Template | Quando usar | Tickets gerados |
|---|---|---|
| `feature` | Nova funcionalidade | backend + frontend + security review + QA |
| `bugfix` | Correcao de bug | reproducao (QA) + fix (dept) + verificacao (QA) |
| `refactor` | Refatoracao | analise + implementacao + regressao (QA) |
| `migration` | Migracao de dados/schema | backup (infra) + migracao (backend) + verificacao (QA) + rollback (infra) |
| `dry-run` | Validacao do Maestro | 5 tickets padrao (backend, frontend, infra, security, QA) |

---

## Expandindo o Maestro

### Adicionar um novo departamento

1. Crie o agente em `agents/maestro-<nome>.md`:

```markdown
---
name: maestro-<nome>
description: Departamento <Nome> do Maestro v2 — <escopo>.
color: <cor>
tools: Read, Write, Edit, Bash, Glob, Grep
---

# Agente <Nome> — Maestro v2

## Skills Obrigatorias
- implementacao-inteligente
- <outras skills>

## Escopo
- <o que este departamento faz>

## Protocolo de Execucao
1. Leia o ticket
2. Aplique skills
3. Implemente
4. Execute validation_commands
5. Retorne JSON
```

2. Adicione o departamento em `src/kernel/types.ts`:

```typescript
// Em DEPARTMENTS
export const DEPARTMENTS = [
  // ... existentes
  'novo-dept',
] as const;

// Em DEPARTMENT_SKILLS
export const DEPARTMENT_SKILLS: Record<Department, string[]> = {
  // ... existentes
  'novo-dept': ['implementacao-inteligente', 'skill-especifica'],
};
```

3. Adicione regras de roteamento em `src/modules/router/index.ts`:

```typescript
{
  department: 'novo-dept',
  file_patterns: [/padrao-de-arquivo/],
  keywords: [/palavra-chave/i],
},
```

4. Recompile: `npm run build`

### Adicionar um novo template de ticket

1. Crie em `src/modules/planner/templates/<tipo>.ts`:

```typescript
import type { TicketTemplate, TemplateContext, Ticket } from '../../../kernel/types.js';
import { DEPARTMENT_SKILLS } from '../../../kernel/types.js';

export const meuTemplate: TicketTemplate = {
  type: 'meu-tipo',
  generate(context: TemplateContext): Ticket[] {
    return [
      {
        id: 'MEU-001',
        title: 'Descricao da tarefa',
        department: 'backend',
        priority: 'high',
        mode: 'sequential',
        repo_paths: ['src/...'],
        constraints: ['...'],
        definition_of_done: ['...'],
        skills_required: [...DEPARTMENT_SKILLS['backend']],
        validation_commands: ['npm test'],
        outputs: ['src/...'],
        status: 'pending',
        retries: 0,
        error_history: [],
      },
      // ... mais tickets
    ];
  },
};
```

2. Registre em `src/modules/planner/index.ts`:

```typescript
import { meuTemplate } from './templates/meu-tipo.js';

// No init():
this.registerTemplate(meuTemplate);
```

3. Adicione keywords de deteccao:

```typescript
const TEMPLATE_KEYWORDS: Record<TemplateType, RegExp[]> = {
  // ...
  'meu-tipo': [/minha-keyword/i],
};
```

### Adicionar uma nova skill

1. Crie `skills/<nome>/SKILL.md`:

```markdown
---
name: <nome>
description: <descricao curta usada para decidir relevancia>
---

# <Nome da Skill>

<Conteudo: regras, principios, checklists que os agentes devem seguir>
```

2. Mapeie para departamentos em `src/kernel/types.ts`:

```typescript
export const DEPARTMENT_SKILLS: Record<Department, string[]> = {
  'backend': ['implementacao-inteligente', 'tdd', 'seguranca-cia', 'nova-skill'],
  // ...
};
```

### Integrar um novo MCP

O Maestro detecta MCPs automaticamente via:
- `.mcp.json` no projeto (MCPs locais)
- `~/.claude/settings.json` (MCPs globais)

Para adicionar suporte especifico:

1. Documente o MCP em `skills/ecosystem/SKILL.md`:

```markdown
| **novo-mcp** | ferramenta1, ferramenta2 | Descricao do uso no Maestro |
```

2. Referencie nos agentes que devem usa-lo em `agents/maestro-<dept>.md`:

```markdown
## MCPs Disponiveis
- **novo-mcp**: descricao do uso
```

3. O discovery detecta automaticamente — nenhum codigo necessario.

### Adicionar um novo hook

1. Edite `hooks/hooks.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "NomeDaFerramenta",
        "hooks": [{
          "type": "command",
          "command": "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/meu-hook.sh"
        }]
      }
    ]
  }
}
```

2. Crie o script em `hooks/scripts/meu-hook.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)
# Analise o input JSON
# Se quiser bloquear: exit 2 com JSON { "decision": "block", "reason": "..." }
# Se OK: exit 0
exit 0
```

---

## Estado Persistente

O Maestro mantém estado em `.maestro/` dentro do projeto:

```
.maestro/
├── state.json        # Estado atual (status, stack, tickets)
├── plan.yaml         # Plano com fases e ticket IDs
├── decisions.log     # Log de todas as decisoes do orquestrador
├── metrics.json      # Metricas agregadas de todos os ciclos
├── tasks/
│   ├── FEAT-001.yaml # Tickets individuais em YAML
│   └── ...
└── reports/
    ├── dry_run.md    # Relatorio do dry-run
    ├── cycle_001.md  # Relatorios por ciclo
    └── cycle_001.json
```

## Politicas Obrigatorias

1. **Nenhum bugfix sem teste** que falha antes e passa depois
2. **Nenhuma mudanca "done"** sem lint/test/build executados
3. **Nunca expor secrets** — hook state-guard.sh bloqueia automaticamente
4. **Contexto minimo** — cada agente recebe apenas o necessario
5. **Departamentos isolados** — toda comunicacao passa pelo Maestro
6. **Paralelismo seguro** — apenas quando repo_paths nao se sobrepoem
7. **Rastreabilidade** — toda decisao em decisions.log
8. **Retry inteligente** — max 2 retries com analise de erro
9. **Escalacao QA** — apos retries, QA diagnostica e cria sub-ticket
10. **Skills obrigatorias** — cada departamento aplica skills automaticas

## Desenvolvimento

```bash
# Compilar
npm run build

# Watch mode
npm run build:watch

# Testes
npm test                    # 180 testes unitarios
npm run test:verbose        # Com output detalhado

# Verificar tipos
npm run lint                # tsc --noEmit

# Sincronizar com cache do Claude Code
bin/maestro-sync
```

## Licenca

MIT
