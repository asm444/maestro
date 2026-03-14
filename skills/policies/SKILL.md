---
name: policies
description: Politicas obrigatorias do Maestro v2 que TODOS os agentes e o orquestrador devem seguir. Inclui retry, escalacao e metricas.
---

# Politicas Obrigatorias do Maestro v2

## Regras Inviolaveis

### 1. Nenhum Bugfix Sem Teste
- Antes de corrigir: escreva teste que reproduza e falhe
- Aplique a correcao
- Verifique que o teste passa
- Inclua ambos nos outputs

### 2. Nenhuma Mudanca "Done" Sem Validacao
- validation_commands executados com sucesso
- Se lint/test/build falharem: status = failed
- QA tem poder de veto: REJECTED gera retry ou escalacao

### 3. Nunca Expor Secrets
- PROIBIDO: senhas, tokens, API keys, private keys em codigo
- Usar variaveis de ambiente, nunca hardcode
- Hook state-guard.sh bloqueia Write com padroes de credencial
- Padroes: password=, token=, secret=, BEGIN PRIVATE KEY, AKIA, ghp_, sk-, xox

### 4. Context Minimo por Agente
- Cada agente recebe: ticket YAML + repo_paths + skills prompt + MCPs
- Nunca estado completo do projeto
- Nunca tickets de outros departamentos

### 5. Departamentos Isolados
- Nenhum subagente chama outro diretamente
- Toda comunicacao passa pelo Maestro
- Subagentes nao tem ferramenta Task

### 6. Paralelismo Seguro
- parallel APENAS quando repo_paths nao se sobrepoem
- Verificar sobreposicao antes de despachar
- Em caso de duvida: sequential

### 7. Rastreabilidade
- Toda decisao em .maestro/decisions.log
- Formato: [ISO timestamp] ACAO: descricao
- Acoes: INIT, PLAN, DISPATCH, VERIFY, APPROVE, REJECT, RETRY, ESCALATE, REPORT

### 8. Retry Inteligente (NOVO v2)
- Maximo 2 retries por ticket
- Cada retry enriquece context capsule com:
  - Erro anterior + stack trace
  - Classificacao do erro (syntax, test_failure, build_error, timeout, permission)
  - Analise e sugestao de abordagem alternativa
- Apos 2 retries: escala para QA

### 9. Escalacao QA (NOVO v2)
- QA recebe ticket de escalacao com historico completo de erros
- QA diagnostica causa raiz
- QA cria sub-ticket de correcao para departamento correto
- Maximo 3 tentativas totais (2 retries + 1 escalacao)

### 10. Skills Obrigatorias por Departamento (NOVO v2)
- Cada departamento tem skills automaticas (DEPARTMENT_SKILLS)
- Skills sao injetadas no context capsule pelo router
- Agentes devem aplicar principios das skills antes de implementar

## Protocolo de Rejecao + Retry

1. Ticket falha -> retry-engine classifica erro
2. Se retries < 2: enriquece capsule, re-dispatch
3. Se retries >= 2: escala para QA
4. QA diagnostica e cria sub-ticket de correcao
5. Sub-ticket despachado para departamento correto
6. Resultado volta para QA para aprovacao
7. Maximo 3 tentativas totais por ticket original

## Metricas Obrigatorias (NOVO v2)

Cada ciclo deve registrar:
- Duracao por ticket e total
- Taxa sucesso/falha/retry/escalacao
- Arquivos tocados por departamento
- Skills invocadas
- MCPs utilizados
- Persistido em .maestro/metrics.json

## Formato de Decisions.log

```
[2026-03-14T10:30:00Z] INIT: Stack detectada: [node, typescript]. MCPs: 5. Skills: 7
[2026-03-14T10:31:00Z] PLAN: Criados 5 tickets tipo dry-run. Template: dry-run
[2026-03-14T10:32:00Z] DISPATCH: DRY-001 -> backend. Skills: [tdd, seguranca-cia]
[2026-03-14T10:35:00Z] VERIFY: DRY-001 PASSED. Duration: 180s
[2026-03-14T10:36:00Z] APPROVE: DRY-001 aprovado
[2026-03-14T10:40:00Z] RETRY: DRY-002 tentativa 2/2. Erro: test_failure. Capsule enriquecido
[2026-03-14T10:45:00Z] ESCALATE: DRY-002 escalado para QA apos 2 retries
[2026-03-14T10:50:00Z] REPORT: Ciclo cycle-001 completo. 4/5 approved, 1 escalated
```
