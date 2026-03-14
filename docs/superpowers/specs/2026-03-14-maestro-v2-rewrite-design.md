# Maestro v2 — Rewrite Modular

**Data:** 2026-03-14
**Status:** Aprovado
**Abordagem:** Rewrite Modular com TypeScript

---

## 1. Decisoes de Escopo

| Dimensao | Decisao |
|---|---|
| Foco | Motor do Maestro (novas capacidades) |
| Prioridades | Planejamento -> Orquestracao -> Skills -> Observabilidade |
| Publico instalador | Pessoal + generico |
| MCPs | Deteccao dinamica |
| Geracao de tickets | Hibrido (templates + prompt) |
| Skills nos agentes | Automatico (plugins internos dos departamentos) |
| Error handling | Retry inteligente + escalacao QA |
| Testes | Unit + integracao + snapshots |
| Distribuicao | install.sh + /maestro-setup |

---

## 2. Arquitetura de Modulos

### Kernel (core minimo)
- `module-loader.ts` — Registry de modulos + lifecycle (init/dispose)
- `event-bus.ts` — Pub/sub para comunicacao entre modulos
- `types.ts` — Interfaces compartilhadas (MaestroModule, Ticket, ContextCapsule, etc.)

### Modulos
- **state/** — Persistencia em `.maestro/` (state.json, decisions.log, tasks/*.yaml)
- **planner/** — Geracao de tickets hibrida (templates por tipo + personalizacao via prompt)
- **router/** — Roteamento ticket -> departamento + injecao automatica de skills
- **orchestrator/** — Scheduler (grafo de deps), dispatcher, retry engine, conflict resolver
- **discovery/** — Deteccao dinamica: stack, MCPs disponiveis, skills instaladas
- **verifier/** — QA runner, DoD checker, security scan
- **reporter/** — Metricas, cycle reports, formatters (markdown/json)

### CLI
- Entry points TypeScript para cada comando (init, plan, run, dispatch, verify, setup)

### Plugin Claude Code
- commands/ — Slash commands Markdown (atualizados para v2)
- agents/ — 7 departamentos (atualizados com skills integradas)
- skills/ — Skills de conhecimento (expandidas)
- hooks/ — Hooks de seguranca (mantidos)
- installer/ — install.sh + setup wizard

---

## 3. Interfaces Chave

```typescript
interface MaestroModule {
  name: string;
  version: string;
  dependencies?: string[];
  init(kernel: Kernel): Promise<void>;
  dispose(): Promise<void>;
}

interface Kernel {
  bus: EventBus;
  getModule<T extends MaestroModule>(name: string): T;
  config: MaestroConfig;
}

interface Ticket {
  id: string;
  title: string;
  department: Department;
  priority: 'high' | 'medium' | 'low';
  mode: 'sequential' | 'parallel';
  repo_paths: string[];
  constraints: string[];
  definition_of_done: string[];
  skills_required: string[];
  tools_allowed?: string[];
  validation_commands: string[];
  outputs: string[];
  status: TicketStatus;
  retries: number;
  error_history: ErrorEntry[];
}

interface ContextCapsule {
  ticket: Ticket;
  relevant_files: FileContent[];
  skills_prompt: string;
  mcp_available: string[];
  stack_info: StackInfo;
  retry_context?: RetryContext;
}

interface RetryContext {
  attempt: number;
  previous_error: string;
  analysis: string;
  enriched_context: string;
}

interface DiscoveryResult {
  stack: StackInfo;
  mcps: McpInfo[];
  skills: SkillInfo[];
}

interface McpInfo {
  name: string;
  type: 'stdio' | 'sse' | 'http';
  tools: string[];
  available: boolean;
}

interface CycleReport {
  id: string;
  started_at: string;
  completed_at: string;
  tickets: TicketReport[];
  metrics: CycleMetrics;
  verdict: 'success' | 'partial' | 'failed';
}

interface CycleMetrics {
  total_tickets: number;
  completed: number;
  failed: number;
  retried: number;
  escalated: number;
  duration_ms: number;
  files_touched: number;
}
```

---

## 4. Data Flow

### maestro plan "<objetivo>"
```
Objetivo (string)
  -> discovery/ detecta stack + MCPs + skills
  -> planner/ seleciona templates por tipo de tarefa
  -> planner/ personaliza tickets com contexto do codebase
  -> router/ atribui departamento + skills a cada ticket
  -> orchestrator/scheduler cria grafo de dependencias
  -> state/ persiste plan.yaml + tasks/*.yaml
```

### maestro run
```
state/ le plan.yaml
  -> orchestrator/scheduler ordena execucao (parallel groups + sequential)
  -> Para cada ticket:
     -> orchestrator/dispatcher monta ContextCapsule
     -> discovery/ injeta MCPs disponiveis + skills
     -> router/skill-injector adiciona skills do departamento
     -> Subagente executa (via Claude Code Agent tool)
     -> bus emite 'ticket:result'
     -> verifier/ checa DoD + lint/test/build
     -> Se falhou:
        -> retry-engine analisa erro
        -> Se retry < 2: enriquece capsule, re-dispatch
        -> Se retry >= 2: escala para QA (novo ticket)
     -> Se passou:
        -> state/ atualiza status
        -> bus emite 'ticket:completed'
  -> reporter/ gera cycle report
  -> bus emite 'cycle:completed'
```

### maestro setup (novo)
```
discovery/ detecta ambiente completo
  -> Lista MCPs encontrados vs recomendados
  -> Lista skills encontradas vs recomendadas
  -> Gera .claude/settings.json parcial (MCPs)
  -> Atualiza CLAUDE.md se necessario
  -> Gera relatorio de setup
```

---

## 5. Skill Integration por Departamento

| Departamento | Skills Automaticas |
|---|---|
| Backend | implementacao-inteligente, tdd, seguranca-cia |
| Frontend | implementacao-inteligente, tdd, frontend-design |
| Infra/DevOps | implementacao-inteligente, seguranca-cia |
| Security | seguranca-cia, auditoria-codigo |
| QA/Verifier | testagem-inteligente, verification-before-completion |
| Redes | implementacao-inteligente, seguranca-cia |
| AgentOps | implementacao-inteligente |

O `skill-injector` adiciona ao prompt do subagente:
```
## Skills Obrigatorias
Antes de implementar, invoque as seguintes skills:
- seguranca-cia: avaliar CIA em toda decisao
- tdd: escrever teste antes do codigo
```

---

## 6. Deteccao Dinamica de MCPs

O `mcp-detector` verifica:
1. `.mcp.json` no projeto (MCPs configurados localmente)
2. `~/.claude/settings.json` (MCPs globais)
3. Tenta listar tools de cada MCP encontrado
4. Monta registry com: nome, tipo, tools disponiveis, status

O registry e injetado no ContextCapsule para que subagentes saibam quais ferramentas externas estao disponiveis.

---

## 7. Retry Inteligente + Escalacao QA

### Fluxo de retry
1. Ticket falha -> retry-engine analisa output de erro
2. Classifica erro: syntax, test_failure, build_error, timeout, permission
3. Enriquece ContextCapsule com:
   - Erro anterior + stack trace
   - Analise do que deu errado
   - Sugestao de abordagem alternativa
4. Re-dispatch (max 2 retries)

### Escalacao
5. Se falhou apos 2 retries:
   - Cria ticket de diagnostico para QA
   - QA analisa, cria sub-ticket de correcao
   - Sub-ticket roteado para departamento correto
   - Resultado volta para QA para aprovacao

---

## 8. Observabilidade e Reporting

### Metricas coletadas
- Duracao por ticket e por ciclo
- Taxa de sucesso/falha/retry
- Arquivos tocados por departamento
- Skills invocadas
- MCPs utilizados

### Relatorios
- `cycle_<id>.md` — relatorio detalhado de cada ciclo
- `dry_run.md` — relatorio especifico do dry-run
- `metrics.json` — metricas agregadas (append-only)

---

## 9. Estrategia de Testes

### Unit tests (node:test)
- Cada modulo testado isoladamente
- Mocks para I/O (filesystem, subagentes)
- Cobertura de todas as interfaces

### Integration tests
- Ciclo completo em diretorio temporario
- init -> plan -> dispatch -> verify em projeto real
- Valida outputs reais (arquivos criados, state atualizado)

### Snapshot tests
- Tickets gerados para objetivos conhecidos
- Context capsules para tickets padrao
- Reports gerados para cenarios fixos

---

## 10. Instalacao

### install.sh (bootstrap externo)
- Detecta OS e pre-requisitos (Node >= 18, Claude Code)
- Clona/copia o plugin para diretorio correto
- Roda `claude plugin install <path>`
- Executa `/maestro-setup` automaticamente

### /maestro-setup (interativo dentro do Claude Code)
- Detecta MCPs disponiveis vs recomendados
- Oferece instalar MCPs faltantes
- Detecta skills disponiveis
- Configura hooks de seguranca
- Gera relatorio de setup

### Instalador pessoal (perfil do usuario)
- Arquivo `installer/my-setup.json` com configuracao exata
- install.sh --profile=my-setup aplica tudo
