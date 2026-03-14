---
name: maestro-dry-run
description: Dry-run end-to-end do Maestro v2 — cria projeto minimo, executa 5 tickets de validacao com skills e MCPs, gera relatorio com metricas.
---

# /maestro-dry-run

Execute o dry-run end-to-end do Maestro v2 com os 5 tickets obrigatorios.

## Objetivo

Validar que o Maestro v2 funciona: orquestracao, roteamento, skills integration, retry engine, verificacao QA e reporting com metricas.

---

## Fase 0: Preparacao

### 0.1 Criar estrutura do projeto de teste
```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js create-template .
```

### 0.2 Inicializar Maestro v2 (com discovery)
```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js init .
```

### 0.3 Criar tickets do dry-run
```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js plan . --template=dry-run
```

Confirme: `.maestro/tasks/DRY-001.yaml` a `DRY-005.yaml`

---

## Fase 1: DRY-001 — Backend (GET /health)

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js dispatch . DRY-001
```

Despache para `maestro-backend` com skills: `implementacao-inteligente`, `tdd`, `seguranca-cia`.

**DoD**: `src/server.js` + `test/health.test.js` criados, `node --test test/health.test.js` passa.

---

## Fase 2: DRY-002 — Frontend (HTML view)

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js dispatch . DRY-002
```

Despache para `maestro-frontend` com skills: `implementacao-inteligente`, `tdd`, `frontend-design`.

**DoD**: `public/index.html` + `test/frontend.test.js` criados, teste passa.

---

## Fase 3: DRY-003 e DRY-004 em PARALELO

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js dispatch . DRY-003
node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js dispatch . DRY-004
```

Despache **simultaneamente** (duas chamadas Task):
- DRY-003 -> `maestro-infra-devops` (skills: `implementacao-inteligente`, `seguranca-cia`)
- DRY-004 -> `maestro-security` (skills: `seguranca-cia`, `auditoria-codigo`)

**DoD DRY-003**: `scripts/ci.sh` executavel, CI pipeline funcional.
**DoD DRY-004**: `scripts/secret-scan.sh` detecta patterns, retorna 0 em projeto limpo.

---

## Fase 4: DRY-005 — QA Verifier

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js dispatch . DRY-005
```

Despache para `maestro-qa-verifier` com skills: `testagem-inteligente`, `verification-before-completion`.

O agente QA deve:
1. Verificar existencia de todos os outputs (DRY-001 a DRY-004)
2. Executar todos os validation_commands
3. Verificar cada DoD
4. Escrever `.maestro/reports/dry_run.md`
5. Retornar veredicto: APPROVED ou REJECTED

---

## Fase 5: Relatorio Final

```bash
node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js report . --type=dry-run
```

Apresente ao usuario:
1. Caminho do relatorio
2. Veredicto geral
3. Metricas: duracao total, por ticket, retries, skills usadas, MCPs usados
4. Lista de tickets com veredicto individual
5. Proximos passos

---

## Retry Inteligente (se falhar)

Se qualquer ticket falhar:
1. Retry engine analisa o erro (syntax, test_failure, build_error, timeout)
2. Enriquece context capsule com analise + sugestao
3. Re-dispatch (max 2 retries)
4. Se falhar apos 2 retries: escala para QA com ticket de diagnostico
5. Maximo 3 tentativas totais por ticket original
