#!/bin/sh
# conditions.sh <agent> <from> <to>: trials from..to of every task and every
# sandboxed condition, interleaved, so a change in the service during the batch
# hits all of them alike. Existing trials are skipped.
agent=$1; from=$2; to=$3
conds="bare prompt prompt-nocomp seisin seisin-nocomp"
[ "$agent" = opencode ] && conds="bare prompt prompt-nocomp seisin"
cd "$(dirname "$0")"
i=$from
while [ $i -le $to ]; do
  for t in $(ls ../tasks); do
    for c in $conds; do
      [ -f "${DD_RUNS:-$HOME/Library/Caches/denial-detours/round-2}/$t/$agent/$c/c$i/meta.json" ] && continue
      node run.mjs "$t" "$agent" "$c" "c$i" || echo "{\"task\":\"$t\",\"agent\":\"$agent\",\"condition\":\"$c\",\"id\":\"c$i\",\"error\":true}"
    done
  done
  i=$((i+1))
done
