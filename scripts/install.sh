#!/usr/bin/env bash
# install.sh — one-command install for the vLLM RAG prompt-preprocessor plugin.
#
# Installs the plugin into LM Studio's extensions tree via the supported path
# (`lms dev --install -y`), which compiles the .lmstudio/production.js bundle and
# registers it under extensions/plugins/local/vllm-rag. It never patches an app
# file, never touches the engine's own state, and never loads weights.
#
# Usage:
#   scripts/install.sh              # npm install + lms dev --install -y
#
# After installing, LM Studio must be RESTARTED, then this plugin ENABLED and the
# built-in lmstudio/rag-v1 DISABLED (exactly one prompt preprocessor may run per chat).
set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Resolve the LM Studio home the same way the app/CLI does (honour the home pointer),
# so the right lms binary can be pointed at.
HOME_DIR="${HOME}"
if [ -f "${HOME_DIR}/.lmstudio-home-pointer" ]; then
  LMSTUDIO_HOME="$(tr -d '[:space:]' < "${HOME_DIR}/.lmstudio-home-pointer")"
else
  LMSTUDIO_HOME="${HOME_DIR}/.lmstudio"
fi

LMS_BIN="${LMS_BIN:-${LMSTUDIO_HOME}/bin/lms}"
if [ ! -x "$LMS_BIN" ]; then
  echo "lms CLI not found at $LMS_BIN — set LMS_BIN to your LM Studio lms path." >&2
  exit 1
fi

echo "plugin dir: $PLUGIN_DIR"
echo "installing from $PLUGIN_DIR ..."

# Fetch deps (the @lmstudio/sdk), then install persistently via the supported path.
( cd "$PLUGIN_DIR" && npm install )
( cd "$PLUGIN_DIR" && "$LMS_BIN" dev --install -y )

echo
echo "Installed: ${LMSTUDIO_HOME}/extensions/plugins/local/vllm-rag"
echo "Restart LM Studio, then ENABLE vLLM RAG and DISABLE the built-in lmstudio/rag-v1."
