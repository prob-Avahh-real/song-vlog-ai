#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[[ ! -d node_modules ]] && npm install
npm run build
echo "🎬 曲影 AI · http://localhost:8888"
npm run preview
