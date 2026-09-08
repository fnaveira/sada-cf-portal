const express = require('express');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// --- HELPERS ---
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

// --- DATABASE INIT ---
async function initDB() {
  await db.execute(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    nickname TEXT,
    number INTEGER NOT NULL,
    position TEXT NOT NULL,
    age INTEGER,
    status TEXT DEFAULT 'disponible',
    goals INTEGER DEFAULT 0,
    yellowCards INTEGER DEFAULT 0,
    redCards INTEGER DEFAULT 0,
    recoveryDate TEXT
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS convocatoria (
    playerId INTEGER PRIMARY KEY
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS formation (
    id INTEGER PRIMARY KEY,
    name TEXT DEFAULT '4-4-2',
    positions TEXT DEFAULT '[]'
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS club_info (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS board (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    summary TEXT,
    date TEXT,
    tag TEXT
  )`);
  await db.execute(`DROP TABLE IF EXISTS matches`);
  await db.execute(`CREATE TABLE matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rival TEXT,
    date TEXT,
    time TEXT,
    venue TEXT,
    home INTEGER,
    competition TEXT DEFAULT 'Liga',
    round TEXT,
    result TEXT
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    home TEXT,
    away TEXT,
    homeScore INTEGER,
    awayScore INTEGER,
    venue TEXT
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS standings (
    pos INTEGER PRIMARY KEY,
    team TEXT,
    played INTEGER,
    won INTEGER,
    drawn INTEGER,
    lost INTEGER,
    gf INTEGER,
    ga INTEGER,
    pts INTEGER
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS appearance (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    salt TEXT NOT NULL,
    type TEXT DEFAULT 'jugador',
    playerName TEXT
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    filename TEXT NOT NULL,
    uploadedBy TEXT,
    date TEXT DEFAULT (date('now'))
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playerId INTEGER NOT NULL,
    matchId INTEGER,
    technique INTEGER DEFAULT 0,
    tactics INTEGER DEFAULT 0,
    physical INTEGER DEFAULT 0,
    mental INTEGER DEFAULT 0,
    attitude INTEGER DEFAULT 0,
    comment TEXT,
    evaluator TEXT,
    date TEXT DEFAULT (date('now'))
  )`);
}

async function seedNeeded() {
  const row = (await db.execute('SELECT COUNT(*) as c FROM players')).rows[0];
  if (row.c === 0) return true;
  const check = (await db.execute('SELECT number FROM players WHERE id=1')).rows[0];
  const num = check ? Number(check.number) : 0;
  if (num !== 33) {
    const photoRows = (await db.execute('SELECT id, photo FROM players WHERE photo IS NOT NULL AND photo != ""')).rows;
    globalThis._savedPhotos = {};
    for (const r of photoRows) globalThis._savedPhotos[Number(r.id)] = r.photo;
    const tables = ['players','convocatoria','formation','board','staff','club_info','news','matches','results','standings','appearance','users','evaluations'];
    for (const t of tables) {
      try { await db.execute('DELETE FROM ' + t); } catch(e) {}
    }
    return true;
  }
  return false;
}

async function seedData() {
  const s = [];
  const tables = ['players','convocatoria','formation','board','staff','club_info','news','matches','results','standings','appearance','users','evaluations'];
  for (const t of tables) s.push({ sql: `DELETE FROM ${t}`, args: [] });
  const P = (sql, args) => s.push({ sql, args });
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [1,"Carlos Caamaño Cambon","Caamaño",33,"portero",49,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [2,"Miguel Ángel Garea Parga","Garea",1,"defensa,centrocampista",46,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [3,"David Mourelo Mouzo","Mourelo",10,"defensa,centrocampista,delantero",36,"no_disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [4,"Alfonso Martínez Váquez","Alfonso",24,"delantero,defensa",39,"disponible",1]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [5,"Carlos M. Álvarez Labora","Charlie",39,"delantero,defensa",56,"no_disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [6,"Diego Fernández Cabana","Cabana",20,"centrocampista,defensa",46,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [7,"Miguel Amor Haz","Miguel",2,"defensa,centrocampista,delantero",46,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [8,"Iván Fernández Álvarez","Pirulo",14,"portero,defensa,centrocampista,delantero",46,"no_disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [9,"Gonzalo Ferro Rozas","Ferro",32,"delantero,centrocampista",46,"lesionado",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [10,"Miguel Boo Fernández","Boo",31,"delantero,defensa",41,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [11,"Santiago Seijo Cancelo","Santi",28,"centrocampista,defensa",46,"no_disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [12,"Sergio Seijo Cancelo","Sergio",28,"centrocampista,defensa",38,"no_disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [13,"Bernardo Gómez Cagiao","Bernardo",45,"defensa,centrocampista",47,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [14,"Jose Luis Mallo López","Pepe",1,"delantero,defensa",41,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [15,"Antonio Seoane Barros","Toni",33,"centrocampista,defensa",39,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [16,"César Freire Lesta","César",10,"defensa,centrocampista,delantero",46,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [17,"Alberto Durán Alfonsín","Durán",34,"centrocampista",42,"no_disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [18,"Alberto Roibás Naveiro","Roibás",26,"defensa,centrocampista",45,"no_disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [19,"Pablo Graña Pita","Graña",8,"centrocampista,defensa",42,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [20,"Javier Vizoso Guerra","Vizoso",7,"centrocampista",54,"lesionado",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [21,"Francisco Lata Cortes","Lata",37,"defensa,centrocampista",41,"no_disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [23,"Julio Teixeira Fernández","Julio",7,"centrocampista",45,"disponible",0]);
  for (const id of [8,7,12,26,20,2,13,14,16,15]) P('INSERT INTO convocatoria (playerId) VALUES (?)', [id]);
  P('INSERT INTO formation (id,name,positions) VALUES (1,?,?)', ['4-3-2',JSON.stringify([{playerId:8,x:50,y:85},{playerId:2,x:20,y:65},{playerId:13,x:37,y:65},{playerId:16,x:63,y:65},{playerId:15,x:80,y:65},{playerId:7,x:30,y:45},{playerId:12,x:50,y:45},{playerId:26,x:70,y:45},{playerId:14,x:37,y:20},{playerId:20,x:63,y:20}])]);
  for (const [k,v] of Object.entries({federationName:"Sada F.C. A Nosa Viña (Veteranos)",federationAddress:"Reboredo, 20 Ouces - 15165 Bergondo, A Coruña",stadium:"Campo Municipal de Sada",stadiumAddress:"Avda. de la Marina, s/n - 15160 Sada",stadiumCapacity:"2.000 espectadores",founded:"1975",president:"D. Diego Fernández Cabana",cif:"G70501242",phone1:"663495926",phone2:"659833245",email:"diegofernandezcabana@gmail.com"})) P('INSERT INTO club_info (key,value) VALUES (?,?)', [k,v]);
  P('INSERT INTO staff (id,name,role) VALUES (?,?,?)', [1,"Fran Naveira","Entrenador"]);
  P('INSERT INTO staff (id,name,role) VALUES (?,?,?)', [2,"Santi Seijo","Entrenador Auxiliar"]);
  P('INSERT INTO board (id,name,role) VALUES (?,?,?)', [1,"Diego Fernández Cabana","Presidente"]);
  P('INSERT INTO board (id,name,role) VALUES (?,?,?)', [2,"Iván Fernández Álvarez","Secretario"]);
  P('INSERT INTO board (id,name,role) VALUES (?,?,?)', [3,"Santiago Seijo Cancelo","Vicesecretario"]);
  P('INSERT INTO board (id,name,role) VALUES (?,?,?)', [4,"Alberto Roibás Naveiro","Tesorero"]);
  P('INSERT INTO board (id,name,role) VALUES (?,?,?)', [5,"Gonzalo Ferro Rozas","Vocal"]);
  P('INSERT INTO news (id,title,summary,date,tag) VALUES (?,?,?,?,?)', [1,"Derrota para aprender de los errores","Hemos perdido nuestro primer partido amistoso contra un rival de menor categoria por demeritos propios, tres fallos en defensa condenaron al equipo a ir a remolque todo el partido, mejorando sustanciablemente en la segunda parte con la entrada de los revulsivos. Derrota para aprender.","2026-07-25","Crónica"]);
  P('INSERT INTO news (id,title,summary,date,tag) VALUES (?,?,?,?,?)', [2,"Debut de Julio","Julio debuta en el amistoso contra el SPM con gran rendimiento.","2026-07-22","Fichaje"]);
  P('INSERT INTO news (id,title,summary,date,tag) VALUES (?,?,?,?,?)', [3,"Vizoso, baja temporal","Vizoso recae de un problema en el tendon de aquiles que le tendrá entre 2 y 3 semanas de baja. El equipo le desea una pronta recuperación.","2026-07-18","Bajas"]);
  P('INSERT INTO news (id,title,summary,date,tag) VALUES (?,?,?,?,?)', [4,"Temporada 2026/27 - Objetivo: ascenso","La directiva del club ha confirmado que el objetivo de la temporada será el ascenso de categoría. Se ha reforzado la plantilla con varios fichajes estratégicos.","2026-07-10","Club"]);
  P('INSERT INTO news (id,title,summary,date,tag) VALUES (?,?,?,?,?)', [5,"Amistoso vs Carnoedo","Este domingo 23 de agosto a las 10:00 jugamos un amistoso en el Campo del Carnoedo. ¡Todos a animar!","2026-08-23","Partido"]);
  for (const m of [
    [1,"C.D. Larín","2026-09-05","19:00","Meicende Grande (Arteixo)",0,"Copa","Treintadosavos","1-4"],
    [2,"Narón Silver Catering","2026-09-13","10:00","O Cabaixo",0,"Liga","J1",null],
    [3,"Sporting Cambre As Travesas","2026-09-19",null,"As Marías",1,"Liga","J2",null],
    [4,"Portazgo S.D.","2026-09-26",null,"A Lavandeira (Culleredo)",0,"Liga","J3",null],
    [5,"Liceo de Monelos S.D.","2026-10-03",null,"As Marías",1,"Liga","J4",null],
    [6,"Xuventude Dorneda","2026-10-10",null,"A Marola",0,"Liga","J5",null],
    [7,"Cedeira S.D.","2026-10-17",null,"As Marías",1,"Liga","J6",null],
    [8,"Betanzos Norte","2026-10-24",null,"O Carregal (Betanzos)",0,"Liga","J7",null],
    [9,"Atlético Perillo","2026-10-31",null,"O Redondo (Monterrei)",0,"Copa","Dieciseisavos",null],
    [10,"C.D. Sigras","2026-11-07",null,"As Marías",1,"Liga","J8",null],
    [11,"Campanal de Loureda F.C.","2026-11-15","11:00","Campo de Freián",0,"Liga","J9",null],
    [12,"U.D. Narahío","2026-11-21",null,"As Marías",1,"Liga","J10",null],
    [13,"Sporting Burgo","2026-11-28",null,"A Lavandeira (Culleredo)",0,"Liga","J11",null],
    [14,"U.D. Paiosaco H.Añón","2026-12-05",null,"As Marías",1,"Liga","J12",null],
    [15,"Oza de los Ríos","2026-12-12",null,"O Loureiro (Oza De Los Rios)",0,"Liga","J13",null],
    [16,"San Martín S.D.","2026-12-19",null,"A Revolta (Queixas)",0,"Liga","J14",null]
  ]) P('INSERT INTO matches (id,rival,date,time,venue,home,competition,round,result) VALUES (?,?,?,?,?,?,?,?,?)', m);
  for (const r of [[1,"2026-07-25","Sada CF","CD Pilar",3,1,"Campo de Sada"],[2,"2026-07-18","UD Ponte","Sada CF",0,2,"Campo da Ponte"],[3,"2026-07-11","Sada CF","CF Narón",1,1,"Campo de Sada"],[4,"2026-07-04","SD Bergondo","Sada CF",2,1,"Campo de Bergondo"],[5,"2026-06-27","Sada CF","CD Meira",4,0,"Campo de Sada"],[6,"2026-06-20","UD Montaña","Sada CF",1,3,"Campo da Montaña"]]) P('INSERT INTO results (id,date,home,away,homeScore,awayScore,venue) VALUES (?,?,?,?,?,?,?)', r);
  for (const st of [[1,"Sada CF",14,10,2,2,28,10,32],[2,"CD Pilar",14,9,3,2,25,12,30],[3,"UD Ponte",14,8,2,4,22,15,26],[4,"CF Narón",14,7,4,3,20,14,25],[5,"SD Bergondo",14,7,2,5,19,16,23],[6,"CD Meira",14,6,3,5,18,17,21],[7,"UD Montaña",14,5,2,7,15,20,17],[8,"CD Oleiros",14,4,3,7,14,21,15],[9,"SD Culleredo",14,4,1,9,12,24,13],[10,"CF Cambre",14,3,2,9,10,26,11]]) P('INSERT INTO standings (pos,team,played,won,drawn,lost,gf,ga,pts) VALUES (?,?,?,?,?,?,?,?,?)', st);
  P('INSERT INTO appearance (key,value) VALUES (?,?)', ['primaryColor','#1e40af']);
  P('INSERT INTO appearance (key,value) VALUES (?,?)', ['brandName','Sada F.C. A Nosa Viña (Veteranos)']);
  P('INSERT INTO appearance (key,value) VALUES (?,?)', ['logoText','SADA']);
  P('INSERT INTO appearance (key,value) VALUES (?,?)', ['teamLogo','/assets/logo.jpeg']);
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync('admin123', salt, 10000, 64, 'sha512').toString('hex');
  P('INSERT INTO users (username,password,salt,type,playerName) VALUES (?,?,?,?,?)', ['admin',hash,salt,'admin',null]);
  const salt2 = crypto.randomBytes(16).toString('hex');
  const hash2 = crypto.pbkdf2Sync('1234', salt2, 10000, 64, 'sha512').toString('hex');
  P('INSERT INTO users (username,password,salt,type,playerName) VALUES (?,?,?,?,?)', ['usuario',hash2,salt2,'jugador',null]);
  await db.batch(s);
  if (globalThis._savedPhotos) {
    for (const [id, photo] of Object.entries(globalThis._savedPhotos)) {
      await db.execute({ sql: 'UPDATE players SET photo=? WHERE id=?', args: [photo, Number(id)] });
    }
    delete globalThis._savedPhotos;
  }
}

// --- API: INIT (load all data) ---
app.get('/api/init', async (req, res) => {
  const players = (await db.execute('SELECT * FROM players ORDER BY id')).rows;
  const convocatoria = (await db.execute('SELECT playerId FROM convocatoria')).rows.map(r => r.playerId);
  const formationRow = (await db.execute('SELECT * FROM formation WHERE id = 1')).rows[0];
  const formation = { name: formationRow.name, positions: JSON.parse(formationRow.positions) };

  const clubInfoRows = (await db.execute('SELECT * FROM club_info')).rows;
  const clubInfo = {};
  clubInfoRows.forEach(r => clubInfo[r.key] = r.value);

  const staff = (await db.execute('SELECT * FROM staff ORDER BY id')).rows;
  const board = (await db.execute('SELECT * FROM board ORDER BY id')).rows;
  const news = (await db.execute('SELECT * FROM news ORDER BY date DESC')).rows;
  const matches = (await db.execute('SELECT * FROM matches ORDER BY date')).rows;
  const results = (await db.execute('SELECT * FROM results ORDER BY date DESC')).rows;
  const standings = (await db.execute('SELECT * FROM standings ORDER BY pos')).rows;

  const appearanceRows = (await db.execute('SELECT * FROM appearance')).rows;
  const appearance = {};
  appearanceRows.forEach(r => appearance[r.key] = r.value);

  const users = (await db.execute('SELECT id, username, type, playerName FROM users')).rows;

  res.json({ players, convocatoria, formation, clubInfo, staff, board, news, matches, results, standings, appearance, users });
});

// --- API: PLAYERS ---
app.put('/api/players/:id', async (req, res) => {
  const { name, nickname, number, position, age, status, goals, yellowCards, redCards, recoveryDate, photo } = req.body;
  const newStatus = status || 'disponible';
  await db.execute({ sql: 'UPDATE players SET name=?, nickname=?, number=?, position=?, age=?, status=?, goals=?, yellowCards=?, redCards=?, recoveryDate=?, photo=? WHERE id=?', args: [name, nickname || null, number, position, age || null, newStatus, goals || 0, yellowCards || 0, redCards || 0, recoveryDate || null, photo || null, req.params.id] });
  const pid = parseInt(req.params.id);
  if (newStatus !== 'disponible') {
    const fRow = (await db.execute('SELECT positions FROM formation WHERE id = 1')).rows[0];
    if (fRow) {
      const positions = JSON.parse(fRow.positions).filter(p => p.playerId !== pid);
      await db.execute({ sql: 'UPDATE formation SET positions = ? WHERE id = 1', args: [JSON.stringify(positions)] });
    }
    await db.execute({ sql: 'DELETE FROM convocatoria WHERE playerId = ?', args: [pid] });
  }
  res.json({ ok: true });
});

app.post('/api/players', async (req, res) => {
  const { name, nickname, number, position, age } = req.body;
  const info = await db.execute({ sql: 'INSERT INTO players (name, nickname, number, position, age, status, goals, yellowCards, redCards) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)', args: [name, nickname || null, number, position, age || null, 'disponible'] });
  res.json({ id: Number(info.lastInsertRowid) });
});

app.delete('/api/players/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM players WHERE id = ?', args: [req.params.id] });
  await db.execute({ sql: 'DELETE FROM convocatoria WHERE playerId = ?', args: [req.params.id] });
  const fRow = (await db.execute('SELECT positions FROM formation WHERE id = 1')).rows[0];
  const positions = JSON.parse(fRow.positions).filter(p => p.playerId !== parseInt(req.params.id));
  await db.execute({ sql: 'UPDATE formation SET positions = ? WHERE id = 1', args: [JSON.stringify(positions)] });
  res.json({ ok: true });
});

app.put('/api/players/:id/stats', async (req, res) => {
  const { goals, yellowCards, redCards } = req.body;
  await db.execute({ sql: 'UPDATE players SET goals=?, yellowCards=?, redCards=? WHERE id=?', args: [goals, yellowCards, redCards, req.params.id] });
  res.json({ ok: true });
});

app.put('/api/players/:id/photo', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió archivo' });
  const photoUrl = '/uploads/' + req.file.filename;
  await db.execute({ sql: 'UPDATE players SET photo=? WHERE id=?', args: [photoUrl, req.params.id] });
  res.json({ ok: true, photo: photoUrl });
});

// --- API: CONVOCATORIA ---
app.put('/api/convocatoria', async (req, res) => {
  const { playerIds } = req.body;
  const stmts = [{ sql: 'DELETE FROM convocatoria' }];
  for (const id of playerIds) {
    stmts.push({ sql: 'INSERT INTO convocatoria (playerId) VALUES (?)', args: [id] });
  }
  await db.batch(stmts);
  res.json({ ok: true });
});

// --- API: FORMATION ---
app.put('/api/formation', async (req, res) => {
  const { name, positions } = req.body;
  await db.execute({ sql: 'UPDATE formation SET name=?, positions=? WHERE id=1', args: [name, JSON.stringify(positions)] });
  res.json({ ok: true });
});

// --- API: CLUB INFO ---
app.put('/api/club-info', async (req, res) => {
  for (const [k, v] of Object.entries(req.body)) {
    await db.execute({ sql: 'INSERT OR REPLACE INTO club_info (key, value) VALUES (?, ?)', args: [k, v] });
  }
  res.json({ ok: true });
});

// --- API: STAFF ---
app.post('/api/staff', async (req, res) => {
  const { name, role } = req.body;
  const info = await db.execute({ sql: 'INSERT INTO staff (name, role) VALUES (?, ?)', args: [name, role] });
  res.json({ id: Number(info.lastInsertRowid) });
});

app.put('/api/staff/:id', async (req, res) => {
  const { name, role } = req.body;
  await db.execute({ sql: 'UPDATE staff SET name=?, role=? WHERE id=?', args: [name, role, req.params.id] });
  res.json({ ok: true });
});

app.delete('/api/staff/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM staff WHERE id = ?', args: [req.params.id] });
  res.json({ ok: true });
});

// --- API: BOARD ---
app.post('/api/board', async (req, res) => {
  const { name, role } = req.body;
  const info = await db.execute({ sql: 'INSERT INTO board (name, role) VALUES (?, ?)', args: [name, role] });
  res.json({ id: Number(info.lastInsertRowid) });
});

app.put('/api/board/:id', async (req, res) => {
  const { name, role } = req.body;
  await db.execute({ sql: 'UPDATE board SET name=?, role=? WHERE id=?', args: [name, role, req.params.id] });
  res.json({ ok: true });
});

app.delete('/api/board/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM board WHERE id = ?', args: [req.params.id] });
  res.json({ ok: true });
});

// --- API: NEWS ---
app.post('/api/news', async (req, res) => {
  const { title, summary, date, tag } = req.body;
  const info = await db.execute({ sql: 'INSERT INTO news (title, summary, date, tag) VALUES (?, ?, ?, ?)', args: [title, summary || '', date || new Date().toISOString().slice(0, 10), tag || ''] });
  res.json({ id: Number(info.lastInsertRowid) });
});

app.put('/api/news/:id', async (req, res) => {
  const { title, summary, date, tag } = req.body;
  await db.execute({ sql: 'UPDATE news SET title=?, summary=?, date=?, tag=? WHERE id=?', args: [title, summary || '', date || '', tag || '', req.params.id] });
  res.json({ ok: true });
});

app.delete('/api/news/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM news WHERE id = ?', args: [req.params.id] });
  res.json({ ok: true });
});

// --- API: APPEARANCE ---
app.put('/api/appearance', async (req, res) => {
  for (const [k, v] of Object.entries(req.body)) {
    await db.execute({ sql: 'INSERT OR REPLACE INTO appearance (key, value) VALUES (?, ?)', args: [k, v] });
  }
  res.json({ ok: true });
});

// --- API: AUTH ---
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = (await db.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [username] })).rows[0];
  if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  const hash = hashPassword(password, user.salt);
  if (hash !== user.password) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  res.json({ id: user.id, username: user.username, type: user.type, playerName: user.playerName });
});

// --- API: USERS ---
app.get('/api/users', async (req, res) => {
  const users = (await db.execute('SELECT id, username, type, playerName FROM users')).rows;
  res.json(users);
});

app.post('/api/users', async (req, res) => {
  const { username, password, type, playerName } = req.body;
  const existing = (await db.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: [username] })).rows[0];
  if (existing) return res.status(409).json({ error: 'El usuario ya existe' });
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  const info = await db.execute({ sql: 'INSERT INTO users (username, password, salt, type, playerName) VALUES (?, ?, ?, ?, ?)', args: [username, hash, salt, type, playerName || null] });
  res.json({ id: Number(info.lastInsertRowid) });
});

app.put('/api/users/:id', async (req, res) => {
  const { username, password, type, playerName } = req.body;
  if (password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    await db.execute({ sql: 'UPDATE users SET username=?, password=?, salt=?, type=?, playerName=? WHERE id=?', args: [username, hash, salt, type, playerName || null, req.params.id] });
  } else {
    await db.execute({ sql: 'UPDATE users SET username=?, type=?, playerName=? WHERE id=?', args: [username, type, playerName || null, req.params.id] });
  }
  res.json({ ok: true });
});

app.delete('/api/users/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [req.params.id] });
  res.json({ ok: true });
});

// --- PHOTOS ---
app.get('/api/photos', async (req, res) => {
  const photos = (await db.execute('SELECT * FROM photos ORDER BY date DESC, id DESC')).rows;
  res.json(photos);
});

app.post('/api/photos', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió archivo' });
  const { title, description, uploadedBy } = req.body;
  const info = await db.execute({ sql: `INSERT INTO photos (title, description, filename, uploadedBy, date) VALUES (?, ?, ?, ?, date('now'))`, args: [title || null, description || null, req.file.filename, uploadedBy || null] });
  res.json({ id: Number(info.lastInsertRowid), filename: req.file.filename });
});

app.delete('/api/photos/:id', async (req, res) => {
  const photo = (await db.execute({ sql: 'SELECT filename FROM photos WHERE id = ?', args: [req.params.id] })).rows[0];
  if (photo) {
    const filePath = path.join(uploadsDir, photo.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  await db.execute({ sql: 'DELETE FROM photos WHERE id = ?', args: [req.params.id] });
  res.json({ ok: true });
});

// --- EVALUATIONS ---
app.get('/api/evaluations', async (req, res) => {
  const { playerId } = req.query;
  let evals;
  if (playerId) {
    evals = (await db.execute({ sql: `SELECT e.*, m.rival as matchRival, m.date as matchDate, m.home as matchHome FROM evaluations e LEFT JOIN matches m ON e.matchId = m.id WHERE e.playerId = ? ORDER BY e.date DESC, e.id DESC`, args: [playerId] })).rows;
  } else {
    evals = (await db.execute(`SELECT e.*, m.rival as matchRival, m.date as matchDate, m.home as matchHome FROM evaluations e LEFT JOIN matches m ON e.matchId = m.id ORDER BY e.date DESC, e.id DESC`)).rows;
  }
  res.json(evals);
});

app.get('/api/evaluations/player/:id', async (req, res) => {
  const evals = (await db.execute({ sql: `SELECT e.*, m.rival as matchRival, m.date as matchDate, m.home as matchHome FROM evaluations e LEFT JOIN matches m ON e.matchId = m.id WHERE e.playerId = ? ORDER BY e.date DESC, e.id DESC`, args: [req.params.id] })).rows;
  res.json(evals);
});

app.post('/api/evaluations', async (req, res) => {
  const { playerId, matchId, technique, tactics, physical, mental, attitude, comment, evaluator } = req.body;
  const info = await db.execute({ sql: `INSERT INTO evaluations (playerId, matchId, technique, tactics, physical, mental, attitude, comment, evaluator, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'))`, args: [playerId, matchId || null, technique || 0, tactics || 0, physical || 0, mental || 0, attitude || 0, comment || null, evaluator || null] });
  res.json({ id: Number(info.lastInsertRowid) });
});

app.delete('/api/evaluations/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM evaluations WHERE id = ?', args: [req.params.id] });
  res.json({ ok: true });
});

// --- START ---
async function start() {
  await initDB();
  if (await seedNeeded()) await seedData();
  app.listen(PORT, () => {
    console.log(`Sada CF Portal running at http://localhost:${PORT}`);
  });
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });
