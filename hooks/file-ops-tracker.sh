#!/bin/bash
set -e

input=$(cat)

tool_name=$(echo "$input" | jq -r '.tool_name // empty')
session_id=$(echo "$input" | jq -r '.session_id // "default"')
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

if [[ -z "$file_path" ]]; then
    echo '{"result":"continue"}'
    exit 0
fi

case "$tool_name" in
    Read|read)
        op_type="read"
        ;;
    Edit|Write|edit|write)
        op_type="modified"
        ;;
    *)
        echo '{"result":"continue"}'
        exit 0
        ;;
esac

state_dir="$CLAUDE_PROJECT_DIR/.claude/state/sessions/$session_id"
state_file="$state_dir/file-ops.json"

mkdir -p "$state_dir"

if [[ ! -f "$state_file" ]]; then
    echo "{\"sessionId\":\"$session_id\",\"started\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"files\":{\"read\":[],\"modified\":[]}}" > "$state_file"
fi

if ! jq -e ".files.$op_type | index(\"$file_path\")" "$state_file" > /dev/null 2>&1; then
    tmp_file=$(mktemp)
    jq ".files.$op_type += [\"$file_path\"]" "$state_file" > "$tmp_file"
    mv "$tmp_file" "$state_file"
fi

echo '{"result":"continue"}'
exit 0
