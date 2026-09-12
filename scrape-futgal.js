const puppeteer = require('puppeteer');
const { createClient } = require('@libsql/client');

const FUTGAL_URL = 'https://intranet.futgal.es/nfg/';
const LIGA = { cod_primaria: '1000128', CodCompeticion: '26991153', CodGrupo: '28251751', CodTemporada: '22' };
const COPA = { cod_primaria: '1000128', CodCompeticion: '26991557', CodGrupo: '26991558', CodTemporada: '22' };

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://sada-anosavina-fnaveira.aws-ap-northeast-1.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const WAIT = (ms) => new Promise(r => setTimeout(r, ms));

const FUTGAL_MAP = {
  4545037: 'Charlie', 86126: 'Miguel', 81301: 'Boo', 25217: 'Caamaño',
  9781918: 'Durán', 39880: 'Pirulo', 39881: 'Cabana', 45245: 'Ferro',
  33460: 'César', 33461: 'Garea', 41107: 'Bernardo', 108020: 'Graña',
  28369765: 'Marcos', 7344010: 'Lata', 7343840: 'Pepe', 80216: 'Alfonso',
  106700: 'Mourelo', 116203: 'Damián', 56475: 'Roibás', 39879: 'Santi',
  87776: 'Sergio', 90618: 'Toni', 40747: 'Julio', 18231689: 'Vizoso',
  27599289: 'Fran', 17298560: 'Albarracin',
};

const REVERSE_MAP = {};
for (const [id, nick] of Object.entries(FUTGAL_MAP)) REVERSE_MAP[nick.toLowerCase()] = parseInt(id);

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
    const urlMatch = result.match(/NURL="([^"]+)"/);
    const redirectUrl = urlMatch ? urlMatch[1] : FUTGAL_URL + 'NPortada';
    await page.goto(redirectUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await WAIT(2000);
    console.log('✅ Login OK - URL:', page.url());
  } else {
    throw new Error('Login failed');
  }
}

async function safeGoto(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await WAIT(2000);
}

function parseGoalsFromText(text) {
  const goals = {};
  const goalRegex = /(\d+)\s*-\s*(\d+)\s+(.+?)\s*\((\d+)/g;
  let m;
  while ((m = goalRegex.exec(text)) !== null) {
    const scorer = m[3].trim();
    if (!goals[scorer]) goals[scorer] = 0;
    goals[scorer]++;
  }
  return goals;
}

// ====== SCRAPER: CLASIFICACIÓN ======
async function scrapeClasificacion(page) {
  console.log('\n📊 Scraping clasificación...');
  const url = `${FUTGAL_URL}NPcd/NFG_ImpClasCal?cod_primaria=${LIGA.cod_primaria}&CodCompeticion=${LIGA.CodCompeticion}&CodGrupo=${LIGA.CodGrupo}&CodTemporada=${LIGA.CodTemporada}`;
  await safeGoto(page, url);
  await WAIT(3000);

  const standings = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    for (const table of tables) {
      const headers = [...(table.rows[0]?.querySelectorAll('th,td') || [])].map(h => h.textContent.trim().toLowerCase());
      if (headers.some(h => h.includes('equipo') || h.includes('pos'))) {
        const rows = [];
        for (let i = 1; i < table.rows.length; i++) {
          const cells = [...table.rows[i].querySelectorAll('td')];
          if (cells.length >= 9) {
            rows.push({
              pos: parseInt(cells[0]?.textContent?.trim()) || i,
              team: cells[1]?.textContent?.trim() || '',
              played: parseInt(cells[2]?.textContent?.trim()) || 0,
              won: parseInt(cells[3]?.textContent?.trim()) || 0,
              drawn: parseInt(cells[4]?.textContent?.trim()) || 0,
              lost: parseInt(cells[5]?.textContent?.trim()) || 0,
              gf: parseInt(cells[6]?.textContent?.trim()) || 0,
              ga: parseInt(cells[7]?.textContent?.trim()) || 0,
              pts: parseInt(cells[8]?.textContent?.trim()) || 0,
            });
          }
        }
        if (rows.length > 0) return rows;
      }
    }

    const allText = document.body.innerText;
    const rows = [];
    const lines = allText.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*(\d+)\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
      if (match) {
        rows.push({
          pos: parseInt(match[1]), team: match[2].trim(),
          played: parseInt(match[3]), won: parseInt(match[4]), drawn: parseInt(match[5]),
          lost: parseInt(match[6]), gf: parseInt(match[7]), ga: parseInt(match[8]),
          pts: parseInt(match[9]),
        });
      }
    }
    return rows;
  });

  if (standings.length === 0) {
    console.log('  ⚠️ No standings found via tables, trying raw HTML...');
    const raw = await page.evaluate(() => document.body.innerText);
    console.log('  Page text (first 500):', raw.substring(0, 500));
  }

  console.log(`  Found ${standings.length} teams`);

  for (const row of standings) {
    try {
      await db.execute({
        sql: `INSERT INTO standings (pos, team, played, won, drawn, lost, gf, ga, pts)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(pos) DO UPDATE SET team=?, played=?, won=?, drawn=?, lost=?, gf=?, ga=?, pts=?`,
        args: [row.pos, row.team, row.played, row.won, row.drawn, row.lost, row.gf, row.ga, row.pts,
               row.team, row.played, row.won, row.drawn, row.lost, row.gf, row.ga, row.pts]
      });
    } catch (e) {
      console.error(`  ❌ Error inserting ${row.team}:`, e.message);
    }
  }

  for (const row of standings) {
    if (row.team.includes('SADA') || row.team.includes('NOSA VI')) {
      console.log(`  📈 Sada CF: #${row.pos} - ${row.pts}pts (${row.won}V ${row.drawn}E ${row.lost}D) GF:${row.fg} GA:${row.ga}`);
    }
  }

  return standings;
}

// ====== SCRAPER: CALENDARIO COMPLETO ======
async function scrapeCalendario(page) {
  console.log('\n📅 Scraping calendario completo...');
  const allMatches = [];

  for (const comp of [{ name: 'Liga', params: LIGA }, { name: 'Copa', params: COPA }]) {
    const baseUrl = `${FUTGAL_URL}NPcd/NFG_CmpJornada?cod_primaria=${comp.params.cod_primaria}&CodCompeticion=${comp.params.CodCompeticion}&CodGrupo=${comp.params.CodGrupo}&CodTemporada=${comp.params.CodTemporada}`;
    await safeGoto(page, baseUrl);
    await WAIT(3000);

    const jornadas = await page.evaluate(() => {
      const sel = document.querySelector('select[name="jornada"]');
      if (!sel) return [];
      return [...sel.options].filter(o => o.value).map(o => ({ value: o.value, text: o.text.trim() }));
    });

    console.log(`  ${comp.name}: ${jornadas.length} jornadas`);

    for (const jornada of jornadas) {
      const url = `${baseUrl}&CodJornada=${jornada.value}`;
      await safeGoto(page, url);

      const matches = await page.evaluate((compName, jornText) => {
        const rows = [];
        const trs = document.querySelectorAll('table tr');
        for (const tr of trs) {
          const cells = [...tr.querySelectorAll('td')];
          if (cells.length >= 4) {
            const texts = cells.map(c => c.textContent.trim());
            const links = [...tr.querySelectorAll('a')];
            let actaId = null;
            let result = null;
            for (const a of links) {
              const href = a.getAttribute('href') || '';
              const am = href.match(/CodActa=(\d+)/);
              if (am) actaId = am[1];
              const rm = a.textContent.trim().match(/^\d+\s*-\s*\d+$/);
              if (rm) result = rm[0];
            }
            const home = texts.find(t => t === 'H' || t === '1') || '';
            const teams = texts.filter(t => t.length > 3 && !t.match(/^\d+$/) && t !== 'H' && t !== 'V');
            if (teams.length >= 2) {
              rows.push({
                home: texts.includes('H'),
                rival: teams.find(t => !t.includes('SADA') && !t.includes('NOSA VI')) || teams[1],
                result: result || null,
                actaId: actaId || null,
                competition: compName,
                jornada: jornText,
              });
            }
          }
        }
        return rows;
      }, comp.name, jornada.text);

      for (const m of matches) {
        if (m.rival) allMatches.push(m);
      }
    }
  }

  console.log(`  Total calendar entries: ${allMatches.length}`);
  return allMatches;
}

// ====== SCRAPER: SANCIONES ======
async function scrapeSanciones(page) {
  console.log('\n🟨 Scraping sanciones...');
  const url = `${FUTGAL_URL}NPcd/NFG_ConsultaSanciones?cod_primaria=${LIGA.cod_primaria}`;

  await safeGoto(page, url);
  await WAIT(2000);

  const sanctions = await page.evaluate(() => {
    const form = document.querySelector('form');
    const selects = form ? [...form.querySelectorAll('select')] : [];
    return { hasForm: !!form, selects: selects.map(s => ({ name: s.name, options: [...s.options].length })) };
  });

  console.log(`  Form found: ${sanctions.hasForm}, selects: ${sanctions.selects.length}`);

  if (sanctions.hasForm) {
    await page.evaluate((codComp, codGrupo) => {
      const selects = document.querySelectorAll('select');
      selects.forEach(s => {
        if (s.name && s.name.toLowerCase().includes('competicion')) {
          s.value = codComp;
          s.dispatchEvent(new Event('change'));
        }
      });
    }, LIGA.CodCompeticion, LIGA.CodGrupo);

    await WAIT(2000);

    const submitBtn = await page.$('input[type="submit"], button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await WAIT(3000);
    }
  }

  const results = await page.evaluate(() => {
    const rows = [];
    const trs = document.querySelectorAll('table tr');
    for (const tr of trs) {
      const cells = [...tr.querySelectorAll('td')];
      if (cells.length >= 3) {
        const texts = cells.map(c => c.textContent.trim());
        rows.push({ texts });
      }
    }
    return { rows, bodyText: document.body.innerText.substring(0, 2000) };
  });

  console.log(`  Found ${results.rows.length} sanction rows`);
  if (results.rows.length === 0) {
    console.log('  Page text:', results.bodyText.substring(0, 500));
  }

  return results;
}

// ====== SCRAPER: PLANTILLA OFICIAL ======
async function scrapePlantilla(page) {
  console.log('\n👥 Scraping plantilla oficial...');
  const url = `${FUTGAL_URL}NPcd/NFG_VisEquipos?Codigo_Equipo=4261861`;
  await safeGoto(page, url);
  await WAIT(3000);

  const squad = await page.evaluate(() => {
    const players = [];
    const rows = document.querySelectorAll('table tr');
    for (const row of rows) {
      const cells = [...row.querySelectorAll('td')];
      if (cells.length >= 3) {
        const texts = cells.map(c => c.textContent.trim());
        const dorsal = texts.find(t => /^\d+$/.test(t));
        const name = texts.find(t => t.length > 3 && !/^\d+$/.test(t));
        if (name && dorsal) {
          players.push({
            dorsal: parseInt(dorsal),
            name: name,
            position: texts.find(t => /^(Portero|Defensa|Centrocampista|Delantero)/i.test(t)) || '',
            license: texts.find(t => /licencia|futgal|\d{5,}/i.test(t)) || '',
            allText: texts.join(' | '),
          });
        }
      }
    }
    return { players, bodyText: document.body.innerText.substring(0, 3000) };
  });

  console.log(`  Found ${squad.players.length} players`);
  if (squad.players.length === 0) {
    console.log('  Page text:', squad.bodyText.substring(0, 800));
  }

  for (const p of squad.players) {
    console.log(`  #${p.dorsal} ${p.name} - ${p.position || p.allText}`);
  }

  return squad;
}

// ====== SCRAPER: ACTAS (estadísticas por partido) ======
async function scrapeAllActas(page) {
  console.log('\n📋 Scraping actas de partido...');
  const allStats = [];

  for (const comp of [{ name: 'Liga', params: LIGA }, { name: 'Copa', params: COPA }]) {
    const baseUrl = `${FUTGAL_URL}NPcd/NFG_CmpJornada?cod_primaria=${comp.params.cod_primaria}&CodCompeticion=${comp.params.CodCompeticion}&CodGrupo=${comp.params.CodGrupo}&CodTemporada=${comp.params.CodTemporada}`;
    await safeGoto(page, baseUrl);
    await WAIT(3000);

    const jornadas = await page.evaluate(() => {
      const sel = document.querySelector('select[name="jornada"]');
      if (!sel) return [];
      return [...sel.options].filter(o => o.value).map(o => ({ value: o.value, text: o.text.trim() }));
    });

    for (const jornada of jornadas) {
      const dateMatch = jornada.text.match(/(\d{2})-(\d{2})-(\d{4})/);
      if (dateMatch) {
        const jDate = new Date(dateMatch[3], dateMatch[2] - 1, dateMatch[1]);
        if (jDate > new Date()) continue;
      }

      const actas = [];
      for (let pg = 1; pg <= 3; pg++) {
        const url = `${baseUrl}&CodJornada=${jornada.value}&NPcd_Page=${pg}`;
        await safeGoto(page, url);

        const found = await page.evaluate(() => {
          return [...document.querySelectorAll('a')]
            .map(a => a.getAttribute('href') || '')
            .filter(h => h.includes('CmpPrevio'))
            .map(h => { const m = h.match(/CodActa=(\d+)/); return m ? m[1] : null; })
            .filter(Boolean);
        });

        if (found.length === 0) break;
        actas.push(...found);
      }

      for (const actaId of actas) {
        const previoUrl = `${FUTGAL_URL}NPcd/NFG_CmpPrevio?cod_primaria=${LIGA.cod_primaria}&CodActa=${actaId}`;
        await safeGoto(page, previoUrl);

        const matchInfo = await page.evaluate(() => {
          const html = document.body.innerHTML;
          const teamRegex = /class="tituloprograma"[^>]*>([^<]+)/g;
          const teams = [];
          let m;
          while ((m = teamRegex.exec(html)) !== null) teams.push(m[1].trim());
          const isOurMatch = teams.some(t => t.includes('SADA F.C.') || t.includes('NOSA VI'));
          const resultEl = document.body.innerText.match(/(\d+)\s*[-–]\s*(\d+)/);
          return { teams, isOurMatch, result: resultEl ? `${resultEl[1]}-${resultEl[2]}` : null };
        });

        if (!matchInfo.isOurMatch) continue;

        console.log(`  ${comp.name} ${jornada.text}: ${matchInfo.teams.join(' vs ')} (${actaId})`);

        const statUrl = `${FUTGAL_URL}NPcd/NFG_CMP_Alineacion_Resultados?cod_primaria=${LIGA.cod_primaria}&codacta=${actaId}`;
        await safeGoto(page, statUrl);
        await WAIT(2000);

        const stats = await page.evaluate(() => {
          const results = { sadaPlayers: [], rivalPlayers: [], goals: {} };
          const tables = document.querySelectorAll('table');

          for (const table of tables) {
            const text = table.innerText;
            const isSada = text.includes('SADA F.C.');
            const rows = table.querySelectorAll('tr');

            for (const row of rows) {
              const cells = [...row.querySelectorAll('td')];
              if (cells.length >= 5) {
                const num = cells[0]?.textContent?.trim();
                const name = cells[1]?.textContent?.trim();
                const a1 = cells[2]?.textContent?.trim();
                const a2 = cells[3]?.textContent?.trim();
                const r = cells[4]?.textContent?.trim();

                if (name && name.length > 3 && num && /^\d+$/.test(num)) {
                  const player = { num, name, yellow: 0, red: 0 };
                  if (a1 && a1 !== '' && a1 !== '\u00a0') player.yellow++;
                  if (a2 && a2 !== '' && a2 !== '\u00a0') player.yellow++;
                  if (r && r !== '' && r !== '\u00a0') player.red++;
                  if (isSada) results.sadaPlayers.push(player);
                  else results.rivalPlayers.push(player);
                }
              }
            }
          }

          const bodyText = document.body.innerText;
          const goalSection = bodyText.match(/GOLES[\s\S]*?(?=TARJETAS|SUSTITUCION|EQUIPO ARBITRAL|$)/i);
          if (goalSection) {
            const goalRegex = /(\d+)\s*-\s*(\d+)\s+([A-ZÁÉÍÓÚÑ\s,\.]+?)\s*\((\d+)/g;
            let m;
            while ((m = goalRegex.exec(goalSection[0])) !== null) {
              const scorer = m[3].trim();
              if (!results.goals[scorer]) results.goals[scorer] = 0;
              results.goals[scorer]++;
            }
          }

          return results;
        });

        allStats.push({ actaId, competition: comp.name, jornada: jornada.text, teams: matchInfo.teams, result: matchInfo.result, stats });
      }
    }
  }

  return allStats;
}

// ====== DB UPDATE ======
async function updateDBFromStats(allStats) {
  console.log('\n💾 Updating database from actas...');

  const aggregate = {};
  for (const match of allStats) {
    const { stats } = match;

    for (const [futgalName, count] of Object.entries(stats.goals)) {
      const entry = Object.entries(FUTGAL_MAP).find(([id, nick]) => {
        const upper = futgalName.toUpperCase();
        return upper.includes(nick.toUpperCase()) || nick.toUpperCase().includes(upper.split(',')[0]);
      });
      if (entry) {
        const nick = entry[1].toLowerCase();
        if (!aggregate[nick]) aggregate[nick] = { goals: 0, yellow: 0, red: 0 };
        aggregate[nick].goals += count;
      }
    }

    for (const player of stats.sadaPlayers) {
      const entry = Object.entries(FUTGAL_MAP).find(([id, nick]) => {
        return player.name.toUpperCase().includes(nick.toUpperCase()) ||
               nick.toUpperCase().includes(player.name.split(',')[0].trim().toUpperCase());
      });
      if (entry) {
        const nick = entry[1].toLowerCase();
        if (!aggregate[nick]) aggregate[nick] = { goals: 0, yellow: 0, red: 0 };
        aggregate[nick].yellow += player.yellow;
        aggregate[nick].red += player.red;
      }
    }
  }

  for (const [nickname, data] of Object.entries(aggregate)) {
    try {
      const player = (await db.execute({
        sql: 'SELECT id, goals, yellowCards, redCards FROM players WHERE LOWER(nickname)=?',
        args: [nickname]
      })).rows[0];

      if (player) {
        const newGoals = Math.max(player.goals || 0, data.goals);
        const newY = Math.max(player.yellowCards || 0, data.yellow);
        const newR = Math.max(player.redCards || 0, data.red);
        await db.execute({
          sql: 'UPDATE players SET goals=?, yellowCards=?, redCards=? WHERE id=?',
          args: [newGoals, newY, newR, player.id]
        });
        const changes = [];
        if (newGoals > 0) changes.push(`⚽${newGoals}`);
        if (newY > 0) changes.push(`🟨${newY}`);
        if (newR > 0) changes.push(`🟥${newR}`);
        if (changes.length > 0) console.log(`  ${nickname}: ${changes.join(' ')}`);
      }
    } catch (e) {
      console.error(`  ❌ ${nickname}:`, e.message);
    }
  }
}

// ====== MAIN ======
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

    const mode = process.argv[2] || 'all';

    if (mode === 'all' || mode === 'clasificacion') {
      await scrapeClasificacion(page);
    }

    if (mode === 'all' || mode === 'actas') {
      const allStats = await scrapeAllActas(page);
      console.log(`\n📊 Found stats in ${allStats.length} actas`);
      await updateDBFromStats(allStats);
    }

    if (mode === 'all' || mode === 'plantilla') {
      await scrapePlantilla(page);
    }

    if (mode === 'all' || mode === 'sanciones') {
      await scrapeSanciones(page);
    }

    console.log('\n✅ Scraping complete');
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
  } finally {
    await browser.close();
  }
})();
