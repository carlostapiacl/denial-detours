#!/bin/sh
# guard.sh <week%> <session%>: every 10 minutes, read Claude's usage and stop the
# Claude batches when either limit is reached, so the experiment never eats the
# quota the person needs for their own work. Logs every reading.
wk=$1; ss=$2
while pgrep -f "conditions.sh claude|validate.sh claude" >/dev/null; do
  u=$(cd /tmp && claude -p "/usage" 2>/dev/null)
  w=$(printf '%s' "$u" | sed -n 's/.*Current week (all models): \([0-9]*\)%.*/\1/p')
  s=$(printf '%s' "$u" | sed -n 's/.*Current session: \([0-9]*\)%.*/\1/p')
  echo "$(date +%H:%M) week ${w:-?}% session ${s:-?}%"
  if [ -n "$w" ] && [ "$w" -ge "$wk" ] || { [ -n "$s" ] && [ "$s" -ge "$ss" ]; }; then
    pkill -f "conditions.sh claude"; pkill -f "validate.sh claude"; pkill -f "run.mjs [a-z-]* claude"
    echo "$(date +%H:%M) stopped: limit reached"; exit 0
  fi
  sleep 600
done
