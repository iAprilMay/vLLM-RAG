#!/usr/bin/env bash
# uninstall.sh — one-command rollback for the vLLM RAG prompt-preprocessor plugin.
#
# Removes the *installed* copy of the plugin (the thing `lms dev --install` created
# under LM Studio's extensions tree). It does NOT touch this source folder, and it
# never touches the running model or the engine's own state.
#
# Usage:
#   scripts/uninstall.sh              # uninstall from LM Studio (and Bionic if present)
#   scripts/uninstall.sh --purge-config   # also drop the plugin's saved settings
#   scripts/uninstall.sh --keep-config    # default: leave settings on disk
#
# Config is keyed by "owner/name" in ~/.lmstudio/.internal/global-plugin-configs.json.
# It is left in place by default so a later reinstall keeps your settings. --purge-config
# only edits that file when the LM Studio server is OFF (editing it while the app runs
# can be clobbered on exit).
set -euo pipefail

OWNER="local"
NAME="vllm-rag"
ID="${OWNER}/${NAME}"

PURGE_CONFIG=0
for arg in "$@"; do
  case "$arg" in
    --purge-config) PURGE_CONFIG=1 ;;
    --keep-config)  PURGE_CONFIG=0 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

# Resolve LM Studio home the same way the app/CLI does (honour the home pointer).
HOME_DIR="${HOME}"
if [ -f "${HOME_DIR}/.lmstudio-home-pointer" ]; then
  LMSTUDIO_HOME="$(tr -d '[:space:]' < "${HOME_DIR}/.lmstudio-home-pointer")"
else
  LMSTUDIO_HOME="${HOME_DIR}/.lmstudio"
fi

if [ ! -d "$LMSTUDIO_HOME" ]; then
  echo "LM Studio home not found at $LMSTUDIO_HOME — nothing to uninstall." >&2
  exit 0
fi

removed_any=0
remove_dir() {
  local dir="$1"
  if [ -d "$dir" ]; then
    rm -rf -- "$dir"
    echo "removed: $dir"
    removed_any=1
  else
    echo "not installed: $dir"
  fi
}

# LM Studio and Bionic keep separate plugin trees.
remove_dir "${LMSTUDIO_HOME}/extensions/plugins/${OWNER}/${NAME}"
remove_dir "${LMSTUDIO_HOME}/apps/bionic/extensions/plugins/${OWNER}/${NAME}"

if [ "$PURGE_CONFIG" -eq 1 ]; then
  CFG="${LMSTUDIO_HOME}/.internal/global-plugin-configs.json"
  if [ -f "$CFG" ]; then
    echo "note: config key ${ID} left in $CFG — remove it in the UI, or edit that file"
    echo "      only while LM Studio is OFF."
  fi
fi

[ "$removed_any" -eq 1 ] && echo "done." || echo "nothing was installed."
