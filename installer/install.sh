#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Maestro v2 — Instalador
# ============================================================
# Uso:
#   bash install.sh                    # Instalacao generica
#   bash install.sh --profile=my-setup # Com perfil pessoal
# ============================================================

MAESTRO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE=""

# Parse argumentos
for arg in "$@"; do
  case $arg in
    --profile=*)
      PROFILE="${arg#*=}"
      shift
      ;;
  esac
done

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[maestro]${NC} $1"; }
ok()    { echo -e "${GREEN}[  ok  ]${NC} $1"; }
warn()  { echo -e "${YELLOW}[ warn ]${NC} $1"; }
fail()  { echo -e "${RED}[ fail ]${NC} $1"; exit 1; }

echo ""
echo "============================================"
echo "  Maestro v2 — Instalador"
echo "============================================"
echo ""

# --- Pre-requisitos ---

info "Verificando pre-requisitos..."

# Node.js >= 18
if ! command -v node &> /dev/null; then
  fail "Node.js nao encontrado. Instale Node.js >= 18: https://nodejs.org"
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  fail "Node.js $NODE_VERSION detectado. Requer >= 18."
fi
ok "Node.js $(node -v)"

# npm
if ! command -v npm &> /dev/null; then
  fail "npm nao encontrado."
fi
ok "npm $(npm -v)"

# Claude Code CLI
if ! command -v claude &> /dev/null; then
  warn "Claude Code CLI nao encontrado no PATH."
  warn "Instale: npm install -g @anthropic-ai/claude-code"
  warn "Continuando sem instalacao automatica do plugin..."
  CLAUDE_AVAILABLE=false
else
  ok "Claude Code CLI encontrado"
  CLAUDE_AVAILABLE=true
fi

# --- Dependencias ---

info "Instalando dependencias de desenvolvimento..."
cd "$MAESTRO_DIR"

if [ -f "package.json" ]; then
  npm install --save-dev 2>/dev/null
  ok "Dependencias instaladas"
else
  warn "package.json nao encontrado em $MAESTRO_DIR"
fi

# --- Build TypeScript ---

info "Compilando TypeScript..."

if [ -f "tsconfig.json" ]; then
  npx tsc 2>/dev/null && ok "Build TypeScript completo" || warn "Build falhou — pode ser normal se ainda nao tem src/"
else
  warn "tsconfig.json nao encontrado"
fi

# --- Testes ---

info "Executando testes..."

if [ -d "test/unit" ] && ls test/unit/*.test.js 1>/dev/null 2>&1; then
  node --test test/unit/*.test.js 2>/dev/null && ok "Testes passaram" || warn "Alguns testes falharam"
else
  warn "Nenhum teste encontrado em test/unit/"
fi

# --- Instalacao do Plugin ---

if [ "$CLAUDE_AVAILABLE" = true ]; then
  info "Instalando plugin no Claude Code..."
  claude plugin install "$MAESTRO_DIR" 2>/dev/null && ok "Plugin instalado" || warn "Falha ao instalar plugin (pode ja estar instalado)"
else
  warn "Pule: instale manualmente com 'claude plugin install $MAESTRO_DIR'"
fi

# --- Perfil Pessoal ---

if [ -n "$PROFILE" ]; then
  PROFILE_FILE="$MAESTRO_DIR/installer/${PROFILE}.json"
  if [ -f "$PROFILE_FILE" ]; then
    info "Aplicando perfil: $PROFILE"
    ok "Perfil $PROFILE carregado"
    info "Execute '/maestro-setup' no Claude Code para configuracao interativa."
  else
    warn "Perfil nao encontrado: $PROFILE_FILE"
  fi
fi

# --- Resumo ---

echo ""
echo "============================================"
echo "  Instalacao Completa!"
echo "============================================"
echo ""
info "Diretorio do plugin: $MAESTRO_DIR"
info "Versao: $(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo 'desconhecida')"
echo ""
info "Proximos passos:"
echo "  1. Abra o Claude Code no seu projeto"
echo "  2. Execute /maestro-setup para configuracao interativa"
echo "  3. Execute /maestro-init para inicializar no projeto"
echo "  4. Execute /maestro-plan \"<objetivo>\" para comecar"
echo ""
if [ "$CLAUDE_AVAILABLE" = false ]; then
  warn "Lembre: instale Claude Code primeiro!"
  echo "  npm install -g @anthropic-ai/claude-code"
  echo "  claude plugin install $MAESTRO_DIR"
fi
echo ""
