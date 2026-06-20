#!/usr/bin/env bash
# Deploy Luna's Night Chronicle nightly job on PC1. Run ON pc1 from the bridge dir:
#   bash deploy-chronicle.sh
#
# Mirrors the EXISTING luna-iggys-briefing unit (USER-level on PC1 — systemctl --user,
# no sudo) so the chronicle job inherits the same env + paths. Installs the generator
# beside the bridge, creates user-level units, and enables a nightly 03:30 timer.
# Safe: it never touches the running luna-iggys-bridge daemon.
# Rollback:  systemctl --user disable --now luna-chronicle.timer
set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

# Use the existing briefing unit as the template (it knows the real env + paths).
BREF=""
for f in "$SRC_DIR/luna-iggys-briefing.service" "$HOME/.config/systemd/user/luna-iggys-briefing.service"; do
  [ -f "$f" ] && BREF="$(cat "$f")" && break
done
[ -z "$BREF" ] && BREF="$(systemctl --user cat luna-iggys-briefing 2>/dev/null || true)"

ENVF="$(printf '%s\n' "$BREF" | sed -n 's/^EnvironmentFile=-\{0,1\}//p' | head -1)"
WD="$(printf '%s\n' "$BREF" | sed -n 's/^WorkingDirectory=//p' | head -1)"
PY="$(printf '%s\n' "$BREF" | sed -n 's#^ExecStart=\(/[^ ]*python[0-9.]*\).*#\1#p' | head -1)"
: "${WD:=$SRC_DIR}"
: "${PY:=/usr/bin/python3}"
echo "env=${ENVF:-<none>}  workdir=$WD  python=$PY"

# Install the generator (and its optional footage-band helper) next to the bridge.
cp "$SRC_DIR/luna_chronicle.py" "$WD/luna_chronicle.py"
# bar_busyness.py supplies the footage-derived auto close-out band. Without it the
# generator's `import bar_busyness` fails and the auto-band step is silently skipped
# every night — so copy it alongside the generator.
[ -f "$SRC_DIR/bar_busyness.py" ] && cp "$SRC_DIR/bar_busyness.py" "$WD/bar_busyness.py"
echo "Installed luna_chronicle.py (+ bar_busyness.py) -> $WD"

UDIR="$HOME/.config/systemd/user"
mkdir -p "$UDIR"
cat > "$UDIR/luna-chronicle.service" <<EOF
[Unit]
Description=Luna's Night Chronicle generator (one-shot) — writes the prior night's entry

[Service]
Type=oneshot
WorkingDirectory=$WD
${ENVF:+EnvironmentFile=$ENVF}
ExecStart=$PY $WD/luna_chronicle.py
EOF
cat > "$UDIR/luna-chronicle.timer" <<'EOF'
[Unit]
Description=Run Luna's Night Chronicle nightly (the night that just ended)

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now luna-chronicle.timer
systemctl --user list-timers luna-chronicle.timer --no-pager || true
echo
echo "Smoke test (dry, no DB write):"
echo "  set -a; [ -n '${ENVF:-}' ] && . '${ENVF:-/dev/null}'; set +a; $PY $WD/luna_chronicle.py --dry \$(date -d yesterday +%F)"
