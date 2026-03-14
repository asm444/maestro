---
name: state-schema
description: Schema dos arquivos de estado v2 do Maestro. Inclui metricas, retry history e discovery cache. Use ao ler ou interpretar o estado.
---

# Schema do Estado Maestro v2

## Estrutura `.maestro/`

```
.maestro/
├── state.json        # Estado atual do ciclo
├── plan.yaml         # Plano com fases e tickets
├── decisions.log     # Log de decisoes (append-only)
├── metrics.json      # Metricas agregadas de todos os ciclos
├── tasks/
│   ├── DRY-001.yaml  # Tickets individuais
│   ├── DRY-002.yaml
│   └── ...
└── reports/
    ├── dry_run.md    # Relatorio do dry-run
    ├── dry_run.json  # Metricas do dry-run
    ├── cycle_001.md  # Relatorios de ciclos
    └── cycle_001.json
```

## Schema: `state.json` (v2)

```json
{
  "version": "2.0.0",
  "status": "idle|planning|running|verifying|completed|failed",
  "current_cycle": "cycle-2026-03-14T10:30:00",
  "stack": {
    "languages": ["node", "typescript"],
    "frameworks": ["express", "react"],
    "package_managers": ["npm"],
    "build_tools": ["tsc"],
    "test_frameworks": ["node:test"],
    "ci_cd": ["github-actions"],
    "detected_commands": {
      "lint": "npm run lint",
      "test": "npm test",
      "build": "npm run build"
    }
  },
  "tickets": {
    "DRY-001": "completed",
    "DRY-002": "retrying",
    "DRY-003": "pending"
  },
  "last_updated": "2026-03-14T10:40:00Z"
}
```

## Schema: `plan.yaml` (v2)

```yaml
objective: "Validacao end-to-end do Maestro"
created_at: "2026-03-14T10:30:00Z"
phases:
  - name: "Fase 1: Backend"
    mode: sequential
    ticket_ids:
      - DRY-001
  - name: "Fase 2: Frontend"
    mode: sequential
    ticket_ids:
      - DRY-002
  - name: "Fase 3: Infra + Security"
    mode: parallel
    ticket_ids:
      - DRY-003
      - DRY-004
  - name: "Fase 4: QA"
    mode: sequential
    ticket_ids:
      - DRY-005
discovery:
  mcps: ["github", "docker", "sentry"]
  skills: ["tdd", "seguranca-cia", "implementacao-inteligente"]
```

## Schema: `metrics.json` (NOVO v2)

```json
[
  {
    "cycle_id": "cycle-001",
    "total_tickets": 5,
    "completed": 4,
    "failed": 1,
    "retried": 2,
    "escalated": 0,
    "duration_ms": 45000,
    "files_touched": 12,
    "skills_invoked": ["tdd", "seguranca-cia"],
    "mcps_used": ["github"]
  }
]
```

## Ciclo de Vida de um Ticket (v2)

```
pending -> in_progress -> completed (APPROVED)
                       -> failed -> retrying -> in_progress (retry 1)
                                             -> in_progress (retry 2)
                                             -> escalated -> [QA diagnostica]
                                                          -> [sub-ticket criado]
                                                          -> completed | failed
```

## Status do Orchestrator

| Status | Descricao |
|---|---|
| idle | Nenhum ciclo ativo |
| planning | Gerando tickets a partir do objetivo |
| running | Executando tickets (dispatch + verify) |
| verifying | QA rodando verificacao final |
| completed | Ciclo concluido com sucesso |
| failed | Ciclo concluido com falhas |

## Leitura do Estado

```bash
# Via CLI v2
node dist/cli/index.js status .
node dist/cli/index.js discover .

# Via legacy
node scripts/maestro.js status .

# Direto
cat .maestro/state.json
cat .maestro/decisions.log
cat .maestro/metrics.json
ls .maestro/tasks/
ls .maestro/reports/
```
