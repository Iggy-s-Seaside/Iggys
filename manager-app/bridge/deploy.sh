#!/usr/bin/env bash
# Deploy the Luna<->Iggy's bridge to PC1 (archlinux) and restart the daemon.
# Safe to re-run. Requires PC1 online over Tailscale + sudo on PC1.
#
#   ./deploy.sh            # copy + restart + show recent logs
#   ./deploy.sh --triage   # also kick a one-shot triage pass after restart
set -euo pipefail

HOST="${LUNA_PC1:-bradley@archlinux}"
DEST="/home/bradley/projects/iggys-bridge/luna_iggys_bridge.py"
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "→ checking $HOST is reachable…"
if ! ssh -o ConnectTimeout=12 -o BatchMode=yes "$HOST" 'true' 2>/dev/null; then
  echo "✗ $HOST is unreachable (PC1 offline / Tailscale down). Power it on and retry." >&2
  exit 1
fi

echo "→ copying luna_iggys_bridge.py → $HOST:$DEST"
scp -q "$HERE/luna_iggys_bridge.py" "$HOST:$DEST"

echo "→ restarting luna-iggys-bridge.service"
ssh "$HOST" 'sudo systemctl restart luna-iggys-bridge.service && sleep 2 && systemctl is-active luna-iggys-bridge.service'

if [[ "${1:-}" == "--triage" ]]; then
  echo "→ one-shot triage pass (classifies + drafts; takes ~1-3 min)…"
  ssh "$HOST" "/usr/bin/python3 $DEST --triage"
fi

echo "→ recent logs:"
ssh "$HOST" 'journalctl -u luna-iggys-bridge --no-pager -n 15'
echo "✓ done"
