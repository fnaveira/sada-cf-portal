#!/bin/bash
# sync-stats-cron.sh - Daily stats sync from FUTGAL via Puppeteer
# Run via launchd: com.sada.sync-stats
# Or manually: bash sync-stats-cron.sh

cd "/Volumes/TOSHIBA EXT2/PROYECTOS/AnosaVina"

echo "========================================"
echo "Sada CF FUTGAL Scraper - $(date)"
echo "========================================"

# Ensure TURSO env vars are set
export TURSO_URL="${TURSO_URL:-libsql://sada-anosavina-fnaveira.aws-ap-northeast-1.turso.io}"

# Run the scraper
node scrape-futgal.js 2>&1

echo ""
echo "Scraping complete at $(date)"
