#!/bin/bash
# sync-stats-cron.sh - Daily stats sync from FUTGAL/futbuteo
# Run via cron: 0 8 * * * /Volumes/TOSHIBA\ EXT2/PROYECTOS/AnosaVina/sync-stats-cron.sh >> /tmp/sada-sync.log 2>&1

cd "/Volumes/TOSHIBA EXT2/PROYECTOS/AnosaVina"

echo "========================================"
echo "Sada CF Stats Sync - $(date)"
echo "========================================"

# The stats need to be updated manually after each match
# This script checks for new results and prompts for update
# 
# To add stats after a match, run:
# curl -X POST https://sada-cf-portal.onrender.com/api/sync-stats \
#   -H "Content-Type: application/json" \
#   -d '{"stats":[{"name":"Ferro","goals":2},{"name":"Damián","goals":1}]}'

# Check if there are new results on the server
echo "Checking for new results..."
NEW_RESULTS=$(curl -s "https://sada-cf-portal.onrender.com/api/init" | python3 -c "
import json, sys
data = json.load(sys.stdin)
results = data.get('results', [])
# Find results after 2026-09-05 (our last known sync)
for r in results:
    if r['date'] > '2026-09-05':
        print(f\"{r['home']} {r['homeScore']}-{r['awayScore']} {r['away']}\")
" 2>/dev/null)

if [ -n "$NEW_RESULTS" ]; then
    echo "New results found:"
    echo "$NEW_RESULTS"
    echo ""
    echo "Update stats with:"
    echo 'curl -X POST https://sada-cf-portal.onrender.com/api/sync-stats -H "Content-Type: application/json" -d '"'"'{"stats":[{"name":"PlayerName","goals":N,"yellowCards":N}]}'"'"''
else
    echo "No new results to process."
fi

echo ""
echo "Sync check complete at $(date)"
