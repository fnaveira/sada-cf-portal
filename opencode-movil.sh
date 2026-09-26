#!/bin/zsh
# ============================================================
# opencode-movil.sh — Consulta la IA desde el móvil (partido)
#
# 1º intenta Tailscale (URL privada estable): http://100.x.y.z:4096
# 2º si no hay Tailscale, túnel Cloudflare (URL temporal pública)
#
# Uso:   ./opencode-movil.sh      Parar: Ctrl+C
# ============================================================
set -e
cd "$(dirname "$0")"

PORT=4096
export OPENCODE_SERVER_USERNAME=opencode
export OPENCODE_SERVER_PASSWORD='SadaCF!2026'
TUNEL_LOG=/tmp/opencode-movil-tunel.log
MODE=""

cleanup() {
  [ -n "$OC_PID" ] && kill "$OC_PID" 2>/dev/null
  [ -n "$CF_PID" ] && kill "$CF_PID" 2>/dev/null
  exit 0
}
trap cleanup INT TERM EXIT

# --- ¿Tailscale conectado? ----------------------------------
TS_IP=""
if command -v tailscale >/dev/null 2>&1; then
  TS_IP=$(tailscale ip -4 2>/dev/null | head -1 | tr -d '[:space:]') || true
fi
if [ -z "$TS_IP" ] && [ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]; then
  TS_IP=$(/Applications/Tailscale.app/Contents/MacOS/Tailscale ip -4 2>/dev/null | head -1 | tr -d '[:space:]') || true
fi

if [ -n "$TS_IP" ]; then
  MODE="tailscale"
else
  MODE="cloudflared"
fi

echo "▶ Modo: $MODE"
echo "▶ opencode web → $([ "$MODE" = tailscale ] && echo "0.0.0.0" || echo 127.0.0.1):$PORT (caffeinate: el Mac no se dormirá)"

if [ "$MODE" = "tailscale" ]; then
  caffeinate -i opencode web --hostname 0.0.0.0 --port "$PORT" &
else
  caffeinate -i opencode web --hostname 127.0.0.1 --port "$PORT" &
fi
OC_PID=$!
sleep 4

if [ "$MODE" = "tailscale" ]; then
  printf '\n════════════════════════════════════════════\n'
  printf '📱  ABRE ESTA URL EN EL MÓVIL (misma red Tailscale)\n'
  printf '    http://%s:%s\n' "$TS_IP" "$PORT"
  printf '    Usuario    : opencode\n'
  printf '    Contraseña : SadaCF!2026\n'
  printf '════════════════════════════════════════════\n\n'
else
  echo "▶ Sin Tailscale: abriendo túnel Cloudflare…"
  rm -f "$TUNEL_LOG"
  cloudflared tunnel --url "http://127.0.0.1:$PORT" >"$TUNEL_LOG" 2>&1 &
  CF_PID=$!
  (
    for i in {1..60}; do
      sleep 1
      URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNEL_LOG" 2>/dev/null | head -1)
      if [ -n "$URL" ]; then
        printf '\n════════════════════════════════════════════\n'
        printf '📱  ABRE ESTA URL EN EL MÓVIL\n'
        printf '    %s\n' "$URL"
        printf '    Usuario    : opencode\n'
        printf '    Contraseña : SadaCF!2026\n'
        printf '════════════════════════════════════════════\n\n'
        break
      fi
    done
  ) &
fi

echo "▶ Listo. Ctrl+C para parar todo."
wait
