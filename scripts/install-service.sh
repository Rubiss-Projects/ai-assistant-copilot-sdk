#!/usr/bin/env bash
# Run once with: sudo bash scripts/install-service.sh
set -euo pipefail

SERVICE_FILE="$(cd "$(dirname "$0")/.." && pwd)/ai-assistant.service"
DEST="/etc/systemd/system/ai-assistant.service"

echo "Installing $SERVICE_FILE → $DEST"
cp "$SERVICE_FILE" "$DEST"
chmod 644 "$DEST"

systemctl daemon-reload
systemctl enable ai-assistant
systemctl start ai-assistant

echo ""
echo "✅ Service installed and started."
echo "   Check status : sudo systemctl status ai-assistant"
echo "   Follow logs  : sudo journalctl -u ai-assistant -f"
echo "   Stop         : sudo systemctl stop ai-assistant"
echo "   Restart      : sudo systemctl restart ai-assistant"
