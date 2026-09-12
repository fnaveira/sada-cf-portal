const puppeteer = require('puppeteer');
const { createClient } = require('@libsql/client');

const FUTGAL_URL = 'https://intranet.futgal.es/nfg/';
const USER = 'P13892';
const PASS = 'Platino1931';

const db = createClient({
  url: process.env.TURSO_URL || 'libsql://sada-anosavina-fnaveira.aws-ap-northeast-1.turso.io',
  authToken: process.env.TURSO_TOKEN,
});

const WAIT = (ms) => new Promise(r => setTimeout(r, ms));

// FUTGAL player ID -> our player nickname
const FUTGAL_MAP = {
  4545037: 'Charlie',
  86126: 'Miguel',
  81301: 'Boo',
  25217: 'Caamaño',
  9781918: 'Durán',
  39880: 'Pirulo',
  39881: 'Cabana',
  45245: 'Ferro',
  33460: 'César',
  33461: 'Garea',
  41107: 'Bernardo',
  108020: 'Graña',
  28369765: 'Marcos',
  7344010: 'Lata',
  7343840: 'Pepe',
  80216: 'Alfonso',
  106700: 'Mourelo',
  116203: 'Damián',
  56475: 'Roibás',
  39879: 'Santi',
  87776: 'Sergio',
  90618: 'Toni',
  40747: 'Julio',
  18231689: 'Vizoso',
  27599289: 'Fran',
  17298560: 'Albarracin',
};

async function login(page) {
  console.log('🔐 Logging in...');
  await page.goto(FUTGAL_URL, { waitUntil: 'networkidle2', timeout: 30000 });

  const result = await page.evaluate(async () => {
    document.getElementById('NUser').value = 'P13892';
    document.getElementById('NPass').value = 'Platino1931';
    var datos = N_GetFormFields('NLogin');
    const res = await fetch('/nfg/NLogin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: datos + '&LoginAjax=1',
    });
    return await res.text();
  });

  if (result.includes('estado="1"')) {
    console.log('✅ Login OK');
    await page.goto(FUTGAL_URL + 'NPortada', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await WAIT(2000);
  } else {
    throw new Error('Login failed');
  }
}

async function getMatchesWithActas(page) {
  console.log('\n📋 Searching for matches with actas...');
  
  // Check Liga
  const ligaUrl = 'https://intranet.futgal.es/nfg/NPcd/NFG_CmpJornada?cod_primaria=1000128&CodCompeticion=26991153&CodGrupo=28251751&CodTemporada=22';
  await page.goto(ligaUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await WAIT(3000);

  const jornadas = await page.evaluate(() => {
    const sel = document.querySelector('select[name="jornada"]');
    if (!sel) return [];
    return [...sel.options].filter(o => o.value).map(o => ({ value: o.value, text: o.text.trim() }));
  });

  const matches = [];
  
  for (const jornada of jornadas) {
    // Skip future jornadas (no actas yet)
    const dateStr = jornada.text.match(/(\d{2}-\d{2}-\d{4})/);
    if (dateStr) {
      const parts = dateStr[1].split('-');
      const jDate = new Date(parts[2], parts[1]-1, parts[0]);
      if (jDate > new Date()) {
        console.log(`  Skipping Liga ${jornada.text} (future)`);
        continue;
      }
    }

    console.log(`  Checking Liga ${jornada.text}...`);
    const url = `${ligaUrl}&CodJornada=${jornada.value}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    await WAIT(2000);

    // Find acta links
    const actas = await page.evaluate(() => {
      return [...document.querySelectorAll('a')]
        .map(a => ({ href: a.getAttribute('href') || '', text: a.textContent.trim() }))
        .filter(l => l.href.includes('CmpPrevio'))
        .map(l => {
          const m = l.href.match(/CodActa=(\d+)/);
          return m ? m[1] : null;
        })
        .filter(Boolean);
    });

    // For each acta, check if it's our match
    for (const actaId of actas) {
      const previoUrl = `https://intranet.futgal.es/nfg/NPcd/NFG_CmpPrevio?cod_primaria=1000128&CodActa=${actaId}`;
      await page.goto(previoUrl, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});

      const matchInfo = await page.evaluate(() => {
        const html = document.body.innerHTML;
        const teamRegex = /class="tituloprograma"[^>]*>([^<]+)/g;
        const teams = [];
        let m;
        while ((m = teamRegex.exec(html)) !== null) teams.push(m[1].trim());
        const isOurMatch = teams.some(t => t.includes('SADA F.C.') || t.includes('NOSA VI'));
        return { actaId: '', teams, isOurMatch };
      });

      if (matchInfo.isOurMatch) {
        matches.push({ actaId, competition: 'Liga', jornada: jornada.text, teams: matchInfo.teams });
        console.log(`    ✅ Found: ${matchInfo.teams.join(' vs ')} (Acta ${actaId})`);
      }
    }
  }

  // Check Copa
  const copaUrl = 'https://intranet.futgal.es/nfg/NPcd/NFG_CmpJornada?cod_primaria=1000128&CodCompeticion=26991557&CodGrupo=26991558&CodTemporada=22';
  await page.goto(copaUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await WAIT(3000);

  const copaJornadas = await page.evaluate(() => {
    const sel = document.querySelector('select[name="jornada"]');
    if (!sel) return [];
    return [...sel.options].filter(o => o.value).map(o => ({ value: o.value, text: o.text.trim() }));
  });

  for (const jornada of copaJornadas) {
    // Skip future jornadas
    const dateStr = jornada.text.match(/(\d{2}-\d{2}-\d{4})/);
    if (dateStr) {
      const parts = dateStr[1].split('-');
      const jDate = new Date(parts[2], parts[1]-1, parts[0]);
      if (jDate > new Date()) {
        console.log(`  Skipping Copa ${jornada.text} (future)`);
        continue;
      }
    }

    console.log(`  Checking Copa ${jornada.text}...`);
    // Need to check both pages
    for (let pg = 1; pg <= 3; pg++) {
      const url = `${copaUrl}&CodJornada=${jornada.value}&NPcd_Page=${pg}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await WAIT(2000);

      const actas = await page.evaluate(() => {
        return [...document.querySelectorAll('a')]
          .map(a => ({ href: a.getAttribute('href') || '' }))
          .filter(l => l.href.includes('CmpPrevio'))
          .map(l => {
            const m = l.href.match(/CodActa=(\d+)/);
            return m ? m[1] : null;
          })
          .filter(Boolean);
      });

      if (actas.length === 0) break; // No more pages

      for (const actaId of actas) {
      const previoUrl = `https://intranet.futgal.es/nfg/NPcd/NFG_CmpPrevio?cod_primaria=1000128&CodActa=${actaId}`;
      await page.goto(previoUrl, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      await WAIT(1500);

      const matchInfo = await page.evaluate(() => {
          const html = document.body.innerHTML;
          const teamRegex = /class="tituloprograma"[^>]*>([^<]+)/g;
          const teams = [];
          let m;
          while ((m = teamRegex.exec(html)) !== null) teams.push(m[1].trim());
          const isOurMatch = teams.some(t => t.includes('SADA F.C.') || t.includes('NOSA VI'));
          return { teams, isOurMatch };
        });

        if (matchInfo.isOurMatch) {
          matches.push({ actaId, competition: 'Copa', jornada: jornada.text, teams: matchInfo.teams });
          console.log(`    ✅ Found: ${matchInfo.teams.join(' vs ')} (Acta ${actaId})`);
        }
      }
    }
  }

  return matches;
}

async function getActaStats(page, actaId) {
  console.log(`\n📄 Fetching stats for acta ${actaId}...`);
  const url = `https://intranet.futgal.es/nfg/NPcd/NFG_CMP_Alineacion_Resultados?cod_primaria=1000128&codacta=${actaId}`;
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await WAIT(3000);

  const stats = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    const results = { sadaPlayers: [], rivalPlayers: [], goals: {}, cards: {} };

    for (const table of tables) {
      const text = table.innerText;
      const isSada = text.includes('SADA F.C.');
      const rows = table.querySelectorAll('tr');

      for (const row of rows) {
        const cells = [...row.querySelectorAll('td')];
        if (cells.length >= 4) {
          const num = cells[0]?.textContent?.trim();
          const name = cells[1]?.textContent?.trim();
          const a1 = cells[2]?.textContent?.trim(); // A (amarillas)
          const a2 = cells[3]?.textContent?.trim(); // A (segunda amarilla / doble)
          const r = cells[4]?.textContent?.trim();  // R (rojas)

          if (name && name.length > 3 && num && /^\d+$/.test(num)) {
            const player = { num, name, yellow: 0, red: 0 };
            if (a1 && a1 !== '' && a1 !== '\u00a0') player.yellow++;
            if (a2 && a2 !== '' && a2 !== '\u00a0') player.yellow++;
            if (r && r !== '' && r !== '\u00a0') player.red++;

            if (isSada) {
              results.sadaPlayers.push(player);
            } else {
              results.rivalPlayers.push(player);
            }
          }
        }
      }
    }

    // Check for goals section
    const bodyText = document.body.innerText;
    const goalSection = bodyText.match(/GOLES[\s\S]*?(?=TARJETAS|SUSTITUCION|EQUIPO ARBITRAL|$)/i);
    if (goalSection) {
      // Parse goals: pattern "0 - 1  PLAYER NAME (5')"
      const goalRegex = /(\d+)\s*-\s*(\d+)\s+([A-ZÁÉÍÓÚÑ\s,\.]+?)\s*\((\d+)/g;
      let m;
      while ((m = goalRegex.exec(goalSection[0])) !== null) {
        const scorer = m[3].trim();
        const minute = m[4];
        if (!results.goals[scorer]) results.goals[scorer] = 0;
        results.goals[scorer]++;
      }
    }

    return results;
  });

  return stats;
}

async function updateDB(stats) {
  console.log('\n💾 Updating database...');
  
  for (const [futgalName, count] of Object.entries(stats.goals)) {
    // Find matching player
    const futgalId = Object.entries(FUTGAL_MAP).find(([id, nick]) => {
      const nameUpper = futgalName.toUpperCase();
      return nameUpper.includes(nick.toUpperCase()) || nick.toUpperCase().includes(nameUpper.split(',')[0]);
    });

    if (futgalId) {
      const nickname = futgalId[1];
      try {
        const player = (await db.execute({
          sql: 'SELECT id, goals FROM players WHERE LOWER(nickname)=?',
          args: [nickname.toLowerCase()]
        })).rows[0];

        if (player) {
          const newGoals = Math.max(player.goals || 0, count);
          await db.execute({
            sql: 'UPDATE players SET goals=? WHERE id=?',
            args: [newGoals, player.id]
          });
          console.log(`  ⚽ ${nickname}: ${newGoals} goles`);
        }
      } catch (e) {
        console.error(`  ❌ Error updating ${nickname}:`, e.message);
      }
    } else {
      console.log(`  ⚠️ Could not map FUTGAL name: ${futgalName}`);
    }
  }

  for (const player of [...stats.sadaPlayers]) {
    const futgalEntry = Object.entries(FUTGAL_MAP).find(([id, nick]) => {
      return player.name.toUpperCase().includes(nick.toUpperCase()) ||
             nick.toUpperCase().includes(player.name.split(',')[0].trim().toUpperCase());
    });

    if (futgalEntry) {
      const nickname = futgalEntry[1];
      try {
        const dbPlayer = (await db.execute({
          sql: 'SELECT id, yellowCards, redCards FROM players WHERE LOWER(nickname)=?',
          args: [nickname.toLowerCase()]
        })).rows[0];

        if (dbPlayer) {
          const newY = Math.max(dbPlayer.yellowCards || 0, player.yellow);
          const newR = Math.max(dbPlayer.redCards || 0, player.red);
          if (newY !== dbPlayer.yellowCards || newR !== dbPlayer.redCards) {
            await db.execute({
              sql: 'UPDATE players SET yellowCards=?, redCards=? WHERE id=?',
              args: [newY, newR, dbPlayer.id]
            });
            if (newY > 0) console.log(`  🟨 ${nickname}: ${newY} amarillas`);
            if (newR > 0) console.log(`  🟥 ${nickname}: ${newR} rojas`);
          }
        }
      } catch (e) {
        console.error(`  ❌ Error updating cards for ${nickname}:`, e.message);
      }
    }
  }
}

(async () => {
  console.log('⚽ FUTGAL Scraper - Sada CF');
  console.log('===========================\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    await login(page);

    const matches = await getMatchesWithActas(page);
    console.log(`\n📊 Found ${matches.length} matches with our team`);

    for (const match of matches) {
      const stats = await getActaStats(page, match.actaId);
      
      const hasData = stats.sadaPlayers.some(p => p.yellow > 0 || p.red > 0) ||
                      Object.keys(stats.goals).length > 0;
      
      if (hasData) {
        console.log(`  Stats found: ${JSON.stringify(stats.goals)} goals, cards for ${stats.sadaPlayers.length} players`);
        await updateDB(stats);
      } else {
        console.log(`  No stats yet (acta not filled by referee)`);
      }
    }

    console.log('\n✅ Scraping complete');
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await browser.close();
  }
})();
