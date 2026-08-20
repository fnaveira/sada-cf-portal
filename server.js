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
  await db.execute(`CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rival TEXT,
    date TEXT,
    time TEXT,
    venue TEXT,
    home INTEGER
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
  return row.c === 0;
}

async function seedData() {
  const s = [];
  const P = (sql, args) => s.push({ sql, args });
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [1,"Carlos Caamaño","Caamaño",1,"portero",50,"no_disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [2,"Miguel Ángel Garea Parga","Garea",4,"defensa,centrocampista",46,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [3,"David Mourelo Mouzo","Mourelo",5,"defensa,centrocampista,delantero",37,"no_disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [4,"Alfonso Martínez Váquez","Alfonso",20,"delantero,defensa",39,"disponible",1]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [5,"Carlos M. Álvarez Labora","Charlie",21,"delantero,defensa",56,"no_disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [6,"Diego Fernández Cabana","Cabana",12,"centrocampista,defensa",46,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [7,"Miguel Amor Haz","Miguel",6,"defensa,centrocampista,delantero",46,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [8,"Iván Fernández Álvarez","Pirulo",2,"portero,defensa,centrocampista,delantero",46,"no_disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [9,"Gonzalo Ferro Rozas","Ferro",22,"delantero,centrocampista",46,"lesionado",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [10,"Miguel Boo Fernández","Boo",23,"delantero,defensa",41,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [11,"Santiago Seijo Cancelo","Santi",13,"centrocampista,defensa",46,"no_disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [12,"Sergio Seijo Cancelo","Sergio",14,"centrocampista,defensa",38,"no_disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [13,"Bernardo Gómez Cagiao","Bernardo",7,"defensa,centrocampista",40,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [14,"Jose Luis Mallo López","Pepe",24,"delantero,defensa",42,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [15,"Antonio Seoane Barros","Toni",15,"centrocampista,defensa",39,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [16,"César Freire Lesta","César",8,"defensa,centrocampista,delantero",46,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [17,"Alberto Durán Alfonsín","Durán",16,"centrocampista",42,"no_disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [18,"Alberto Roibás Naveiro","Roibás",9,"defensa,centrocampista",45,"no_disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [19,"Pablo Graña Pita","Graña",17,"centrocampista,defensa",42,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [20,"Javier Vizoso Guerra","Vizoso",18,"centrocampista",55,"lesionado",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [21,"Francisco Lata Cortes","Lata",10,"defensa,centrocampista",41,"no_disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [22,"Manuel Cortes","Manolo",3,"portero",50,"disponible",0]);
  P('INSERT INTO players (id,name,nickname,number,position,age,status,goals,yellowCards,redCards) VALUES (?,?,?,?,?,?,?,?,0,0)', [23,"Julio",null,25,"centrocampista",46,"disponible",0]);
  for (const id of [2,4,6,7,10,14,15,16,19,22,23]) P('INSERT INTO convocatoria (playerId) VALUES (?)', [id]);
  P('INSERT INTO formation (id,name,positions) VALUES (1,?,?)', ['4-2-3-1',JSON.stringify([{playerId:22,x:50,y:85},{playerId:4,x:20,y:65},{playerId:2,x:37,y:65},{playerId:10,x:63,y:65},{playerId:7,x:80,y:65},{playerId:15,x:32,y:48},{playerId:16,x:68,y:48},{playerId:14,x:18,y:35},{playerId:6,x:50,y:32},{playerId:23,x:82,y:35},{playerId:19,x:50,y:18}])]);
  for (const [k,v] of Object.entries({federationName:"Sada F.C. A Nosa Viña (Veteranos)",federationAddress:"Calle del Deporte, 15 - 15160 Sada, A Coruña, Galicia",stadium:"Campo Municipal de Sada",stadiumAddress:"Avda. de la Marina, s/n - 15160 Sada",stadiumCapacity:"2.000 espectadores",founded:"1975",president:"D. Diego Fernández Cabana"})) P('INSERT INTO club_info (key,value) VALUES (?,?)', [k,v]);
  P('INSERT INTO staff (id,name,role) VALUES (?,?,?)', [1,"Fran Naveira","Entrenador"]);
  P('INSERT INTO staff (id,name,role) VALUES (?,?,?)', [2,"Santi Seijo","Entrenador Auxiliar"]);
  P('INSERT INTO board (id,name,role) VALUES (?,?,?)', [1,"D. Diego Fernández Cabana","Presidente"]);
  P('INSERT INTO board (id,name,role) VALUES (?,?,?)', [2,"D. Carlos Méndez Vizoso","Vicepresidente"]);
  P('INSERT INTO board (id,name,role) VALUES (?,?,?)', [3,"D. Antonio Garea Blanco","Secretario"]);
  P('INSERT INTO board (id,name,role) VALUES (?,?,?)', [4,"D. Miguel Amor Rodríguez","Tesorero"]);
  P('INSERT INTO news (id,title,summary,date,tag) VALUES (?,?,?,?,?)', [1,"Derrota para aprender de los errores","Hemos perdido nuestro primer partido amistoso contra un rival de menor categoria por demeritos propios, tres fallos en defensa condenaron al equipo a ir a remolque todo el partido, mejorando sustanciablemente en la segunda parte con la entrada de los revulsivos. Derrota para aprender.","2026-07-25","Crónica"]);
  P('INSERT INTO news (id,title,summary,date,tag) VALUES (?,?,?,?,?)', [2,"Debut de Julio","Julio debuta en el amistoso contra el SPM con gran rendimiento.","2026-07-22","Fichaje"]);
  P('INSERT INTO news (id,title,summary,date,tag) VALUES (?,?,?,?,?)', [3,"Vizoso, baja temporal","Vizoso recae de un problema en el tendon de aquiles que le tendrá entre 2 y 3 semanas de baja. El equipo le desea una pronta recuperación.","2026-07-18","Bajas"]);
  P('INSERT INTO news (id,title,summary,date,tag) VALUES (?,?,?,?,?)', [4,"Temporada 2026/27 - Objetivo: ascenso","La directiva del club ha confirmado que el objetivo de la temporada será el ascenso de categoría. Se ha reforzado la plantilla con varios fichajes estratégicos.","2026-07-10","Club"]);
  P('INSERT INTO news (id,title,summary,date,tag) VALUES (?,?,?,?,?)', [5,"Amistoso vs Carnoedo","Este domingo 23 de agosto a las 10:00 jugamos un amistoso en el Campo del Carnoedo. ¡Todos a animar!","2026-08-23","Partido"]);
  for (const m of [[1,"CD Rival","2026-08-02","18:00","Campo Municipal",1],[2,"UD Puente","2026-08-09","12:00","Campo de La Puente",0],[3,"SD Montaña","2026-08-16","18:00","Campo Municipal",1],[4,"CF Río","2026-08-23","17:30","Estadio del Río",0],[5,"Atlético Norte","2026-08-30","18:00","Campo Municipal",1],[6,"CD Valles","2026-09-06","12:00","Campo de Los Valles",0],[7,"UD Solana","2026-09-13","18:00","Campo Municipal",1],[8,"CD Olivo","2026-09-20","17:00","Campo del Olivo",0]]) P('INSERT INTO matches (id,rival,date,time,venue,home) VALUES (?,?,?,?,?,?)', m);
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
  const { name, nickname, number, position, age, status, goals, yellowCards, redCards, recoveryDate } = req.body;
  const newStatus = status || 'disponible';
  await db.execute({ sql: 'UPDATE players SET name=?, nickname=?, number=?, position=?, age=?, status=?, goals=?, yellowCards=?, redCards=?, recoveryDate=? WHERE id=?', args: [name, nickname || null, number, position, age || null, newStatus, goals || 0, yellowCards || 0, redCards || 0, recoveryDate || null, req.params.id] });
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
