#!/usr/bin/env bash
# Local preview for this portfolio (needs http:// — not file://).
cd "$(dirname "$0")"

PORT="${1:-8080}"

# If default port is busy, try the next few ports.
if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Python not found. Install Python or run: npx serve . -p $PORT"
  exit 1
fi

port_free() {
  "$PY" -c "import socket; s=socket.socket(); s.bind(('', $1)); s.close()" 2>/dev/null
}

if ! port_free "$PORT"; then
  echo "Port $PORT is in use — trying another port..."
  for try in 8081 8082 5500 5501 3000; do
    if port_free "$try"; then
      PORT="$try"
      break
    fi
  done
  if ! port_free "$PORT"; then
    echo "Could not find a free port. Stop the old server (Ctrl+C in its terminal) or run:"
    echo "  ./serve.sh 9000"
    exit 1
  fi
fi

echo ""
echo "  Portfolio preview:"
echo "  http://127.0.0.1:${PORT}/"
echo ""
echo "  Open in browser (Mac):"
echo "  open \"http://127.0.0.1:${PORT}/\""
echo ""
echo "  Keep this terminal open. Press Ctrl+C to stop."
echo ""

exec "$PY" -m http.server "$PORT"
