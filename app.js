let PLAYERS = [], CONVOCATORIA = [], FORMATION = { name: '4-4-2', positions: [] };
let CLUB_INFO = {}, STAFF = [], BOARD = [], NEWS = [], MATCHES = [], RESULTS = [], STANDINGS = [];
let USERS = [];
let APPEARANCE = {};
let CURRENT_USER = null;

async function initApp() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    if (Auth.isLoggedIn()) {
        CURRENT_USER = Auth.getSession();
        await loadAllData();
        showMainApp();
    } else {
        showLoginScreen();
    }
}

async function loadAllData() {
    const data = await Api.loadAll();
    PLAYERS = data.players;
    CONVOCATORIA = data.convocatoria;
    FORMATION = data.formation;
    CLUB_INFO = data.clubInfo;
    STAFF = data.staff;
    BOARD = data.board;
    NEWS = data.news;
    MATCHES = data.matches;
    RESULTS = data.results;
    STANDINGS = data.standings;
    USERS = data.users;
    APPEARANCE = data.appearance || {};
    applyAppearanceLocal(APPEARANCE);
}

function applyAppearanceLocal(data) {
    if (!data || !data.primaryColor) return;
    const root = document.documentElement;
    root.style.setProperty('--primary', data.primaryColor);
    const r = parseInt(data.primaryColor.slice(1, 3), 16);
    const g = parseInt(data.primaryColor.slice(3, 5), 16);
    const b = parseInt(data.primaryColor.slice(5, 7), 16);
    root.style.setProperty('--primary-dark', `rgb(${Math.max(0, r - 50)}, ${Math.max(0, g - 50)}, ${Math.max(0, b - 50)})`);
    root.style.setProperty('--primary-light', `rgb(${Math.min(255, r + 30)}, ${Math.min(255, g + 30)}, ${Math.min(255, b + 30)})`);
    if (data.brandName) {
        document.querySelectorAll('.nav-brand span').forEach(el => el.textContent = data.brandName);
        document.title = data.brandName + ' - Portal Interno';
    }
}

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';

    const session = Auth.getSession();
    document.getElementById('navUserName').textContent = session.username;

    if (session.type === 'admin') {
        document.getElementById('adminNavLink').style.display = 'block';
    } else {
        document.getElementById('adminNavLink').style.display = 'none';
    }

    initNavigation();
    renderConvocatoria();
    renderPlayers();
    renderNews();
    renderPublicStats();
    renderCalendar();
    renderResults();
    renderClubInfo();
    renderPhotos();
    renderPlayerEvaluations();
    initFilters();
    Admin.init();
    Admin.renderAdminPlayers();
    Admin.renderAdminUsers();
    Admin.renderStats();
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;

    const session = await Auth.login(username, password);

    if (session) {
        CURRENT_USER = session;
        document.getElementById('loginError').style.display = 'none';
        await loadAllData();
        showMainApp();
    } else {
        document.getElementById('loginError').textContent = 'Usuario o contraseña incorrectos';
        document.getElementById('loginError').style.display = 'block';
    }
}

function handleLogout() {
    Auth.logout();
    showLoginScreen();
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
}

// NAVIGATION
function initNavigation() {
    const navLinks = document.querySelectorAll(".nav-link");
    const sections = document.querySelectorAll(".section");
    const mobileBtn = document.getElementById("mobileMenuBtn");
    const navLinksContainer = document.querySelector(".nav-links");

    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const section = link.dataset.section;

            navLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");

            sections.forEach(s => s.classList.remove("active"));
            document.getElementById(section).classList.add("active");

            navLinksContainer.classList.remove("open");
        });
    });

    mobileBtn.addEventListener("click", () => {
        navLinksContainer.classList.toggle("open");
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 768) {
            navLinksContainer.classList.remove("open");
        }
    });
}

// CONVOCATORIA
function isSuspended(player) {
    return (player.yellowCards >= 5) || (player.redCards >= 1);
}

function renderConvocatoria() {
    const container = document.getElementById("convocatoriaList");
    const titulares = FORMATION.positions.map(p => p.playerId);
    const convocados = CONVOCATORIA.map(id => PLAYERS.find(p => p.id === id)).filter(Boolean);
    const suplentes = convocados.filter(p => !titulares.includes(p.id) && p.status === 'disponible');

    const positionOrder = { portero: 0, defensa: 1, centrocampista: 2, delantero: 3 };
    const sortByPos = (a, b) => (positionOrder[getPrimaryPosition(a.position)] ?? 99) - (positionOrder[getPrimaryPosition(b.position)] ?? 99) || a.number - b.number;
    convocados.sort(sortByPos);

    const posLabels = { portero: 'GK', defensa: 'DEF', centrocampista: 'MED', delantero: 'DEL' };

    const displayName = (p) => p.nickname || p.name.split(' ').pop();

    let html = `
        <div class="conv-matchday">
            <div class="conv-matchday-inner">
                <div class="conv-matchday-team">
                    <div class="conv-matchday-crest"><img src="${APPEARANCE.teamLogo || '/assets/logo.jpeg'}" style="height:48px;width:48px;object-fit:contain;border-radius:50%;"></div>
                    <span>${APPEARANCE.brandName || 'Sada CF'}</span>
                </div>
                <div class="conv-matchday-vs">
                    <div class="conv-matchday-badge">ALINEACIÓN</div>
                    <div class="conv-matchday-formation">${FORMATION.name}</div>
                </div>
                <div class="conv-matchday-team">
                    <div class="conv-matchday-crest rival">?</div>
                    <span>Próximo rival</span>
                </div>
            </div>
        </div>

        <div class="conv-pitch-wrapper">
            <div class="conv-pitch">
                <div class="conv-pitch-grass"></div>
                <div class="conv-pitch-lines">
                    <div class="conv-pitch-center-line"></div>
                    <div class="conv-pitch-center-circle"></div>
                    <div class="conv-pitch-penalty-top"></div>
                    <div class="conv-pitch-penalty-bottom"></div>
                    <div class="conv-pitch-goal-top"></div>
                    <div class="conv-pitch-goal-bottom"></div>
                </div>
                ${FORMATION.positions.map(pos => {
                    const player = PLAYERS.find(p => p.id === pos.playerId);
                    if (!player) return '';
                    const pName = player.nickname || player.name.split(' ').pop();
                    const statusClass = player.status !== 'disponible' ? ' player-unavailable' : '';
                    const suspended = isSuspended(player);
                    const suspendedBadge = suspended ? '<span class="conv-suspended-badge" title="Sancionado"><i class="fas fa-ban"></i></span>' : '';
                    return `
                        <div class="conv-player${statusClass}" style="left:${pos.x}%;top:${pos.y}%;">
                            <div class="conv-player-jersey">
                                <span class="conv-player-num">${player.number}</span>
                                ${suspendedBadge}
                            </div>
                            <div class="conv-player-label">
                                <span class="conv-player-name">${pName}</span>
                                <span class="conv-player-pos">${posLabels[getPrimaryPosition(player.position)] || ''}</span>
                            </div>
                        </div>`;
                }).join('')}
            </div>
        </div>
    `;

    if (suplentes.length > 0) {
        html += `
            <div class="conv-bench-section">
                <div class="conv-bench-header">
                    <div class="conv-bench-icon"><i class="fas fa-users"></i></div>
                    <div>
                        <h3>Suplentes</h3>
                        <span class="conv-bench-count">${suplentes.length} jugadores</span>
                    </div>
                </div>
                <div class="conv-bench-list">
                    ${suplentes.map(player => {
                        const pName = player.nickname || player.name.split(' ').pop();
                        const statusClass = player.status !== 'disponible' ? ' bench-unavailable' : '';
                        const suspended = isSuspended(player);
                        const statusIcon = suspended ? ' 🚫' : player.status === 'lesionado' ? ' 🤕' : player.status === 'no_disponible' ? ' ✖' : '';
                        return `
                        <div class="conv-bench-item${statusClass}">
                            <div class="conv-bench-number">${player.number}</div>
                            <div class="conv-bench-info">
                                <span class="conv-bench-name">${pName}${statusIcon}</span>
                                <span class="conv-bench-pos">${formatPosition(player.position)}</span>
                            </div>
                            ${suspended ? '<span class="conv-suspended-text" title="Sancionado - suspendido 1 partido"><i class="fas fa-exclamation-triangle"></i> Sancionado</span>' : ''}
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

// PLAYERS
function renderPlayers(filter = "todos") {
    const container = document.getElementById("playersGrid");
    const filtered = filter === "todos"
        ? PLAYERS
        : PLAYERS.filter(p => p.position && p.position.includes(filter));

    container.innerHTML = filtered.map(player => {
        const statusClass = player.status === 'lesionado' ? 'lesionado' : player.status === 'no_disponible' ? 'no-disponible' : '';
        const statusLabel = player.status === 'lesionado' ? 'Lesionado' : player.status === 'no_disponible' ? 'No disponible' : '';
        return `
        <div class="player-card ${statusClass}">
            <div class="player-avatar">${getInitials(player.name)}</div>
            <div class="player-details">
                <h3>${player.nickname || player.name}</h3>
                <span class="position">${formatPosition(player.position)}</span>
                <p class="info">Edad: ${player.age || '-'}</p>
                ${statusLabel ? `<span class="player-status-badge ${player.status}">${statusLabel}</span>` : ''}
            </div>
            <div class="player-number">#${player.number}</div>
        </div>`;
    }).join("");
}

// NEWS
function renderNews() {
    const container = document.getElementById("newsGrid");
    const isAdmin = Auth.isAdmin();

    const header = document.querySelector('#noticias .section-header');
    if (header) {
        const existingBtn = header.querySelector('.btn-primary');
        if (isAdmin && !existingBtn) {
            const btn = document.createElement('button');
            btn.className = 'btn-primary';
            btn.innerHTML = '<i class="fas fa-plus"></i> Nueva Noticia';
            btn.addEventListener('click', () => Admin.showAddNewsModal());
            header.appendChild(btn);
        } else if (!isAdmin && existingBtn) {
            existingBtn.remove();
        }
    }

    if (NEWS.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No hay noticias publicadas.</p>';
        return;
    }

    container.innerHTML = NEWS.map(item => `
        <div class="news-card">
            <div class="news-image">
                <i class="fas fa-futbol"></i>
            </div>
            <div class="news-body">
                <span class="news-date"><i class="far fa-calendar"></i> ${formatDate(item.date)}</span>
                <h3>${item.title}</h3>
                <p>${item.summary}</p>
                <div class="news-footer">
                    <span class="news-tag">${item.tag}</span>
                    ${isAdmin ? `
                        <div class="news-actions">
                            <button class="btn-icon" onclick="Admin.showEditNewsModal(${item.id})" title="Editar"><i class="fas fa-edit"></i></button>
                            <button class="btn-icon danger" onclick="Admin.confirmDeleteNews(${item.id})" title="Eliminar"><i class="fas fa-trash"></i></button>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join("");
}

// STATS (public)
function renderPublicStats() {
    const totalGoals = PLAYERS.reduce((s, p) => s + (p.goals || 0), 0);
    const totalYellows = PLAYERS.reduce((s, p) => s + (p.yellowCards || 0), 0);
    const totalReds = PLAYERS.reduce((s, p) => s + (p.redCards || 0), 0);

    const cards = document.getElementById('publicStatsCards');
    if (cards) cards.innerHTML = `
        <div class="stat-card"><i class="fas fa-futbol"></i><div class="stat-value">${totalGoals}</div><div class="stat-label">Goles Totales</div></div>
        <div class="stat-card yellow"><i class="fas fa-square"></i><div class="stat-value">${totalYellows}</div><div class="stat-label">Tarjetas Amarillas</div></div>
        <div class="stat-card red"><i class="fas fa-square"></i><div class="stat-value">${totalReds}</div><div class="stat-label">Tarjetas Rojas</div></div>
        <div class="stat-card"><i class="fas fa-users"></i><div class="stat-value">${PLAYERS.length}</div><div class="stat-label">Jugadores</div></div>
    `;

    const scorers = PLAYERS.filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 5);
    const scorersEl = document.getElementById('publicTopScorers');
    if (scorersEl) scorersEl.innerHTML = scorers.length > 0 ? `
        <div class="mini-table">${scorers.map(p => `
            <div class="mini-row">
                <span class="mini-name">${p.nickname || p.name}</span>
                <span class="mini-stat"><i class="fas fa-futbol"></i> ${p.goals}</span>
            </div>`).join('')}
        </div>` : '<p style="color:var(--text-muted);">Sin goles registrados</p>';

    const cardsPlayers = PLAYERS.filter(p => (p.yellowCards || 0) + (p.redCards || 0) > 0)
        .sort((a, b) => (b.yellowCards + b.redCards) - (a.yellowCards + a.redCards)).slice(0, 5);
    const cardsEl = document.getElementById('publicTopCards');
    if (cardsEl) cardsEl.innerHTML = cardsPlayers.length > 0 ? `
        <div class="mini-table">${cardsPlayers.map(p => `
            <div class="mini-row">
                <span class="mini-name">${p.nickname || p.name}</span>
                <span class="mini-stat"><span class="card-dot yellow"></span> ${p.yellowCards || 0} <span class="card-dot red"></span> ${p.redCards || 0}</span>
            </div>`).join('')}
        </div>` : '<p style="color:var(--text-muted);">Sin tarjetas registradas</p>';
}

// CALENDAR
function renderCalendar() {
    const container = document.getElementById("calendarGrid");

    container.innerHTML = MATCHES.map(match => {
        const d = new Date(match.date + "T00:00:00");
        const day = d.getDate();
        const month = d.toLocaleString("es", { month: "short" }).toUpperCase();

        const homeTeam = match.home ? "Sada CF" : match.rival;
        const awayTeam = match.home ? match.rival : "Sada CF";

        return `
            <div class="calendar-card">
                <div class="calendar-date-box">
                    <span class="day">${day}</span>
                    <span class="month">${month}</span>
                </div>
                <div class="calendar-teams">
                    ${homeTeam} <span class="vs">vs</span> ${awayTeam}
                </div>
                <div class="calendar-meta">
                    <div class="time">${match.time}</div>
                    <div class="venue">${match.home ? "🏠 " : "🚌 "}${match.venue}</div>
                </div>
            </div>
        `;
    }).join("");
}

// RESULTS
function renderResults() {
    const container = document.getElementById("resultsList");

    container.innerHTML = RESULTS.map(result => {
        const isHome = result.home === "Sada CF";
        const ourScore = isHome ? result.homeScore : result.awayScore;
        const theirScore = isHome ? result.awayScore : result.homeScore;

        let resultType;
        if (ourScore > theirScore) resultType = "win";
        else if (ourScore < theirScore) resultType = "loss";
        else resultType = "draw";

        const rival = isHome ? result.away : result.home;
        const d = new Date(result.date + "T00:00:00");

        return `
            <div class="result-card ${resultType}">
                <div class="result-date">
                    <div class="day">${d.getDate()}</div>
                    <div class="month">${d.toLocaleString("es", { month: "short" })}</div>
                </div>
                <div class="result-teams">
                    <div class="result-team-row ${ourScore > theirScore ? 'winner' : ''}">
                        <span>${isHome ? "Sada CF" : rival}</span>
                        <span class="result-score">${isHome ? result.homeScore : result.awayScore}</span>
                    </div>
                    <div class="result-team-row ${theirScore > ourScore ? 'winner' : ''}">
                        <span>${isHome ? rival : "Sada CF"}</span>
                        <span class="result-score">${isHome ? result.awayScore : result.homeScore}</span>
                    </div>
                </div>
                <span class="result-badge ${resultType}">
                    ${resultType === "win" ? "Victoria" : resultType === "loss" ? "Derrota" : "Empate"}
                </span>
            </div>
        `;
    }).join("");
}

function renderStandings() {
    const container = document.getElementById("standingsTable");

    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Equipo</th>
                    <th>PJ</th>
                    <th>G</th>
                    <th>E</th>
                    <th>P</th>
                    <th>GF</th>
                    <th>GC</th>
                    <th>DG</th>
                    <th>Pts</th>
                </tr>
            </thead>
            <tbody>
                ${STANDINGS.map(team => `
                    <tr class="${team.team === "Sada CF" ? "highlight" : ""}">
                        <td class="pos">${team.pos}</td>
                        <td class="team-name">${team.team}</td>
                        <td>${team.played}</td>
                        <td>${team.won}</td>
                        <td>${team.drawn}</td>
                        <td>${team.lost}</td>
                        <td>${team.gf}</td>
                        <td>${team.ga}</td>
                        <td>${team.gf - team.ga > 0 ? "+" : ""}${team.gf - team.ga}</td>
                        <td class="pts">${team.pts}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}

// FILTERS
function initFilters() {
    document.querySelectorAll("#jugadores .filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#jugadores .filter-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            renderPlayers(btn.dataset.filter);
        });
    });

    const resultsView = document.getElementById("resultsView");
    const standingsView = document.getElementById("standingsView");

    document.querySelectorAll(".standings-toggle .filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".standings-toggle .filter-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            if (btn.dataset.view === "results") {
                resultsView.style.display = "block";
                standingsView.style.display = "none";
            } else {
                resultsView.style.display = "none";
                standingsView.style.display = "block";
                renderStandings();
            }
        });
    });
}

// HELPERS
function formatPosition(pos) {
    const map = {
        portero: "Portero",
        defensa: "Defensa",
        centrocampista: "Centrocampista",
        delantero: "Delantero"
    };
    if (pos && pos.includes(',')) {
        return pos.split(',').map(p => map[p] || p).join(' / ');
    }
    return map[pos] || pos;
}

function getPrimaryPosition(pos) {
    if (!pos) return '';
    return pos.split(',')[0];
}

function hasPosition(player, position) {
    return player.position && player.position.includes(position);
}

function getInitials(name) {
    return name.split(" ").map(n => n[0]).join("").substring(0, 2);
}

function formatDate(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}

function renderClubInfo() {
    const clubSection = document.getElementById('club');
    if (!clubSection) return;

    clubSection.innerHTML = `
        <div class="club-hero">
            <div class="club-crest-large">${APPEARANCE.teamLogo || '⚽'}</div>
            <h2 class="club-hero-name">${CLUB_INFO.federationName || ''}</h2>
            <p class="club-hero-tagline">Fundado en ${CLUB_INFO.founded || ''}</p>
        </div>

        <div class="club-grid">
            <div class="club-card">
                <div class="club-card-icon"><i class="fas fa-user-tie"></i></div>
                <h3>Presidente</h3>
                <p>${CLUB_INFO.president || ''}</p>
            </div>
            <div class="club-card">
                <div class="club-card-icon"><i class="fas fa-map-marker-alt"></i></div>
                <h3>Federación</h3>
                <p>${CLUB_INFO.federationAddress || ''}</p>
            </div>
            <div class="club-card">
                <div class="club-card-icon"><i class="fas fa-futbol"></i></div>
                <h3>Campo Local</h3>
                <p>${CLUB_INFO.stadium || ''}</p>
                <p class="club-card-detail">${CLUB_INFO.stadiumAddress || ''}</p>
            </div>
            <div class="club-card">
                <div class="club-card-icon"><i class="fas fa-users"></i></div>
                <h3>Capacidad</h3>
                <p>${CLUB_INFO.stadiumCapacity || ''}</p>
            </div>
        </div>

        <h3 class="subsection-title" style="margin-top:3rem;">Cuerpo Técnico</h3>
        <div class="staff-grid">
            ${STAFF.map(s => `
                <div class="staff-card">
                    <div class="staff-avatar">${getInitials(s.name)}</div>
                    <h4>${s.name}</h4>
                    <span class="staff-role">${s.role}</span>
                </div>
            `).join('')}
        </div>

        <h3 class="subsection-title" style="margin-top:3rem;">Directiva</h3>
        <div class="board-grid">
            ${BOARD.map(b => `
                <div class="board-card">
                    <div class="board-avatar">${getInitials(b.name)}</div>
                    <h4>${b.name}</h4>
                    <span class="board-role">${b.role}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// PHOTOS
async function renderPhotos() {
    const container = document.getElementById('photosGrid');
    if (!container) return;
    const photos = await Api.getPhotos();
    if (photos.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No hay fotos aún</p>';
        return;
    }
    container.innerHTML = photos.map(p => `
        <div class="photo-card" onclick="openLightbox('/uploads/${p.filename}', '${(p.title || '').replace(/'/g, "\\'")}')" style="cursor:pointer;">
            <div class="photo-img"><img src="/uploads/${p.filename}" alt="${p.title || ''}" loading="lazy"></div>
            ${p.title ? `<div class="photo-title">${p.title}</div>` : ''}
            ${p.description ? `<div class="photo-desc">${p.description}</div>` : ''}
            <div class="photo-date">${p.date || ''}</div>
        </div>
    `).join('');
}

// CRÓNICA (player view + admin view)
async function renderPlayerEvaluations() {
    const container = document.getElementById('playerEvaluations');
    if (!container || !CURRENT_USER) return;

    const catLabels = { technique: 'Técnica', tactics: 'Táctica', physical: 'Física', mental: 'Mental', attitude: 'Actitud' };
    const renderStars = (val) => '★'.repeat(val) + '☆'.repeat(5 - val);

    if (CURRENT_USER.type === 'admin') {
        const allEvals = await Api.getEvaluations();
        if (allEvals.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No hay evaluaciones aún</p>';
            return;
        }
        const grouped = {};
        allEvals.forEach(ev => {
            if (!grouped[ev.playerId]) grouped[ev.playerId] = [];
            grouped[ev.playerId].push(ev);
        });
        container.innerHTML = Object.entries(grouped).map(([playerId, evals]) => {
            const player = PLAYERS.find(p => p.id == playerId);
            const pName = player ? (player.nickname || player.name) : `Jugador #${playerId}`;
            return `
            <div class="eval-player-section">
                <h3 class="eval-player-title"><i class="fas fa-user"></i> ${pName}</h3>
                ${evals.map(ev => {
                    const avg = ((ev.technique + ev.tactics + ev.physical + ev.mental + ev.attitude) / 5).toFixed(1);
                    const matchInfo = ev.matchRival ? (ev.matchHome ? `vs ${ev.matchRival}` : `${ev.matchRival} (F)`) : '';
                    return `
                    <div class="eval-card">
                        <div class="eval-header">
                            <span class="eval-date">${ev.date}</span>
                            ${matchInfo ? `<span class="eval-evaluator" style="color:var(--primary);font-weight:600;"><i class="fas fa-futbol"></i> ${matchInfo}</span>` : ''}
                            <span class="eval-evaluator">Evaluado por: ${ev.evaluator || 'Staff'}</span>
                            <span class="eval-avg">Media: <strong>${avg}</strong>/5</span>
                        </div>
                        <div class="eval-scores">
                            ${Object.keys(catLabels).map(cat => `
                                <div class="eval-cat">
                                    <span class="eval-cat-label">${catLabels[cat]}</span>
                                    <span class="eval-stars">${renderStars(ev[cat])}</span>
                                </div>
                            `).join('')}
                        </div>
                        ${ev.comment ? `<div class="eval-comment"><i class="fas fa-comment-dots"></i> ${ev.comment}</div>` : ''}
                    </div>`;
                }).join('')}
            </div>`;
        }).join('');
        return;
    }

    if (!CURRENT_USER.playerName) return;
    const player = PLAYERS.find(p => p.name === CURRENT_USER.playerName || p.nickname === CURRENT_USER.playerName);
    if (!player) { container.innerHTML = '<p>No se encontró tu perfil de jugador</p>'; return; }

    const evals = await Api.getPlayerEvaluations(player.id);
    if (evals.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">Aún no tienes evaluaciones</p>';
        return;
    }

    container.innerHTML = evals.map(ev => {
        const avg = ((ev.technique + ev.tactics + ev.physical + ev.mental + ev.attitude) / 5).toFixed(1);
        const matchInfo = ev.matchRival ? (ev.matchHome ? `vs ${ev.matchRival}` : `${ev.matchRival} (F)`) : '';
        return `
        <div class="eval-card">
            <div class="eval-header">
                <span class="eval-date">${ev.date}</span>
                ${matchInfo ? `<span class="eval-evaluator" style="color:var(--primary);font-weight:600;"><i class="fas fa-futbol"></i> ${matchInfo}</span>` : ''}
                <span class="eval-evaluator">Evaluado por: ${ev.evaluator || 'Staff'}</span>
                <span class="eval-avg">Media: <strong>${avg}</strong>/5</span>
            </div>
            <div class="eval-scores">
                ${Object.keys(catLabels).map(cat => `
                    <div class="eval-cat">
                        <span class="eval-cat-label">${catLabels[cat]}</span>
                        <span class="eval-stars">${renderStars(ev[cat])}</span>
                    </div>
                `).join('')}
            </div>
            ${ev.comment ? `<div class="eval-comment"><i class="fas fa-comment-dots"></i> ${ev.comment}</div>` : ''}
        </div>`;
    }).join('');
}

// LIGHTBOX
function openLightbox(src, caption) {
    const lb = document.getElementById('photoLightbox');
    document.getElementById('lightboxImg').src = src;
    document.getElementById('lightboxCaption').textContent = caption || '';
    lb.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox(e) {
    if (e.target === document.getElementById('photoLightbox') || e.target.classList.contains('lightbox-close')) {
        document.getElementById('photoLightbox').classList.remove('active');
        document.body.style.overflow = '';
    }
}

document.addEventListener("DOMContentLoaded", initApp);
