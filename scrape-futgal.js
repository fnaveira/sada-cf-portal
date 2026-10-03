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
  27599289: 'Fran', 17298560: 'Albarracin', 56074: 'Yuyi',
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
    await page.goto(redirectUrl, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await WAIT(3000);
    console.log('✅ Login OK - URL:', page.url());
  } else {
    throw new Error('Login failed');
  }
}

async function safeGoto(page, url) {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
  await WAIT(3000);
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
  const JORNADA = process.env.FUTGAL_JORNADA || '4';
  const url = `${FUTGAL_URL}NPcd/NFG_VisClasificacion?cod_primaria=${LIGA.cod_primaria}&codjornada=${JORNADA}&codcompeticion=${LIGA.CodCompeticion}&codgrupo=${LIGA.CodGrupo}`;
  await safeGoto(page, url);
  await WAIT(1500);

  const standings = await page.evaluate(() => {
    const rows = [];
    const seen = new Set();
    for (const tr of document.querySelectorAll('table tr')) {
      const cells = [...tr.querySelectorAll('td')].map(c => c.textContent.replace(/\s+/g, ' ').trim());
      // tabla resumen: 11-13 celdas (la detallada tiene 17)
      if (cells.length < 11 || cells.length > 13) continue;
      let i = 0;
      while (i < cells.length && !/^\d+$/.test(cells[i])) i++;
      if (i + 8 >= cells.length) continue;
      const nums = cells.slice(i + 2, i + 9).map(x => (/^\d+$/.test(x) ? parseInt(x) : NaN));
      if (nums.some(isNaN)) continue;
      const team = cells[i + 1];
      if (!team || /^\d+$/.test(team)) continue;
      const pos = parseInt(cells[i]);
      if (seen.has(pos)) continue;
      seen.add(pos);
      rows.push({
        pos,
        team,
        pts: nums[0],
        played: nums[1],
        won: nums[2],
        drawn: nums[3],
        lost: nums[4],
        gf: nums[5],
        ga: nums[6],
      });
    }
    return rows;
  });

  if (standings.length < 10) {
    console.log('  ⚠️ No standings found, page text:');
    const raw = await page.evaluate(() => document.body.innerText);
    console.log('  Page text (first 500):', raw.substring(0, 500));
    return [];
  }

  console.log(`  Found ${standings.length} teams`);

  await db.execute('DELETE FROM standings');
  for (const row of standings) {
    const team = /^SADA F\.C\. A NOSA VIÑA$/i.test(row.team) ? 'Sada F.C. A Nosa Viña' : row.team;
    try {
      await db.execute({
        sql: 'INSERT INTO standings (pos, team, played, won, drawn, lost, gf, ga, pts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        args: [row.pos, team, row.played, row.won, row.drawn, row.lost, row.gf, row.ga, row.pts]
      });
    } catch (e) {
      console.error(`  ❌ Error inserting ${team}:`, e.message);
    }
  }

  for (const row of standings) {
    if (row.team.includes('SADA') || row.team.includes('NOSA VI')) {
      console.log(`  📈 Sada F.C. A Nosa Viña: #${row.pos} - ${row.pts}pts (${row.won}V ${row.drawn}E ${row.lost}D) GF:${row.gf} GA:${row.ga}`);
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

// ====== SCRAPER: FICHAS DE SANCIONES (fuente oficial de tarjetas) ======
// Las actas solo muestran las tarjetas del equipo LOCAL, así que las nuestras
// en partidos fuera no aparecen. La ficha de sanciones de cada jugador sí es oficial.
async function syncCardsFromFichas(page) {
  console.log('\n🟨 Scrapando fichas de sanciones de jugadores...');
  await safeGoto(page, `${FUTGAL_URL}NPcd/NFG_VisEquipos?cod_primaria=1000102&Codigo_Equipo=4261861`);

  const sanctioned = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('a[href*="VisSanciones_jugador"]').forEach(a => {
      const m = (a.getAttribute('href') || '').match(/VisSanciones_jugador\((\d+)/);
      const tr = a.closest('tr');
      const row = tr ? tr.innerText.replace(/\s+/g, ' ').trim() : '';
      if (m) out.push({ fid: parseInt(m[1], 10), name: row.replace(/\s+VETERANO.*$/i, '').trim() });
    });
    return out;
  });

  if (!sanctioned.length) {
    console.log('  Ningún jugador con sanciones en FGF');
    return [];
  }
  console.log(`  ${sanctioned.length} jugadores con sanciones`);

  const sanctions = [];
  for (const s of sanctioned) {
    await safeGoto(page, `${FUTGAL_URL}NFG_ShwSancionesJugSnc?CodTemporada=22&CodParticipante=${s.fid}&cod_primaria=1000129&nueva_ventana=1`);
    const text = await page.evaluate(() => document.body.innerText);
    const nickname = FUTGAL_MAP[s.fid] || null;
    const parts = text.split(/DETALLE COMPETICIÓN:/i).slice(1);
    if (!parts.length) { console.log(`  ⚠ ${s.name}: sin detalle de sanciones`); continue; }
    for (const part of parts) {
      const head = part.split(/Fecha\s+Partido/i)[0] || '';
      const comp = /COPA/i.test(head) ? 'Copa' : 'Liga';
      const tipo = ((part.match(/TIPO DE SANCIÓN:\s*([^\n]+)/i) || [])[1] || '').trim();
      const type = /EXPULSI/i.test(tipo) ? 'red' : 'yellow';
      const dates = [...part.matchAll(/(\d{2})-(\d{2})-(\d{4})/g)].map(d => `${d[3]}-${d[2]}-${d[1]}`);
      for (const date of dates) sanctions.push({ fid: s.fid, name: s.name, nickname, comp, type, date });
      if (dates.length) {
        console.log(`  ${type === 'red' ? '🟥' : '🟨'} ${nickname || s.name} · ${comp} · ${dates.length} → ${dates.join(', ')}${tipo ? ' [' + tipo + ']' : ''}`);
      }
    }
  }
  return sanctions;
}

async function applySanctionsToDB(sanctions) {
  if (!sanctions.length) return;

  const matchRows = (await db.execute({ sql: 'SELECT id, date, competition FROM matches' })).rows;
  const playerRows = (await db.execute({ sql: 'SELECT id, nickname, name FROM players' })).rows;
  const norm = t => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z, ]/g, '');

  const findPlayer = (s) => {
    if (s.nickname) {
      const byNick = playerRows.find(p => p.nickname === s.nickname);
      if (byNick) return byNick;
    }
    const target = norm(s.name);
    return playerRows.find(p => norm(p.name).includes(target) || (target && norm(p.name).split(',')[0] && target.includes(norm(p.name).split(',')[0]))) || null;
  };
  const findMatch = (date, comp) => {
    const t = Date.parse(date + 'T00:00:00');
    let best = null, diff = Infinity;
    for (const m of matchRows) {
      if (m.competition !== comp) continue;
      const d = Math.abs(Date.parse(m.date + 'T00:00:00') - t);
      if (d <= 7 * 86400000 && d < diff) { best = m; diff = d; }
    }
    return best;
  };

  const desired = [];
  for (const s of sanctions) {
    const p = findPlayer(s);
    const m = findMatch(s.date, s.comp);
    if (!p) { console.log(`  ⚠ Sin jugador para "${s.name}"`); continue; }
    if (!m) { console.log(`  ⚠ Sin partido para ${s.comp} ${s.date} (${s.name})`); continue; }
    desired.push({ playerId: p.id, matchId: m.id, type: s.type, competition: s.comp });
  }

  const existing = (await db.execute({ sql: "SELECT id, playerId, matchId, type FROM match_cards WHERE competition IN ('Liga','Copa')" })).rows;
  const consumed = new Set();
  const toInsert = [];
  for (const d of desired) {
    const idx = existing.findIndex(e => !consumed.has(e.id) && e.playerId === d.playerId && e.matchId === d.matchId && e.type === d.type);
    if (idx >= 0) consumed.add(existing[idx].id);
    else toInsert.push(d);
  }
  const toDelete = existing.filter(e => !consumed.has(e.id));

  for (const d of toInsert) {
    await db.execute({ sql: 'INSERT INTO match_cards (playerId, matchId, type, competition) VALUES (?, ?, ?, ?)', args: [d.playerId, d.matchId, d.type, d.competition] });
    console.log(`  ➕ ${d.type === 'red' ? 'roja' : 'amarilla'} nueva → jugador ${d.playerId}, partido ${d.matchId} (${d.competition})`);
  }
  for (const e of toDelete) {
    await db.execute({ sql: 'DELETE FROM match_cards WHERE id=?', args: [e.id] });
    console.log(`  ➖ borrada tarjeta id=${e.id} (jugador ${e.playerId}, partido ${e.matchId})`);
  }

  await db.execute({
    sql: `UPDATE players SET
      yellowCards = (SELECT COUNT(*) FROM match_cards c WHERE c.playerId = players.id AND c.type = 'yellow'),
      redCards = (SELECT COUNT(*) FROM match_cards c WHERE c.playerId = players.id AND c.type = 'red')`
  });

  const counts = (await db.execute({ sql: 'SELECT nickname, yellowCards, redCards FROM players WHERE yellowCards > 0 OR redCards > 0 ORDER BY yellowCards DESC, redCards DESC' })).rows;
  console.log('  📊 Recuento: ' + (counts.map(c => `${c.nickname} ${c.yellowCards}🟨${c.redCards ? ' ' + c.redCards + '🟥' : ''}`).join(' · ') || 'sin tarjetas'));
}

// ====== SCRAPER: PLANTILLA OFICIAL ======
async function scrapePlantilla(page) {
  console.log('\n👥 Scraping plantilla oficial...');
  const url = `${FUTGAL_URL}NPcd/NFG_VisEquipos?cod_primaria=1000102&Codigo_Equipo=4261861`;
  await safeGoto(page, url);

  const squad = await page.evaluate(() => {
    const players = [];
    const bodyText = document.body.innerText;
    
    const nameRegex = /([A-ZÁÉÍÓÚÑ\s,\.]+?)\s+VETERANO MASCULINO/g;
    let m;
    const names = new Set();
    while ((m = nameRegex.exec(bodyText)) !== null) {
      const name = m[1].trim().replace(/\s+/g, ' ');
      if (name.length > 3 && !names.has(name)) {
        names.add(name);
        players.push({ name });
      }
    }
    
    return { players, bodyText: bodyText.substring(0, 2000) };
  });

  console.log(`  Found ${squad.players.length} jugadores oficiales`);
  for (const p of squad.players) {
    console.log(`  📋 ${p.name}`);
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
            .filter(h => h.includes('CmpPartido') || h.includes('CmpPrevio'))
            .map(h => { const m = h.match(/CodActa=(\d+)/); return m ? m[1] : null; })
            .filter(Boolean);
        });

        if (found.length === 0) break;
        actas.push(...found);
      }

      const uniqueActas = [...new Set(actas)];
      for (const actaId of uniqueActas) {
        const previoUrl = `${FUTGAL_URL}NPcd/NFG_CmpPartido?cod_primaria=${comp.params.cod_primaria}&CodActa=${actaId}&cod_acta=${actaId}`;
        await safeGoto(page, previoUrl);

        let matchInfo;
        try {
          matchInfo = await page.evaluate(() => {
            const html = document.body.innerHTML;
            const teamRegex = /class="tituloprograma"[^>]*>([^<]+)/g;
            const teams = [];
            let m;
            while ((m = teamRegex.exec(html)) !== null) teams.push(m[1].trim());
            const isOurMatch = teams.some(t => t.includes('SADA F.C.') || t.includes('NOSA VI'));
            const body = document.body.innerText;
            const goles = body.match(/GOLES[\s\S]*?(?=TARJETAS|EQUIPO ARBITRAL|SUSTITUCION|$)/i);
            const scope = goles ? goles[0] : body;
            const cands = [...scope.matchAll(/(\d{1,2})\s*[-–]\s*(\d{1,2})(?![\d-])/g)]
              .map(x => ({ a: parseInt(x[1], 10), b: parseInt(x[2], 10) }))
              .filter(x => x.a <= 20 && x.b <= 20);
            const result = cands.length ? `${cands[cands.length - 1].a}-${cands[cands.length - 1].b}` : null;
            return { teams, isOurMatch, result };
          });
        } catch (e) {
          console.log(`  ⚠ Skip acta ${actaId} (${comp.name}): ${e.message.substring(0, 50)}`);
          continue;
        }

        if (!matchInfo.isOurMatch) continue;

        console.log(`  ${comp.name} ${jornada.text}: ${matchInfo.teams.join(' vs ')} (${actaId})`);

        const statUrl = `${FUTGAL_URL}NPcd/NFG_CMP_Alineacion_Resultados?cod_primaria=${comp.params.cod_primaria}&codacta=${actaId}`;
        await safeGoto(page, statUrl);
        await WAIT(2000);

        const stats = await page.evaluate(() => {
          const results = { sadaPlayers: [], rivalPlayers: [], goals: {}, cards: [] };
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

        // Scrape TARJETAS from CmpPartido page (more reliable card data with minutes)
        const cmpUrl = `${FUTGAL_URL}NPcd/NFG_CmpPartido?cod_primaria=${comp.params.cod_primaria}&CodActa=${actaId}&cod_acta=${actaId}&N_Ajax=1`;
        await safeGoto(page, cmpUrl);
        await WAIT(2000);

        const cards = await page.evaluate((sadaNames) => {
          const result = { sada: [], rival: [] };
          const bodyText = document.body.innerText;
          
          // Find TARJETAS section
          const tarjSection = bodyText.match(/TARJETAS([\s\S]*?)(?=SUSTITUCIONES|EQUIPO ARBITRAL|ENTRENADORES|$)/i);
          if (!tarjSection) return result;
          
          const allCards = [];
          
          // Parse cards with minutes: "NAME (MM')"
          const lines = tarjSection[1].split('\n');
          for (const line of lines) {
            const cardMatch = line.match(/([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s,\.]+?)\s*\((\d+)/);
            if (cardMatch) {
              allCards.push({ name: cardMatch[1].trim(), minute: parseInt(cardMatch[2]), type: 'yellow' });
            }
          }
          
          // Also try regex on HTML for yellow card images
          const html = document.body.innerHTML;
          const cardRegex = /tarj_amar[^\"]*\.gif[\s\S]{0,300}?([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s,\.]+?)\s*\((\d+)/g;
          let m;
          while ((m = cardRegex.exec(html)) !== null) {
            const already = allCards.some(c => c.name === m[1].trim() && c.minute === parseInt(m[2]));
            if (!already) allCards.push({ name: m[1].trim(), minute: parseInt(m[2]), type: 'yellow' });
          }
          
          // Red cards
          const redRegex = /tarj_roj[^\"]*\.gif[\s\S]{0,300}?([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s,\.]+?)\s*\((\d+)/g;
          while ((m = redRegex.exec(html)) !== null) {
            const already = allCards.some(c => c.name === m[1].trim() && c.minute === parseInt(m[2]));
            if (!already) allCards.push({ name: m[1].trim(), minute: parseInt(m[2]), type: 'red' });
          }
          
          // Classify: if name matches a Sada player, it's Sada's card
          for (const card of allCards) {
            const isSada = sadaNames.some(sn => card.name.toUpperCase().includes(sn.toUpperCase()));
            if (isSada) result.sada.push(card);
            else result.rival.push(card);
          }
          
          return result;
        }, stats.sadaPlayers.map(p => p.name.split(',')[0].trim()));

        allStats.push({ actaId, competition: comp.name, jornada: jornada.text, teams: matchInfo.teams, result: matchInfo.result, stats, cards });
      }
    }
  }

  return allStats;
}

// ====== DB UPDATE ======
async function updateDBFromStats(allStats) {
  console.log('\n💾 Updating database from actas...');

  // Goles de la temporada: suma de todas las actas (nunca por debajo de lo ya registrado)
  const mapNick = (futgalName) => {
    const entry = Object.entries(FUTGAL_MAP).find(([id, nick]) => {
      const upper = String(futgalName).toUpperCase();
      return upper.includes(nick.toUpperCase()) || nick.toUpperCase().includes(upper.split(',')[0]);
    });
    return entry ? entry[1].toLowerCase() : null;
  };
  const goalTotals = {};
  for (const match of allStats) {
    for (const [futgalName, count] of Object.entries((match.stats && match.stats.goals) || {})) {
      const nick = mapNick(futgalName);
      if (nick) goalTotals[nick] = (goalTotals[nick] || 0) + (parseInt(count, 10) || 0);
    }
  }
  for (const [nick, total] of Object.entries(goalTotals)) {
    const player = (await db.execute({ sql: 'SELECT id, goals FROM players WHERE LOWER(nickname)=?', args: [nick] })).rows[0];
    if (!player) continue;
    const newGoals = Math.max(player.goals || 0, total);
    if (newGoals !== (player.goals || 0)) {
      await db.execute({ sql: 'UPDATE players SET goals=? WHERE id=?', args: [newGoals, player.id] });
      console.log(`  ⚽ ${nick}: ${player.goals || 0} → ${newGoals} goles`);
    }
  }

  for (const match of allStats) {
    const { actaId, competition, jornada, teams, result, stats, cards } = match;

    // Find match in DB by date extracted from jornada
    const dateMatch = jornada.match(/(\d{2})-(\d{2})-(\d{4})/);
    let matchDate = null;
    if (dateMatch) matchDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;

    let matchId = null;
    if (matchDate) {
      // La fecha de la jornada de la FGF puede diferir en 1-2 días de la real: ventana de ±7 días
      const cand = await db.execute({ sql: 'SELECT id, result, date FROM matches WHERE competition=?', args: [competition] });
      const target = Date.parse(matchDate + 'T00:00:00');
      let best = null, bestDiff = Infinity;
      for (const row of cand.rows) {
        const diff = Math.abs(Date.parse(row.date + 'T00:00:00') - target);
        if (diff <= 7 * 86400000 && diff < bestDiff) { best = row; bestDiff = diff; }
      }
      if (best) {
        matchId = best.id;
        // Update result if not set (solo marcadores válidos "N-N")
        if (result && /^\d{1,2}-\d{1,2}$/.test(result) && Number(result.split('-')[0]) <= 20 && Number(result.split('-')[1]) <= 20 && !best.result) {
          await db.execute({ sql: 'UPDATE matches SET result=? WHERE id=?', args: [result, matchId] });
          console.log(`  📅 ${competition} ${best.date}: result ${result}`);
        }
      }
    }

    // Cards to match_cards table (only for Sada players) — solo si hay tarjetas extraídas
    if (matchId && cards && cards.sada && cards.sada.length > 0) {
      // Clear existing cards for this match first
      await db.execute({ sql: 'DELETE FROM match_cards WHERE matchId=?', args: [matchId] });

      for (const card of cards.sada) {
        // Find player by name match
        const entry = Object.entries(FUTGAL_MAP).find(([id, nick]) => {
          return card.name.toUpperCase().includes(nick.toUpperCase()) ||
                 nick.toUpperCase().includes(card.name.split(',')[0].trim().toUpperCase());
        });
        if (entry) {
          const nick = entry[1].toLowerCase();
          const player = (await db.execute({ sql: 'SELECT id FROM players WHERE LOWER(nickname)=?', args: [nick] })).rows[0];
          if (player) {
            await db.execute({
              sql: 'INSERT INTO match_cards (playerId, matchId, type, minute, competition) VALUES (?, ?, ?, ?, ?)',
              args: [player.id, matchId, card.type, card.minute, competition]
            });
            const icon = card.type === 'yellow' ? '🟨' : '🟥';
            console.log(`  ${icon} ${nick} (${card.minute}') - ${competition}`);
          }
        }
      }
    }

    // Also count cards from alineacion table (A1/A2/R columns) as fallback
    if (matchId && stats.sadaPlayers) {
      for (const player of stats.sadaPlayers) {
        if (player.yellow > 0 || player.red > 0) {
          const entry = Object.entries(FUTGAL_MAP).find(([id, nick]) => {
            return player.name.toUpperCase().includes(nick.toUpperCase()) ||
                   nick.toUpperCase().includes(player.name.split(',')[0].trim().toUpperCase());
          });
          if (entry) {
            const nick = entry[1].toLowerCase();
            const dbPlayer = (await db.execute({ sql: 'SELECT id FROM players WHERE LOWER(nickname)=?', args: [nick] })).rows[0];
            if (dbPlayer) {
              // Check if card already exists for this match
              const existing = await db.execute({
                sql: 'SELECT id FROM match_cards WHERE playerId=? AND matchId=?',
                args: [dbPlayer.id, matchId]
              });
              if (existing.rows.length === 0) {
                for (let i = 0; i < player.yellow; i++) {
                  await db.execute({
                    sql: 'INSERT INTO match_cards (playerId, matchId, type, competition) VALUES (?, ?, ?, ?)',
                    args: [dbPlayer.id, matchId, 'yellow', competition]
                  });
                  console.log(`  🟨 ${nick} - ${competition} (from alineacion)`);
                }
                for (let i = 0; i < player.red; i++) {
                  await db.execute({
                    sql: 'INSERT INTO match_cards (playerId, matchId, type, competition) VALUES (?, ?, ?, ?)',
                    args: [dbPlayer.id, matchId, 'red', competition]
                  });
                  console.log(`  🟥 ${nick} - ${competition} (from alineacion)`);
                }
              }
            }
          }
        }
      }
    }
  }
}

// ====== MAIN ======
(async () => {
  console.log('⚽ FUTGAL Scraper - Sada F.C. A Nosa Viña');
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
      const sanctions = await syncCardsFromFichas(page);
      await applySanctionsToDB(sanctions);
    }

    console.log('\n✅ Scraping complete');
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
  } finally {
    await browser.close();
  }
})();
