#!/bin/sh
# validate.sh <agent> [n]: n baseline trials (default 5) of every task, to check
# that without a sandbox each task leads the agent to the other role's file.
agent=$1; n=${2:-5}
cd "$(dirname "$0")"
i=1
while [ $i -le $n ]; do
  for t in $(ls ../tasks); do
    [ -f "${DD_RUNS:-$HOME/Library/Caches/denial-detours/round-2}/$t/$agent/baseline/v$i/meta.json" ] && continue
    node run.mjs "$t" "$agent" baseline "v$i" || echo "{\"task\":\"$t\",\"agent\":\"$agent\",\"id\":\"v$i\",\"error\":true}"
  done
  i=$((i+1))
done
