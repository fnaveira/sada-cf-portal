const express = require('express');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');

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

// --- DATABASE ---
const db = new DatabaseSync(path.join(__dirname, 'sada.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      nickname TEXT,
      number INTEGER NOT NULL,
      position TEXT NOT NULL,
      age INTEGER,
      status TEXT DEFAULT 'disponible',
      goals INTEGER DEFAULT 0,
      yellowCards INTEGER DEFAULT 0,
      redCards INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS convocatoria (
      playerId INTEGER PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS formation (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT DEFAULT '4-4-2',
      positions TEXT DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS club_info (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS board (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      summary TEXT,
      date TEXT,
      tag TEXT
    );
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rival TEXT,
      date TEXT,
      time TEXT,
      venue TEXT,
      home INTEGER
    );
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      home TEXT,
      away TEXT,
      homeScore INTEGER,
      awayScore INTEGER,
      venue TEXT
    );
    CREATE TABLE IF NOT EXISTS standings (
      pos INTEGER PRIMARY KEY,
      team TEXT,
      played INTEGER,
      won INTEGER,
      drawn INTEGER,
      lost INTEGER,
      gf INTEGER,
      ga INTEGER,
      pts INTEGER
    );
    CREATE TABLE IF NOT EXISTS appearance (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      salt TEXT NOT NULL,
      type TEXT DEFAULT 'jugador',
      playerName TEXT
    );
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      filename TEXT NOT NULL,
      uploadedBy TEXT,
      date TEXT DEFAULT (date('now'))
    );
    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playerId INTEGER NOT NULL,
      technique INTEGER DEFAULT 0,
      tactics INTEGER DEFAULT 0,
      physical INTEGER DEFAULT 0,
      mental INTEGER DEFAULT 0,
      attitude INTEGER DEFAULT 0,
      comment TEXT,
      evaluator TEXT,
      date TEXT DEFAULT (date('now'))
    );
  `);
}

function seedNeeded() {
  const row = db.prepare('SELECT COUNT(*) as c FROM players').get();
  return row.c === 0;
}

function seedData() {
  const insertPlayer = db.prepare('INSERT INTO players (id, name, nickname, number, position, age, status, goals, yellowCards, redCards) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0)');
  const players = [
    [1,"Carlos Caamaño","Caamaño",1,"portero",50,"no_disponible"],
    [2,"Miguel Ángel Garea Parga","Garea",4,"defensa,centrocampista",46,"disponible"],
    [3,"David Mourelo Mouzo","Mourelo",5,"defensa,centrocampista,delantero",37,"no_disponible"],
    [4,"Alfonso Martínez Váquez","Alfonso",20,"delantero,defensa",39,"disponible"],
    [5,"Carlos M. Álvarez Labora","Charlie",21,"delantero,defensa",56,"no_disponible"],
    [6,"Diego Fernández Cabana","Cabana",12,"centrocampista,defensa",46,"disponible"],
    [7,"Miguel Amor Haz","Miguel",6,"defensa,centrocampista,delantero",46,"disponible"],
    [8,"Iván Fernández Álvarez","Pirulo",2,"portero,defensa,centrocampista,delantero",46,"no_disponible"],
    [9,"Gonzalo Ferro Rozas","Ferro",22,"delantero,centrocampista",46,"lesionado"],
    [10,"Miguel Boo Fernández","Boo",23,"delantero,defensa",41,"disponible"],
    [11,"Santiago Seijo Cancelo","Santi",13,"centrocampista,defensa",46,"no_disponible"],
    [12,"Sergio Seijo Cancelo","Sergio",14,"centrocampista,defensa",38,"no_disponible"],
    [13,"Bernardo Gómez Cagiao","Bernardo",7,"defensa,centrocampista",40,"disponible"],
    [14,"Jose Luis Mallo López","Pepe",24,"delantero,defensa",42,"no_disponible"],
    [15,"Antonio Seoane Barros","Toni",15,"centrocampista,defensa",39,"disponible"],
    [16,"César Freire Lesta","César",8,"defensa,centrocampista,delantero",46,"disponible"],
    [17,"Alberto Durán Alfonsín","Durán",16,"centrocampista",42,"no_disponible"],
    [18,"Alberto Roibás Naveiro","Roibás",9,"defensa,centrocampista",45,"no_disponible"],
    [19,"Pablo Graña Pita","Graña",17,"centrocampista,defensa",42,"disponible"],
    [20,"Javier Vizoso Guerra","Vizoso",18,"centrocampista",55,"lesionado"],
    [21,"Francisco Lata Cortes","Lata",10,"defensa,centrocampista",41,"no_disponible"],
    [22,"Manuel Cortes","Manolo",3,"portero",50,"disponible"],
    [23,"Julio",null,25,"centrocampista",46,"disponible"]
  ];
  for (const p of players) insertPlayer.run(...p);

  const insertConv = db.prepare('INSERT INTO convocatoria (playerId) VALUES (?)');
  for (const id of [2,4,6,7,10,15,16,19,20,22,23]) insertConv.run(id);

    db.prepare('INSERT INTO formation (id, name, positions) VALUES (1, ?, ?)').run(
    '4-2-3-1',
    JSON.stringify([
      {playerId:22,x:50,y:85},
      {playerId:4,x:20,y:65},{playerId:2,x:37,y:65},{playerId:10,x:63,y:65},{playerId:7,x:80,y:65},
      {playerId:15,x:32,y:48},{playerId:16,x:68,y:48},
      {playerId:14,x:18,y:35},{playerId:6,x:50,y:32},{playerId:20,x:82,y:35},
      {playerId:19,x:50,y:18}
    ])
  );

  const clubData = {
    federationName: "Sada F.C. A Nosa Viña (Veteranos)",
    federationAddress: "Calle del Deporte, 15 - 15160 Sada, A Coruña, Galicia",
    stadium: "Campo Municipal de Sada",
    stadiumAddress: "Avda. de la Marina, s/n - 15160 Sada",
    stadiumCapacity: "2.000 espectadores",
    founded: "1975",
    president: "D. Diego Fernández Cabana"
  };
  const insertClub = db.prepare('INSERT INTO club_info (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(clubData)) insertClub.run(k, v);

  const insertStaff = db.prepare('INSERT INTO staff (id, name, role) VALUES (?, ?, ?)');
  [[1,"Fran Naveira","Entrenador"],[2,"Santi Seijo","Entrenador Auxiliar"]].forEach(s => insertStaff.run(...s));

  const insertBoard = db.prepare('INSERT INTO board (id, name, role) VALUES (?, ?, ?)');
  [[1,"D. Diego Fernández Cabana","Presidente"],[2,"D. Carlos Méndez Vizoso","Vicepresidente"],[3,"D. Antonio Garea Blanco","Secretario"],[4,"D. Miguel Amor Rodríguez","Tesorero"]].forEach(b => insertBoard.run(...b));

  const insertNews = db.prepare('INSERT INTO news (id, title, summary, date, tag) VALUES (?, ?, ?, ?, ?)');
  [
    [1,"Derrota para aprender de los errores","Hemos perdido nuestro primer partido amistoso contra un rival de menor categoria por demeritos propios, tres fallos en defensa condenaron al equipo a ir a remolque todo el partido, mejorando sustanciablemente en la segunda parte con la entrada de los revulsivos. Derrota para aprender.","2026-07-25","Crónica"],
    [2,"Debut de Julio","Julio debuta en el amistoso contra el SPM con gran rendimiento.","2026-07-22","Fichaje"],
    [3,"Vizoso, baja temporal","Vizoso recae de un problema en el tendon de aquiles que le tendrá entre 2 y 3 semanas de baja. El equipo le desea una pronta recuperación.","2026-07-18","Bajas"],
    [4,"Temporada 2026/27 - Objetivo: ascenso","La directiva del club ha confirmado que el objetivo de la temporada será el ascenso de categoría. Se ha reforzado la plantilla con varios fichajes estratégicos.","2026-07-10","Club"]
  ].forEach(n => insertNews.run(...n));

  const insertMatch = db.prepare('INSERT INTO matches (id, rival, date, time, venue, home) VALUES (?, ?, ?, ?, ?, ?)');
  [[1,"CD Rival","2026-08-02","18:00","Campo Municipal",1],[2,"UD Puente","2026-08-09","12:00","Campo de La Puente",0],[3,"SD Montaña","2026-08-16","18:00","Campo Municipal",1],[4,"CF Río","2026-08-23","17:30","Estadio del Río",0],[5,"Atlético Norte","2026-08-30","18:00","Campo Municipal",1],[6,"CD Valles","2026-09-06","12:00","Campo de Los Valles",0],[7,"UD Solana","2026-09-13","18:00","Campo Municipal",1],[8,"CD Olivo","2026-09-20","17:00","Campo del Olivo",0]].forEach(m => insertMatch.run(...m));

  const insertResult = db.prepare('INSERT INTO results (id, date, home, away, homeScore, awayScore, venue) VALUES (?, ?, ?, ?, ?, ?, ?)');
  [[1,"2026-07-25","Sada CF","CD Pilar",3,1,"Campo de Sada"],[2,"2026-07-18","UD Ponte","Sada CF",0,2,"Campo da Ponte"],[3,"2026-07-11","Sada CF","CF Narón",1,1,"Campo de Sada"],[4,"2026-07-04","SD Bergondo","Sada CF",2,1,"Campo de Bergondo"],[5,"2026-06-27","Sada CF","CD Meira",4,0,"Campo de Sada"],[6,"2026-06-20","UD Montaña","Sada CF",1,3,"Campo da Montaña"]].forEach(r => insertResult.run(...r));

  const insertStanding = db.prepare('INSERT INTO standings (pos, team, played, won, drawn, lost, gf, ga, pts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  [[1,"Sada CF",14,10,2,2,28,10,32],[2,"CD Pilar",14,9,3,2,25,12,30],[3,"UD Ponte",14,8,2,4,22,15,26],[4,"CF Narón",14,7,4,3,20,14,25],[5,"SD Bergondo",14,7,2,5,19,16,23],[6,"CD Meira",14,6,3,5,18,17,21],[7,"UD Montaña",14,5,2,7,15,20,17],[8,"CD Oleiros",14,4,3,7,14,21,15],[9,"SD Culleredo",14,4,1,9,12,24,13],[10,"CF Cambre",14,3,2,9,10,26,11]].forEach(s => insertStanding.run(...s));

  const insertApp = db.prepare('INSERT INTO appearance (key, value) VALUES (?, ?)');
  insertApp.run('primaryColor', '#1e40af');
  insertApp.run('brandName', 'Sada F.C. A Nosa Viña (Veteranos)');
  insertApp.run('logoText', 'SADA');

  // Default admin user
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync('admin123', salt, 10000, 64, 'sha512').toString('hex');
  db.prepare('INSERT INTO users (username, password, salt, type, playerName) VALUES (?, ?, ?, ?, ?)').run('admin', hash, salt, 'admin', null);
  const salt2 = crypto.randomBytes(16).toString('hex');
  const hash2 = crypto.pbkdf2Sync('1234', salt2, 10000, 64, 'sha512').toString('hex');
  db.prepare('INSERT INTO users (username, password, salt, type, playerName) VALUES (?, ?, ?, ?, ?)').run('usuario', hash2, salt2, 'jugador', null);
}

initDB();
if (seedNeeded()) seedData();

// --- HELPERS ---
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

// --- API: INIT (load all data) ---
app.get('/api/init', (req, res) => {
  const players = db.prepare('SELECT * FROM players ORDER BY id').all();
  const convocatoria = db.prepare('SELECT playerId FROM convocatoria').all().map(r => r.playerId);
  const formationRow = db.prepare('SELECT * FROM formation WHERE id = 1').get();
  const formation = { name: formationRow.name, positions: JSON.parse(formationRow.positions) };

  const clubInfo = {};
  db.prepare('SELECT * FROM club_info').all().forEach(r => clubInfo[r.key] = r.value);

  const staff = db.prepare('SELECT * FROM staff ORDER BY id').all();
  const board = db.prepare('SELECT * FROM board ORDER BY id').all();
  const news = db.prepare('SELECT * FROM news ORDER BY date DESC').all();
  const matches = db.prepare('SELECT * FROM matches ORDER BY date').all();
  const results = db.prepare('SELECT * FROM results ORDER BY date DESC').all();
  const standings = db.prepare('SELECT * FROM standings ORDER BY pos').all();

  const appearance = {};
  db.prepare('SELECT * FROM appearance').all().forEach(r => appearance[r.key] = r.value);

  const users = db.prepare('SELECT id, username, type, playerName FROM users').all();

  res.json({ players, convocatoria, formation, clubInfo, staff, board, news, matches, results, standings, appearance, users });
});

// --- API: PLAYERS ---
app.put('/api/players/:id', (req, res) => {
  const { name, nickname, number, position, age, status, goals, yellowCards, redCards } = req.body;
  const stmt = db.prepare('UPDATE players SET name=?, nickname=?, number=?, position=?, age=?, status=?, goals=?, yellowCards=?, redCards=? WHERE id=?');
  stmt.run(name, nickname || null, number, position, age || null, status || 'disponible', goals || 0, yellowCards || 0, redCards || 0, req.params.id);
  res.json({ ok: true });
});

app.post('/api/players', (req, res) => {
  const { name, nickname, number, position, age } = req.body;
  const info = db.prepare('INSERT INTO players (name, nickname, number, position, age, status, goals, yellowCards, redCards) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)').run(name, nickname || null, number, position, age || null, 'disponible');
  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/players/:id', (req, res) => {
  db.prepare('DELETE FROM players WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM convocatoria WHERE playerId = ?').run(req.params.id);
  const fRow = db.prepare('SELECT positions FROM formation WHERE id = 1').get();
  const positions = JSON.parse(fRow.positions).filter(p => p.playerId !== parseInt(req.params.id));
  db.prepare('UPDATE formation SET positions = ? WHERE id = 1').run(JSON.stringify(positions));
  res.json({ ok: true });
});

app.put('/api/players/:id/stats', (req, res) => {
  const { goals, yellowCards, redCards } = req.body;
  db.prepare('UPDATE players SET goals=?, yellowCards=?, redCards=? WHERE id=?').run(goals, yellowCards, redCards, req.params.id);
  res.json({ ok: true });
});

// --- API: CONVOCATORIA ---
app.put('/api/convocatoria', (req, res) => {
  const { playerIds } = req.body;
  db.prepare('DELETE FROM convocatoria').run();
  const stmt = db.prepare('INSERT INTO convocatoria (playerId) VALUES (?)');
  for (const id of playerIds) stmt.run(id);
  res.json({ ok: true });
});

// --- API: FORMATION ---
app.put('/api/formation', (req, res) => {
  const { name, positions } = req.body;
  db.prepare('UPDATE formation SET name=?, positions=? WHERE id=1').run(name, JSON.stringify(positions));
  res.json({ ok: true });
});

// --- API: CLUB INFO ---
app.put('/api/club-info', (req, res) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO club_info (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(req.body)) stmt.run(k, v);
  res.json({ ok: true });
});

// --- API: STAFF ---
app.post('/api/staff', (req, res) => {
  const { name, role } = req.body;
  const info = db.prepare('INSERT INTO staff (name, role) VALUES (?, ?)').run(name, role);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/staff/:id', (req, res) => {
  const { name, role } = req.body;
  db.prepare('UPDATE staff SET name=?, role=? WHERE id=?').run(name, role, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/staff/:id', (req, res) => {
  db.prepare('DELETE FROM staff WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- API: BOARD ---
app.post('/api/board', (req, res) => {
  const { name, role } = req.body;
  const info = db.prepare('INSERT INTO board (name, role) VALUES (?, ?)').run(name, role);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/board/:id', (req, res) => {
  const { name, role } = req.body;
  db.prepare('UPDATE board SET name=?, role=? WHERE id=?').run(name, role, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/board/:id', (req, res) => {
  db.prepare('DELETE FROM board WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- API: NEWS ---
app.post('/api/news', (req, res) => {
  const { title, summary, date, tag } = req.body;
  const info = db.prepare('INSERT INTO news (title, summary, date, tag) VALUES (?, ?, ?, ?)').run(title, summary || '', date || new Date().toISOString().slice(0, 10), tag || '');
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/news/:id', (req, res) => {
  const { title, summary, date, tag } = req.body;
  db.prepare('UPDATE news SET title=?, summary=?, date=?, tag=? WHERE id=?').run(title, summary || '', date || '', tag || '', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/news/:id', (req, res) => {
  db.prepare('DELETE FROM news WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- API: APPEARANCE ---
app.put('/api/appearance', (req, res) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO appearance (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(req.body)) stmt.run(k, v);
  res.json({ ok: true });
});

// --- API: AUTH ---
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  const hash = hashPassword(password, user.salt);
  if (hash !== user.password) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  res.json({ id: user.id, username: user.username, type: user.type, playerName: user.playerName });
});

// --- API: USERS ---
app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT id, username, type, playerName FROM users').all();
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const { username, password, type, playerName } = req.body;
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'El usuario ya existe' });
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  const info = db.prepare('INSERT INTO users (username, password, salt, type, playerName) VALUES (?, ?, ?, ?, ?)').run(username, hash, salt, type, playerName || null);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/users/:id', (req, res) => {
  const { username, password, type, playerName } = req.body;
  if (password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    db.prepare('UPDATE users SET username=?, password=?, salt=?, type=?, playerName=? WHERE id=?').run(username, hash, salt, type, playerName || null, req.params.id);
  } else {
    db.prepare('UPDATE users SET username=?, type=?, playerName=? WHERE id=?').run(username, type, playerName || null, req.params.id);
  }
  res.json({ ok: true });
});

app.delete('/api/users/:id', (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- PHOTOS ---
app.get('/api/photos', (req, res) => {
  const photos = db.prepare('SELECT * FROM photos ORDER BY date DESC, id DESC').all();
  res.json(photos);
});

app.post('/api/photos', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió archivo' });
  const { title, description, uploadedBy } = req.body;
  const info = db.prepare(`INSERT INTO photos (title, description, filename, uploadedBy, date) VALUES (?, ?, ?, ?, date('now'))`).run(title || null, description || null, req.file.filename, uploadedBy || null);
  res.json({ id: info.lastInsertRowid, filename: req.file.filename });
});

app.delete('/api/photos/:id', (req, res) => {
  const photo = db.prepare('SELECT filename FROM photos WHERE id = ?').get(req.params.id);
  if (photo) {
    const filePath = path.join(uploadsDir, photo.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- EVALUATIONS ---
app.get('/api/evaluations', (req, res) => {
  const { playerId } = req.query;
  let evals;
  if (playerId) {
    evals = db.prepare('SELECT * FROM evaluations WHERE playerId = ? ORDER BY date DESC, id DESC').all(playerId);
  } else {
    evals = db.prepare('SELECT * FROM evaluations ORDER BY date DESC, id DESC').all();
  }
  res.json(evals);
});

app.get('/api/evaluations/player/:id', (req, res) => {
  const evals = db.prepare('SELECT * FROM evaluations WHERE playerId = ? ORDER BY date DESC, id DESC').all(req.params.id);
  res.json(evals);
});

app.post('/api/evaluations', (req, res) => {
  const { playerId, technique, tactics, physical, mental, attitude, comment, evaluator } = req.body;
  const info = db.prepare(`INSERT INTO evaluations (playerId, technique, tactics, physical, mental, attitude, comment, evaluator, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now'))`).run(playerId, technique || 0, tactics || 0, physical || 0, mental || 0, attitude || 0, comment || null, evaluator || null);
  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/evaluations/:id', (req, res) => {
  db.prepare('DELETE FROM evaluations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- START ---
app.listen(PORT, () => {
  console.log(`Sada CF Portal running at http://localhost:${PORT}`);
});
