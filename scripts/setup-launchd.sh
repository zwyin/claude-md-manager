#!/bin/bash
# Set up launchd auto-start for claude-md-manager dashboard.
# Usage: ./scripts/setup-launchd.sh
set -euo pipefail

PLIST_NAME="com.zhiweiyin.claude-md-manager"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WEB_DIR="${PROJECT_DIR}/web"
LOG_DIR="${PROJECT_DIR}/logs"

# Detect arm64 homebrew Node
NPX_PATH="/opt/homebrew/bin/npx"
if [ ! -x "$NPX_PATH" ]; then
    NPX_PATH="/usr/local/bin/npx"
    echo "Warning: Using x86_64 npx at $NPX_PATH"
fi

mkdir -p "$LOG_DIR"

# Rotate logs: keep last 500 lines to prevent unbounded growth
for log in "$LOG_DIR"/stdout.log "$LOG_DIR"/stderr.log; do
    if [ -f "$log" ] && [ "$(wc -l < "$log")" -gt 500 ]; then
        tail -500 "$log" > "${log}.tmp" && mv "${log}.tmp" "$log"
        echo "Rotated $log (kept last 500 lines)"
    fi
done

cat > "$PLIST_PATH" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NPX_PATH}</string>
        <string>next</string>
        <string>start</string>
        <string>-H</string>
        <string>0.0.0.0</string>
        <string>-p</string>
        <string>3456</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${WEB_DIR}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>ThrottleInterval</key>
    <integer>5</integer>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/stdout.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
PLIST

echo "Wrote $PLIST_PATH"

# Unload old if exists, then load new
launchctl bootout "gui/$(id -u)/${PLIST_NAME}" 2>/dev/null || true
launchctl bootstrap "$(id -u)" "$PLIST_PATH"

echo "Started. Dashboard: http://localhost:3456"
echo "Logs: ${LOG_DIR}/"
echo "Manage: launchctl kickstart -k gui/\$(id -u)/${PLIST_NAME}"
