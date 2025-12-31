#!/bin/bash
set -e
cd "${CLAUDE_PLUGIN_ROOT:-$(dirname "$0")/..}/hooks"
cat | node dist/batch-handoff-enforcer.mjs
