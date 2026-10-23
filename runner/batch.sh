#!/bin/sh
# batch.sh <agent> <from> <to>: trials from..to of every condition, interleaved
# so a change in the service during the batch hits all conditions alike.
agent=$1; from=$2; to=$3
cd "$(dirname "$0")"
i=$from
while [ $i -le $to ]; do
  for c in baseline bare seisin; do
    [ -f "${DD_RUNS:-$HOME/Library/Caches/denial-detours/runs}/$agent/$c/r$i/meta.json" ] && continue
    node trial.mjs "$agent" "$c" "r$i" || echo "{\"agent\":\"$agent\",\"condition\":\"$c\",\"id\":\"r$i\",\"error\":true}"
  done
  i=$((i+1))
done
