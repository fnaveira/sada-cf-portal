#!/usr/bin/env node
// sync-stats.js - Scrapes futbuteo.com for player stats and updates the database
// Run: node sync-stats.js

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { createClient } = require('@libsql/client');

const TURSO_URL = process.env.TURSO_URL || 'libsql://sada-anosavina-fnaveira.aws-ap-northeast-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_TOKEN;
const API_URL = process.env.API_URL || 'https://sada-cf-portal.onrender.com';

const db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

// Our team ID on futbuteo: 4261861
const TEAM_ID = 4261861;
const TEAM_NAME = 'Sada F.C. a Nosa Viña';

async function fetchTeamStats() {
  console.log('📊 Fetching stats from futbuteo.com...');

  // Fetch the team page
  const url = `https://futbuteo.com/galicia/equipo/${TEAM_ID}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'es-ES,es;q=0.9',
    }
  });

  if (!res.ok) {
    console.error(`Failed to fetch team page: ${res.status}`);
    return null;
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const players = [];

  // Look for player rows in the squad/stats table
  $('table tr').each((i, row) => {
    const cells = $(row).find('td');
    if (cells.length >= 3) {
      const name = $(cells[1]).text().trim() || $(cells[0]).text().trim();
      if (name && name.length > 2) {
        players.push({ name });
      }
    }
  });

  return players;
}

async function fetchMatchActas() {
  console.log('📋 Fetching match actas...');

  // Fetch our matches from the competition page
  // Copa: copa-a-coruna-veteranos, Liga: primera-division-veteranos
  const competitions = [
    'copa-a-coruna-veteranos',
    'primera-division-veteranos'
  ];

  const actas = [];

  for (const comp of competitions) {
    try {
      const url = `https://futbuteo.com/galicia/resultados/veteranos-copa/${comp}/`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html',
        }
      });

      if (!res.ok) continue;

      const html = await res.text();

      // Extract JSON-LD data which has match info
      const jsonLdMatch = html.match(/"itemListElement":\s*\[(.*?)\]/s);
      if (jsonLdMatch) {
        try {
          const items = JSON.parse(`[${jsonLdMatch[1]}]`);
          for (const item of items) {
            if (item.item && item.item.competitor) {
              const teams = item.item.competitor.map(c => c.name);
              if (teams.some(t => t.toLowerCase().includes('sada'))) {
                actas.push({
                  url: item.url,
                  home: item.item.homeTeam?.name || '',
                  away: item.item.awayTeam?.name || '',
                  date: item.item.startDate?.split('T')[0] || '',
                });
              }
            }
          }
        } catch (e) {}
      }
    } catch (e) {
      console.error(`Error fetching ${comp}:`, e.message);
    }
  }

  return actas;
}

async function fetchActaDetails(actaUrl) {
  console.log(`  📄 Fetching acta: ${actaUrl}`);

  const res = await fetch(actaUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html',
    }
  });

  if (!res.ok) return null;

  const html = await res.text();
  const $ = cheerio.load(html);

  const stats = { goals: {}, yellowCards: {}, redCards: {} };

  // Parse goals section
  const goalsSection = html.match(/GOLES[\s\S]*?(?=ESTADIO|SUSTITUCIONES|$)/i);
  if (goalsSection) {
    // Pattern: "0 - 1  FERRO ROZAS, GONZALO (5')"
    const goalRegex = /(\d+)\s*-\s*(\d+)\s+([A-ZÁÉÍÓÚÑ\s,]+?)\s*\((\d+)/gi;
    let match;
    while ((match = goalRegex.exec(goalsSection[0])) !== null) {
      const scorerName = match[3].trim().toLowerCase();
      if (scorerName.includes('FERRO') || scorerName.includes('ROZAS')) {
        stats.goals['Ferro'] = (stats.goals['Ferro'] || 0) + 1;
      }
      // Add more name mappings as needed
    }
  }

  // Parse cards section
  const cardsSection = html.match(/TARJETAS[\s\S]*?(?=CUERPO|$)/i);
  if (cardsSection) {
    const yellowRegex = /🟨\s*([A-ZÁÉÍÓÚÑ\s,]+?)\s*\((\d+)/gi;
    let match;
    while ((match = yellowRegex.exec(cardsSection[0])) !== null) {
      const playerName = match[1].trim();
      stats.yellowCards[playerName] = (stats.yellowCards[playerName] || 0) + 1;
    }
  }

  return stats;
}

// Name normalization map: FUTGAL full name -> our player nickname/name
const NAME_MAP = {
  'FERRO ROZAS, GONZALO': 'Ferro',
  'GAREA PARGA, MIGUEL A': 'Garea',
  'AMOR HAZ, MIGUEL': 'Miguel',
  'FERRO ROZAS, GONZALO': 'Ferro',
  'BOO FERNANDEZ, MIGUEL A': 'Boo',
  'TEIXEIRA FERNANDEZ, JULIO J': 'Julio',
  'GOMEZ CAGIAO, ENRIQUE BERNARDO': 'Bernardo',
  'MALLO LOPEZ, JOSE LUIS': 'Pepe',
  'SEOANE BARROS, ANTONIO M': 'Toni',
  'PARIS LABANDEIRA, DAMIAN': 'Damián',
  'ROIBAS NAVEIRO, ALBERTO': 'Roibás',
  'ALFONSO': 'Alfonso',
  'CHARLIE': 'Charlie',
  'CABANA': 'Cabana',
  'VIZOSO': 'Vizoso',
  'JULIO': 'Julio',
  'ALBARRACIN': 'Albarracin',
  'MARCOS': 'Marcos',
  'DAMIÁN': 'Damián',
  'SERGIO': 'Sergio',
  'SANTI': 'Santi',
  'Mourelo': 'Mourelo',
  'Lata': 'Lata',
  'DURÁN': 'Durán',
};

function normalizePlayerName(rawName) {
  const upper = rawName.toUpperCase().trim();
  // Try direct map
  if (NAME_MAP[upper]) return NAME_MAP[upper];
  // Try partial match
  for (const [key, val] of Object.entries(NAME_MAP)) {
    if (upper.includes(key) || key.includes(upper)) return val;
  }
  return rawName;
}

async function updatePlayerStats(playerName, goals, yellowCards, redCards) {
  try {
    // Find player by name or nickname
    const result = await db.execute({
      sql: 'SELECT id, goals, yellowCards, redCards FROM players WHERE LOWER(name) LIKE ? OR LOWER(nickname) LIKE ?',
      args: [`%${playerName.toLowerCase()}%`, `%${playerName.toLowerCase()}%`]
    });

    if (result.rows.length > 0) {
      const player = result.rows[0];
      const newGoals = Math.max(player.goals || 0, goals);
      const newYellow = Math.max(player.yellowCards || 0, yellowCards);
      const newRed = Math.max(player.redCards || 0, redCards);

      if (newGoals !== player.goals || newYellow !== player.yellowCards || newRed !== player.redCards) {
        await db.execute({
          sql: 'UPDATE players SET goals=?, yellowCards=?, redCards=? WHERE id=?',
          args: [newGoals, newYellow, newRed, player.id]
        });
        console.log(`  ✅ Updated ${playerName}: G${newGoals} Y${newYellow} R${newRed}`);
      }
    }
  } catch (e) {
    console.error(`  ❌ Error updating ${playerName}:`, e.message);
  }
}

async function main() {
  console.log('⚽ Sada CF Stats Sync');
  console.log('====================\n');

  // For now, we'll manually set the stats from the acta the user provided
  // In the future, this will scrape futbuteo.com

  console.log('📋 Processing Copa match: C.D. Larín 1-4 Sada (05-09-2026)');
  console.log('  Goals: Ferro x2 (5\', 11\'), Damián Paris (21\'), Boo (90\'+1)');
  console.log('  Yellow: Julio Teixeira (67\')\n');

  // Update from the known acta
  const matchStats = [
    { name: 'Ferro', goals: 2, yellow: 0, red: 0 },
    { name: 'Damián', goals: 1, yellow: 0, red: 0 },
    { name: 'Boo', goals: 1, yellow: 0, red: 0 },
    { name: 'Julio', goals: 0, yellow: 1, red: 0 },
  ];

  for (const stat of matchStats) {
    await updatePlayerStats(stat.name, stat.goals, stat.yellow, stat.red);
  }

  console.log('\n✅ Sync complete!');
}

main().catch(console.error);
