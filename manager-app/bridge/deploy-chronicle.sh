#!/usr/bin/env bash
# Deploy Luna's Night Chronicle nightly job on PC1 (archlinux). Run ON pc1:
#   bash deploy-chronicle.sh
#
# It derives WorkingDirectory / EnvironmentFile / python from the EXISTING
# luna-iggys-bridge service so the chronicle job always matches the bridge's
# env + paths, installs luna_chronicle.py beside the bridge, and enables a
# nightly systemd timer (03:30) that writes the prior night's entry.
#
# Safe: it never touches the running luna-iggys-bridge daemon — it adds its own
# one-shot unit + timer. Rollback:  sudo systemctl disable --now luna-chronicle.timer
set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
UNIT="$(systemctl cat luna-iggys-bridge 2>/dev/null || true)"
WORKDIR="$(printf '%s\n' "$UNIT" | sed -n 's/^WorkingDirectory=//p' | head -1)"
ENVFILE="$(printf '%s\n' "$UNIT" | sed -n 's/^EnvironmentFile=-\{0,1\}//p' | head -1)"
PYBIN="$(printf '%s\n' "$UNIT" | sed -n 's#^ExecStart=\(/[^ ]*python[0-9.]*\).*#\1#p' | head -1)"

: "${WORKDIR:=$HOME/iggys-bridge}"
: "${ENVFILE:=$HOME/.local-agent/luna-iggys-bridge.env}"
: "${PYBIN:=/usr/bin/python3}"

echo "Using: workdir=$WORKDIR  env=$ENVFILE  python=$PYBIN"
[ -f "$ENVFILE" ] || { echo "!! env file not found: $ENVFILE (edit this script)"; exit 1; }

install -m 0755 "$SRC_DIR/luna_chronicle.py" "$WORKDIR/luna_chronicle.py"
echo "Installed luna_chronicle.py -> $WORKDIR"

sudo tee /etc/systemd/system/luna-chronicle.service >/dev/null <<EOF
[Unit]
Description=Luna's Night Chronicle generator (one-shot) — writes the prior night's entry
After=network-online.target

[Service]
Type=oneshot
User=$(id -un)
WorkingDirectory=$WORKDIR
EnvironmentFile=$ENVFILE
ExecStart=$PYBIN $WORKDIR/luna_chronicle.py
EOF

sudo tee /etc/systemd/system/luna-chronicle.timer >/dev/null <<EOF
[Unit]
Description=Run Luna's Night Chronicle nightly (writes the night that just ended)

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now luna-chronicle.timer
echo
echo "Enabled luna-chronicle.timer. Next runs:"
systemctl list-timers luna-chronicle.timer --no-pager || true
echo
echo "Smoke test (no DB write):  $PYBIN $WORKDIR/luna_chronicle.py --dry \$(date -d yesterday +%F)"
echo "Write a specific night:    $PYBIN $WORKDIR/luna_chronicle.py 2026-06-16"
