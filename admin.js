const Admin = {
    async renderAdminPlayers() {
        const tbody = document.getElementById('adminPlayersBody');
        const filter = this._currentPlayerFilter || 'todos';
        const positionOrder = { portero: 0, defensa: 1, centrocampista: 2, delantero: 3 };

        let filtered = filter === 'todos'
            ? [...PLAYERS]
            : PLAYERS.filter(p => p.position && p.position.includes(filter));

        filtered.sort((a, b) => {
            const pa = positionOrder[getPrimaryPosition(a.position)] ?? 99;
            const pb = positionOrder[getPrimaryPosition(b.position)] ?? 99;
            if (pa !== pb) return pa - pb;
            return a.number - b.number;
        });

        tbody.innerHTML = filtered.map(p => {
            const statusIcon = p.status === 'lesionado' ? '🤕' : p.status === 'no_disponible' ? '🚫' : '✅';
            return `
            <tr>
                <td data-label="#">${p.number}</td>
                <td data-label="Nombre"><strong>${p.nickname || p.name}</strong><br><small style="color:var(--text-muted)">${p.nickname ? p.name : ''}</small></td>
                <td data-label="Posición">${formatPosition(p.position)}</td>
                <td data-label="Edad">
                    <div class="stat-controls">
                        <button class="stat-btn minus" onclick="Admin.changeAge(${p.id}, -1)">-</button>
                        <span class="stat-value">${p.age || '-'}</span>
                        <button class="stat-btn plus" onclick="Admin.changeAge(${p.id}, 1)">+</button>
                    </div>
                </td>
                <td data-label="Estado">
                    <button class="status-toggle" onclick="Admin.cycleStatus(${p.id})" title="Cambiar estado">${statusIcon}</button>
                </td>
                <td data-label="Goles">
                    <div class="stat-controls">
                        <button class="stat-btn minus" onclick="Admin.changeStat(${p.id},'goals',-1)">-</button>
                        <span class="stat-value">${p.goals || 0}</span>
                        <button class="stat-btn plus" onclick="Admin.changeStat(${p.id},'goals',1)">+</button>
                    </div>
                </td>
                <td data-label="Amarillas">
                    <div class="stat-controls yellow">
                        <button class="stat-btn minus" onclick="Admin.changeStat(${p.id},'yellowCards',-1)">-</button>
                        <span class="stat-value">${p.yellowCards || 0}</span>
                        <button class="stat-btn plus" onclick="Admin.changeStat(${p.id},'yellowCards',1)">+</button>
                    </div>
                </td>
                <td data-label="Rojas">
                    <div class="stat-controls red">
                        <button class="stat-btn minus" onclick="Admin.changeStat(${p.id},'redCards',-1)">-</button>
                        <span class="stat-value">${p.redCards || 0}</span>
                        <button class="stat-btn plus" onclick="Admin.changeStat(${p.id},'redCards',1)">+</button>
                    </div>
                </td>
                <td data-label="Acciones">
                    <button class="btn-icon" onclick="Admin.showEditPlayerModal(${p.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon danger" onclick="Admin.confirmDeletePlayer(${p.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');
    },

    async cycleStatus(id) {
        const player = PLAYERS.find(p => p.id === id);
        if (!player) return;
        const order = ['disponible', 'no_disponible', 'lesionado'];
        const current = order.indexOf(player.status || 'disponible');
        player.status = order[(current + 1) % order.length];
        await Api.savePlayer(id, { ...player, nickname: player.nickname || null });
        this.renderAdminPlayers();
        renderPlayers();
        renderConvocatoria();
    },

    async changeStat(playerId, field, delta) {
        const player = PLAYERS.find(p => p.id === playerId);
        if (!player) return;
        player[field] = Math.max(0, (player[field] || 0) + delta);
        await Api.savePlayerStats(playerId, { goals: player.goals || 0, yellowCards: player.yellowCards || 0, redCards: player.redCards || 0 });
        this.renderAdminPlayers();
        this.renderStats();
    },

    async changeAge(id, delta) {
        const player = PLAYERS.find(p => p.id === id);
        if (player) {
            if (!player.age) player.age = 30;
            player.age = Math.max(16, Math.min(60, player.age + delta));
            await Api.savePlayer(id, player);
        }
    },

    renderStats() {
        const totalGoals = PLAYERS.reduce((s, p) => s + (p.goals || 0), 0);
        const totalYellows = PLAYERS.reduce((s, p) => s + (p.yellowCards || 0), 0);
        const totalReds = PLAYERS.reduce((s, p) => s + (p.redCards || 0), 0);

        document.getElementById('totalGoals').textContent = totalGoals;
        document.getElementById('totalYellows').textContent = totalYellows;
        document.getElementById('totalReds').textContent = totalReds;
        document.getElementById('totalPlayers').textContent = PLAYERS.length;

        const scorers = PLAYERS.filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 5);
        document.getElementById('topScorers').innerHTML = scorers.length > 0 ? `
            <div class="mini-table">
                ${scorers.map(p => `
                    <div class="mini-row">
                        <span class="mini-name">${p.nickname || p.name}</span>
                        <span class="mini-stat"><i class="fas fa-futbol"></i> ${p.goals}</span>
                    </div>
                `).join('')}
            </div>
        ` : '<p style="color:var(--text-muted);">Sin goles registrados</p>';

        const cardsPlayers = PLAYERS.filter(p => (p.yellowCards || 0) + (p.redCards || 0) > 0)
            .sort((a, b) => (b.yellowCards + b.redCards) - (a.yellowCards + a.redCards)).slice(0, 5);
        document.getElementById('topCards').innerHTML = cardsPlayers.length > 0 ? `
            <div class="mini-table">
                ${cardsPlayers.map(p => `
                    <div class="mini-row">
                        <span class="mini-name">${p.nickname || p.name}</span>
                        <span class="mini-stat"><span class="card-dot yellow"></span> ${p.yellowCards || 0} <span class="card-dot red"></span> ${p.redCards || 0}</span>
                    </div>
                `).join('')}
            </div>
        ` : '<p style="color:var(--text-muted);">Sin tarjetas registradas</p>';
    },

    async renderAdminUsers() {
        const tbody = document.getElementById('adminUsersBody');
        try { USERS = await Api.getUsers(); } catch(e) {}

        tbody.innerHTML = USERS.map(u => `
            <tr>
                <td data-label="Usuario"><strong>${u.username}</strong></td>
                <td data-label="Tipo"><span class="user-type-badge ${u.type}">${u.type === 'admin' ? 'Administrador' : 'Jugador'}</span></td>
                <td data-label="Jugador">${u.playerName || '-'}</td>
                <td data-label="Acciones">
                    <button class="btn-icon" onclick="Admin.showEditUserModal(${u.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon danger" onclick="Admin.confirmDeleteUser(${u.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    },

    showAddPlayerModal() {
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = 'Nuevo Jugador';
        document.getElementById('modalBody').innerHTML = `
            <form id="playerForm" class="modal-form">
                <div class="form-row">
                    <div class="form-group">
                        <label>Nombre completo</label>
                        <input type="text" id="pName" required>
                    </div>
                    <div class="form-group">
                        <label>Apodo</label>
                        <input type="text" id="pNickname" placeholder="Nombre corto">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Nº Dorsal</label>
                        <input type="number" id="pNumber" min="1" max="99" required>
                    </div>
                    <div class="form-group">
                        <label>Edad</label>
                        <input type="number" id="pAge" min="16" max="60">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Posiciones</label>
                        <div class="checkbox-group">
                            <label class="checkbox-label"><input type="checkbox" name="pPosition" value="portero"> Portero</label>
                            <label class="checkbox-label"><input type="checkbox" name="pPosition" value="defensa"> Defensa</label>
                            <label class="checkbox-label"><input type="checkbox" name="pPosition" value="centrocampista"> Centrocampista</label>
                            <label class="checkbox-label"><input type="checkbox" name="pPosition" value="delantero"> Delantero</label>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Estado</label>
                        <select id="pStatus">
                            <option value="disponible">Disponible</option>
                            <option value="no_disponible">No disponible</option>
                            <option value="lesionado">Lesionado</option>
                        </select>
                    </div>
                </div>
                <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Guardar</button>
            </form>
        `;
        modal.style.display = 'flex';

        document.getElementById('playerForm').onsubmit = async (e) => {
            e.preventDefault();
            const checked = [...document.querySelectorAll('input[name="pPosition"]:checked')].map(c => c.value);
            if (checked.length === 0) { alert('Selecciona al menos una posición'); return; }
            const data = {
                name: document.getElementById('pName').value,
                nickname: document.getElementById('pNickname').value || null,
                number: parseInt(document.getElementById('pNumber').value),
                position: checked.join(','),
                age: document.getElementById('pAge').value ? parseInt(document.getElementById('pAge').value) : null,
                status: document.getElementById('pStatus').value
            };
            const result = await Api.addPlayer(data);
            PLAYERS.push({ id: result.id, ...data, goals: 0, yellowCards: 0, redCards: 0 });
            modal.style.display = 'none';
            this.renderAdminPlayers();
            renderPlayers();
            renderConvocatoria();
        };
    },

    showEditPlayerModal(id) {
        const player = PLAYERS.find(p => p.id === id);
        if (!player) return;

        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = 'Editar Jugador';
        const positions = player.position ? player.position.split(',') : [];
        document.getElementById('modalBody').innerHTML = `
            <form id="editPlayerForm" class="modal-form">
                <div class="form-row">
                    <div class="form-group">
                        <label>Nombre completo</label>
                        <input type="text" id="epName" value="${player.name}" required>
                    </div>
                    <div class="form-group">
                        <label>Apodo</label>
                        <input type="text" id="epNickname" value="${player.nickname || ''}" placeholder="Nombre corto">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Nº Dorsal</label>
                        <input type="number" id="epNumber" value="${player.number}" min="1" max="99" required>
                    </div>
                    <div class="form-group">
                        <label>Edad</label>
                        <input type="number" id="epAge" value="${player.age || ''}" min="16" max="60">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Posiciones</label>
                        <div class="checkbox-group">
                            <label class="checkbox-label"><input type="checkbox" name="epPosition" value="portero" ${positions.includes('portero') ? 'checked' : ''}> Portero</label>
                            <label class="checkbox-label"><input type="checkbox" name="epPosition" value="defensa" ${positions.includes('defensa') ? 'checked' : ''}> Defensa</label>
                            <label class="checkbox-label"><input type="checkbox" name="epPosition" value="centrocampista" ${positions.includes('centrocampista') ? 'checked' : ''}> Centrocampista</label>
                            <label class="checkbox-label"><input type="checkbox" name="epPosition" value="delantero" ${positions.includes('delantero') ? 'checked' : ''}> Delantero</label>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Estado</label>
                        <select id="epStatus">
                            <option value="disponible" ${player.status === 'disponible' ? 'selected' : ''}>Disponible</option>
                            <option value="no_disponible" ${player.status === 'no_disponible' ? 'selected' : ''}>No disponible</option>
                            <option value="lesionado" ${player.status === 'lesionado' ? 'selected' : ''}>Lesionado</option>
                        </select>
                    </div>
                </div>
                <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Guardar</button>
            </form>
        `;
        modal.style.display = 'flex';

        document.getElementById('editPlayerForm').onsubmit = async (e) => {
            e.preventDefault();
            const checked = [...document.querySelectorAll('input[name="epPosition"]:checked')].map(c => c.value);
            if (checked.length === 0) { alert('Selecciona al menos una posición'); return; }
            const data = {
                name: document.getElementById('epName').value,
                nickname: document.getElementById('epNickname').value || null,
                number: parseInt(document.getElementById('epNumber').value),
                position: checked.join(','),
                age: document.getElementById('epAge').value ? parseInt(document.getElementById('epAge').value) : null,
                status: document.getElementById('epStatus').value,
                goals: player.goals || 0, yellowCards: player.yellowCards || 0, redCards: player.redCards || 0
            };
            await Api.savePlayer(id, data);
            Object.assign(player, data);
            if (data.status !== 'disponible') {
                const inFormation = FORMATION.positions.findIndex(p => p.playerId === player.id);
                if (inFormation !== -1) {
                    FORMATION.positions.splice(inFormation, 1);
                    await Api.saveFormation(FORMATION.name, FORMATION.positions);
                }
                const inConv = CONVOCATORIA.indexOf(player.id);
                if (inConv !== -1) {
                    CONVOCATORIA.splice(inConv, 1);
                    await Api.saveConvocatoria(CONVOCATORIA);
                }
            }
            modal.style.display = 'none';
            this.renderAdminPlayers();
            this.renderAdminConvocatoria();
            renderPlayers();
            renderConvocatoria();
        };
    },

    confirmDeletePlayer(id) {
        const player = PLAYERS.find(p => p.id === id);
        if (!player) return;

        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = 'Confirmar Eliminación';
        document.getElementById('modalBody').innerHTML = `
            <p>¿Estás seguro de eliminar a <strong>${player.name}</strong>?</p>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="document.getElementById('modal').style.display='none';">Cancelar</button>
                <button class="btn-danger" onclick="Admin.doDeletePlayer(${id})">Eliminar</button>
            </div>
        `;
        modal.style.display = 'flex';
    },

    async doDeletePlayer(id) {
        await Api.deletePlayer(id);
        const idx = PLAYERS.findIndex(p => p.id === id);
        if (idx !== -1) PLAYERS.splice(idx, 1);
        const ci = CONVOCATORIA.indexOf(id);
        if (ci !== -1) CONVOCATORIA.splice(ci, 1);
        FORMATION.positions = FORMATION.positions.filter(p => p.playerId !== id);
        document.getElementById('modal').style.display = 'none';
        this.renderAdminPlayers();
        renderPlayers();
        renderConvocatoria();
    },

    showAddUserModal() {
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = 'Nuevo Usuario';
        document.getElementById('modalBody').innerHTML = `
            <form id="userForm" class="modal-form">
                <div class="form-group">
                    <label>Usuario</label>
                    <input type="text" id="uUsername" required>
                </div>
                <div class="form-group">
                    <label>Contraseña</label>
                    <input type="password" id="uPassword" required>
                </div>
                <div class="form-group">
                    <label>Tipo</label>
                    <select id="uType" required>
                        <option value="jugador">Jugador</option>
                        <option value="admin">Administrador</option>
                    </select>
                </div>
                <div class="form-group" id="uPlayerGroup">
                    <label>Jugador Asociado</label>
                    <select id="uPlayer">
                        <option value="">Ninguno</option>
                        ${PLAYERS.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
                    </select>
                </div>
                <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Guardar</button>
            </form>
        `;
        modal.style.display = 'flex';

        document.getElementById('uType').onchange = (e) => {
            document.getElementById('uPlayerGroup').style.display = e.target.value === 'jugador' ? 'block' : 'none';
        };

        document.getElementById('userForm').onsubmit = async (e) => {
            e.preventDefault();
            const type = document.getElementById('uType').value;
            const playerName = type === 'jugador' ? document.getElementById('uPlayer').value : null;
            try {
                await Api.addUser({
                    username: document.getElementById('uUsername').value,
                    password: document.getElementById('uPassword').value,
                    type, playerName
                });
                modal.style.display = 'none';
                this.renderAdminUsers();
            } catch (err) {
                alert(err.message);
            }
        };
    },

    showEditUserModal(id) {
        const user = USERS.find(u => u.id === id);
        if (!user) return;

        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = 'Editar Usuario';
        document.getElementById('modalBody').innerHTML = `
            <form id="editUserForm" class="modal-form">
                <div class="form-group">
                    <label>Usuario</label>
                    <input type="text" id="euUsername" value="${user.username}" required>
                </div>
                <div class="form-group">
                    <label>Nueva Contraseña (dejar vacío para no cambiar)</label>
                    <input type="password" id="euPassword">
                </div>
                <div class="form-group">
                    <label>Tipo</label>
                    <select id="euType" required>
                        <option value="jugador" ${user.type === 'jugador' ? 'selected' : ''}>Jugador</option>
                        <option value="admin" ${user.type === 'admin' ? 'selected' : ''}>Administrador</option>
                    </select>
                </div>
                <div class="form-group" id="euPlayerGroup" style="display:${user.type === 'jugador' ? 'block' : 'none'}">
                    <label>Jugador Asociado</label>
                    <select id="euPlayer">
                        <option value="">Ninguno</option>
                        ${PLAYERS.map(p => `<option value="${p.name}" ${user.playerName === p.name ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Guardar</button>
            </form>
        `;
        modal.style.display = 'flex';

        document.getElementById('euType').onchange = (e) => {
            document.getElementById('euPlayerGroup').style.display = e.target.value === 'jugador' ? 'block' : 'none';
        };

        document.getElementById('editUserForm').onsubmit = async (e) => {
            e.preventDefault();
            const type = document.getElementById('euType').value;
            const data = {
                username: document.getElementById('euUsername').value,
                type,
                playerName: type === 'jugador' ? document.getElementById('euPlayer').value : null
            };
            const newPass = document.getElementById('euPassword').value;
            if (newPass) data.password = newPass;
            await Api.saveUser(id, data);
            modal.style.display = 'none';
            this.renderAdminUsers();
        };
    },

    confirmDeleteUser(id) {
        const user = USERS.find(u => u.id === id);
        if (!user) return;
        if (user.username === 'admin') {
            alert('No se puede eliminar el usuario admin');
            return;
        }

        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = 'Confirmar Eliminación';
        document.getElementById('modalBody').innerHTML = `
            <p>¿Estás seguro de eliminar el usuario <strong>${user.username}</strong>?</p>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="document.getElementById('modal').style.display='none';">Cancelar</button>
                <button class="btn-danger" onclick="Admin.doDeleteUser(${id})">Eliminar</button>
            </div>
        `;
        modal.style.display = 'flex';
    },

    async doDeleteUser(id) {
        await Api.deleteUser(id);
        document.getElementById('modal').style.display = 'none';
        this.renderAdminUsers();
    },

    // APPEARANCE SETTINGS
    async renderAppearance() {
        let current;
        try { current = await Api.get('/api/init').then(d => d.appearance); } catch(e) { current = {}; }
        const app = {
            primaryColor: current.primaryColor || '#1e40af',
            brandName: current.brandName || 'Sada CF',
            logoText: current.logoText || 'SADA',
            teamLogo: current.teamLogo || '⚽'
        };

        document.getElementById('appearanceForm').innerHTML = `
            <div class="form-row">
                <div class="form-group">
                    <label>Nombre del Equipo</label>
                    <input type="text" id="appBrandName" value="${app.brandName}">
                </div>
                <div class="form-group">
                    <label>Texto del Logo</label>
                    <input type="text" id="appLogoText" value="${app.logoText}" maxlength="5">
                </div>
            </div>
            <div class="form-group">
                <label>Logo del Equipo (emoji o texto corto)</label>
                <div class="color-picker-row">
                    <input type="text" id="appTeamLogo" value="${app.teamLogo}" maxlength="4" style="width:80px;text-align:center;font-size:1.4rem;">
                    <div class="color-presets">
                        <button type="button" class="logo-preset" data-logo="⚽" title="Balón">⚽</button>
                        <button type="button" class="logo-preset" data-logo="🔴" title="Círculo rojo">🔴</button>
                        <button type="button" class="logo-preset" data-logo="⭐" title="Estrella">⭐</button>
                        <button type="button" class="logo-preset" data-logo="🦅" title="Águila">🦅</button>
                        <button type="button" class="logo-preset" data-logo="🦁" title="León">🦁</button>
                        <button type="button" class="logo-preset" data-logo="🏆" title="Trofeo">🏆</button>
                        <button type="button" class="logo-preset" data-logo="SC" title="SC">SC</button>
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label>Color Principal</label>
                <div class="color-picker-row">
                    <input type="color" id="appColor" value="${app.primaryColor}">
                    <span id="appColorValue">${app.primaryColor}</span>
                    <div class="color-presets">
                        <button type="button" class="color-preset" style="background:#c41e3a" data-color="#c41e3a" title="Rojo"></button>
                        <button type="button" class="color-preset" style="background:#1a5f2a" data-color="#1a5f2a" title="Verde"></button>
                        <button type="button" class="color-preset" style="background:#1e40af" data-color="#1e40af" title="Azul"></button>
                        <button type="button" class="color-preset" style="background:#7c3aed" data-color="#7c3aed" title="Morado"></button>
                        <button type="button" class="color-preset" style="background:#ea580c" data-color="#ea580c" title="Naranja"></button>
                        <button type="button" class="color-preset" style="background:#0f766e" data-color="#0f766e" title="Turquesa"></button>
                        <button type="button" class="color-preset" style="background:#1a1a2e" data-color="#1a1a2e" title="Negro"></button>
                        <button type="button" class="color-preset" style="background:#991b1b" data-color="#991b1b" title="Rojo oscuro"></button>
                    </div>
                </div>
            </div>
            <div class="color-preview" id="colorPreview">
                <div class="preview-card">
                    <div class="preview-logo" id="previewLogo">${app.logoText}</div>
                    <div class="preview-text" id="previewBrand">${app.brandName}</div>
                </div>
            </div>
            <button type="button" class="btn-primary" id="saveAppearanceBtn"><i class="fas fa-save"></i> Guardar Apariencia</button>
        `;

        const colorInput = document.getElementById('appColor');
        const colorValue = document.getElementById('appColorValue');
        const previewLogo = document.getElementById('previewLogo');
        const previewBrand = document.getElementById('previewBrand');
        const brandInput = document.getElementById('appBrandName');
        const logoInput = document.getElementById('appLogoText');

        colorInput.addEventListener('input', (e) => {
            colorValue.textContent = e.target.value;
            previewLogo.style.background = e.target.value;
            previewBrand.style.color = e.target.value;
        });

        brandInput.addEventListener('input', (e) => {
            previewBrand.textContent = e.target.value;
        });

        logoInput.addEventListener('input', (e) => {
            previewLogo.textContent = e.target.value;
        });

        document.querySelectorAll('.color-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                colorInput.value = btn.dataset.color;
                colorValue.textContent = btn.dataset.color;
                previewLogo.style.background = btn.dataset.color;
                previewBrand.style.color = btn.dataset.color;
            });
        });

        const teamLogoInput = document.getElementById('appTeamLogo');
        document.querySelectorAll('.logo-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                teamLogoInput.value = btn.dataset.logo;
            });
        });

        document.getElementById('saveAppearanceBtn').addEventListener('click', async () => {
            const data = {
                primaryColor: colorInput.value,
                brandName: brandInput.value || 'Sada CF',
                logoText: logoInput.value || 'SADA',
                teamLogo: teamLogoInput.value || '⚽'
            };
            await Api.saveAppearance(data);
            this.applyAppearance(data);
            alert('Apariencia guardada');
        });
    },

    applyAppearance(data) {
        const root = document.documentElement;
        root.style.setProperty('--primary', data.primaryColor);
        const r = parseInt(data.primaryColor.slice(1, 3), 16);
        const g = parseInt(data.primaryColor.slice(3, 5), 16);
        const b = parseInt(data.primaryColor.slice(5, 7), 16);
        const dark = `rgb(${Math.max(0, r - 50)}, ${Math.max(0, g - 50)}, ${Math.max(0, b - 50)})`;
        const light = `rgb(${Math.min(255, r + 30)}, ${Math.min(255, g + 30)}, ${Math.min(255, b + 30)})`;
        root.style.setProperty('--primary-dark', dark);
        root.style.setProperty('--primary-light', light);
        document.querySelectorAll('.nav-brand span').forEach(el => el.textContent = data.brandName);
        document.title = (data.brandName || 'Sada CF') + ' - Portal Interno';
    },

    async loadAndApplyAppearance() {
        try {
            const data = await Api.get('/api/init');
            this.applyAppearance(data.appearance);
        } catch(e) {}
    },

    // CONVOCATORIA ADMIN
    renderAdminConvocatoria() {
        const titulares = FORMATION.positions.map(p => p.playerId);
        const titularesList = document.getElementById('adminTitularesList');
        const disponiblesList = document.getElementById('adminDisponiblesList');
        const noConvocadosList = document.getElementById('adminNoConvocadosList');
        const lesionadosList = document.getElementById('adminLesionadosList');
        const titularesCount = document.getElementById('titularesCount');
        const disponiblesCount = document.getElementById('disponiblesCount');
        const noConvocadosCount = document.getElementById('noConvocadosCount');
        const lesionadosCount = document.getElementById('lesionadosCount');

        const positionOrder = { portero: 0, defensa: 1, centrocampista: 2, delantero: 3 };
        const sortFn = (a, b) => positionOrder[getPrimaryPosition(a.position)] - positionOrder[getPrimaryPosition(b.position)];

        const lesionados = PLAYERS.filter(p => p.status === 'lesionado').sort(sortFn);
        const lesionadosIds = lesionados.map(p => p.id);
        const noDisponibles = PLAYERS.filter(p => p.status === 'no_disponible' && !CONVOCATORIA.includes(p.id)).sort(sortFn);
        const titularesPlayers = PLAYERS.filter(p => titulares.includes(p.id)).sort(sortFn);
        const convocados = PLAYERS.filter(p => CONVOCATORIA.includes(p.id) && !titulares.includes(p.id) && p.status === 'disponible').sort(sortFn);
        const noConvocados = PLAYERS.filter(p => !CONVOCATORIA.includes(p.id) && p.status === 'disponible' && !lesionadosIds.includes(p.id)).sort(sortFn);

        titularesCount.textContent = titularesPlayers.length;
        disponiblesCount.textContent = convocados.length;
        noConvocadosCount.textContent = noConvocados.length;
        lesionadosCount.textContent = lesionados.length;

        const renderRow = (p, btnClass, btnIcon, btnTitle, onclick) => {
            const pName = p.nickname || p.name;
            const statusIcon = p.status === 'lesionado' ? ' 🤕' : p.status === 'no_disponible' ? ' 🚫' : '';
            return `
            <div class="admin-player-row${p.status === 'lesionado' ? ' lesionado' : ''}" data-id="${p.id}">
                <div class="admin-player-num">${p.number}</div>
                <div class="admin-player-info">
                    <span class="admin-player-name">${pName}${statusIcon}</span>
                    <span class="admin-player-pos">${formatPosition(p.position)}</span>
                </div>
                <button class="btn-icon ${btnClass}" onclick="${onclick}" title="${btnTitle}">
                    <i class="fas fa-${btnIcon}"></i>
                </button>
            </div>`;
        };

        titularesList.innerHTML = titularesPlayers.map(p =>
            renderRow(p, 'danger', 'times', 'Quitar de titulares', `Admin.toggleConvocatoria(${p.id})`)
        ).join('');

        disponiblesList.innerHTML = convocados.map(p =>
            renderRow(p, 'danger', 'times', 'Quitar de convocatoria', `Admin.removeConvocado(${p.id})`)
        ).join('');

        noConvocadosList.innerHTML = noConvocados.map(p =>
            renderRow(p, 'success', 'plus', 'Añadir a convocatoria', `Admin.toggleConvocatoria(${p.id})`)
        ).join('') + noDisponibles.map(p =>
            renderRow(p, 'success', 'plus', 'Añadir a convocatoria', `Admin.toggleConvocatoria(${p.id})`)
        ).join('');

        lesionadosList.innerHTML = lesionados.length > 0 ? lesionados.map(p =>
            renderRow(p, '', 'check', 'Marcar disponible', `Admin.markAvailable(${p.id})`)
        ).join('') : '<p style="color:var(--text-muted);padding:0.5rem;font-size:0.85rem;">No hay lesionados</p>';

        this.renderAdminPitch();
    },

    async removeConvocado(playerId) {
        const inConv = CONVOCATORIA.indexOf(playerId);
        if (inConv !== -1) CONVOCATORIA.splice(inConv, 1);
        await Api.saveConvocatoria(CONVOCATORIA);
        this.renderAdminConvocatoria();
        renderConvocatoria();
    },

    async addFromLesion(playerId) {
        const player = PLAYERS.find(p => p.id === playerId);
        if (player) player.status = 'disponible';
        await Api.savePlayer(playerId, { ...player, nickname: player.nickname || null });
        if (!CONVOCATORIA.includes(playerId)) CONVOCATORIA.push(playerId);
        await Api.saveConvocatoria(CONVOCATORIA);
        this.renderAdminConvocatoria();
        renderConvocatoria();
    },

    async markAvailable(playerId) {
        const player = PLAYERS.find(p => p.id === playerId);
        if (player) player.status = 'disponible';
        await Api.savePlayer(playerId, { ...player, nickname: player.nickname || null });
        this.renderAdminConvocatoria();
        renderPlayers();
    },

    async toggleConvocatoria(playerId) {
        const inFormation = FORMATION.positions.findIndex(p => p.playerId === playerId);
        const inConv = CONVOCATORIA.indexOf(playerId);

        if (inFormation !== -1) {
            FORMATION.positions.splice(inFormation, 1);
            if (inConv !== -1) CONVOCATORIA.splice(inConv, 1);
        } else {
            if (FORMATION.positions.length >= 11) {
                alert('Ya hay 11 titulares. Quitá uno antes de agregar otro.');
                return;
            }
            const player = PLAYERS.find(p => p.id === playerId);
            if (player && player.status !== 'disponible') {
                alert('No se puede añadir un jugador ' + (player.status === 'lesionado' ? 'lesionado' : 'no disponible') + ' a titulares');
                return;
            }
            const autoPos = this.autoPositionPlayer(player, FORMATION.positions.length);
            FORMATION.positions.push({ playerId, x: autoPos.x, y: autoPos.y });
            if (inConv === -1) CONVOCATORIA.push(playerId);
        }

        await Api.saveConvocatoria(CONVOCATORIA);
        await Api.saveFormation(FORMATION.name, FORMATION.positions);
        this.renderAdminConvocatoria();
        renderConvocatoria();
    },

    autoPositionPlayer(player, index) {
        const formations = {
            '4-4-2': {
                portero: [{x:50,y:85}],
                defensa: [{x:20,y:65},{x:37,y:65},{x:63,y:65},{x:80,y:65}],
                centrocampista: [{x:20,y:42},{x:37,y:42},{x:63,y:42},{x:80,y:42}],
                delantero: [{x:38,y:22},{x:62,y:22}]
            },
            '4-3-3': {
                portero: [{x:50,y:85}],
                defensa: [{x:20,y:65},{x:37,y:65},{x:63,y:65},{x:80,y:65}],
                centrocampista: [{x:30,y:45},{x:50,y:48},{x:70,y:45}],
                delantero: [{x:20,y:22},{x:50,y:18},{x:80,y:22}]
            },
            '3-5-2': {
                portero: [{x:50,y:85}],
                defensa: [{x:30,y:65},{x:50,y:65},{x:70,y:65}],
                centrocampista: [{x:12,y:48},{x:33,y:42},{x:50,y:45},{x:67,y:42},{x:88,y:48}],
                delantero: [{x:38,y:22},{x:62,y:22}]
            },
            '4-2-3-1': {
                portero: [{x:50,y:85}],
                defensa: [{x:20,y:65},{x:37,y:65},{x:63,y:65},{x:80,y:65}],
                centrocampista: [{x:37,y:52},{x:63,y:52},{x:20,y:35},{x:50,y:35},{x:80,y:35}],
                delantero: [{x:50,y:18}]
            },
            '5-3-2': {
                portero: [{x:50,y:85}],
                defensa: [{x:12,y:48},{x:30,y:65},{x:50,y:65},{x:70,y:65},{x:88,y:48}],
                centrocampista: [{x:32,y:42},{x:50,y:42},{x:68,y:42}],
                delantero: [{x:38,y:22},{x:62,y:22}]
            },
            '4-1-4-1': {
                portero: [{x:50,y:85}],
                defensa: [{x:20,y:65},{x:37,y:65},{x:63,y:65},{x:80,y:65}],
                centrocampista: [{x:50,y:55},{x:20,y:38},{x:37,y:38},{x:63,y:38},{x:80,y:38}],
                delantero: [{x:50,y:18}]
            },
        };

        const slot = formations[FORMATION.name] || formations['4-4-2'];
        const positions = slot[getPrimaryPosition(player.position)] || slot.centrocampista;
        const pos = positions[index % positions.length];
        return { x: pos.x, y: pos.y };
    },

    renderAdminPitch() {
        const pitch = document.getElementById('adminPitch');
        pitch.innerHTML = '<div class="pitch-lines"></div>';

        const onDrag = (e) => {
            if (e.target.closest('.pitch-player')) e.preventDefault();
        };
        pitch.ondragover = onDrag;

        FORMATION.positions.forEach((pos, idx) => {
            const player = PLAYERS.find(p => p.id === pos.playerId);
            if (!player) return;

            const el = document.createElement('div');
            el.className = 'pitch-player admin-pitch-player';
            el.style.left = pos.x + '%';
            el.style.top = pos.y + '%';
            el.innerHTML = `
                <div class="pitch-player-number">${player.number}</div>
                <div class="pitch-player-name">${player.nickname || player.name.split(' ')[0]}</div>
            `;
            el.dataset.idx = idx;

            const onMove = (clientX, clientY) => {
                const rect = pitch.getBoundingClientRect();
                const x = Math.round(((clientX - rect.left) / rect.width) * 100);
                const y = Math.round(((clientY - rect.top) / rect.height) * 100);
                FORMATION.positions[idx].x = Math.max(5, Math.min(95, x));
                FORMATION.positions[idx].y = Math.max(5, Math.min(95, y));
                el.style.left = FORMATION.positions[idx].x + '%';
                el.style.top = FORMATION.positions[idx].y + '%';
            };

            const stopDrag = async () => {
                document.removeEventListener('mousemove', mouseMove);
                document.removeEventListener('mouseup', stopDrag);
                document.removeEventListener('touchmove', touchMove);
                document.removeEventListener('touchend', stopDrag);
                await Api.saveFormation(FORMATION.name, FORMATION.positions);
            };

            const mouseMove = (e) => onMove(e.clientX, e.clientY);
            const touchMove = (e) => { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); };

            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                document.addEventListener('mousemove', mouseMove);
                document.addEventListener('mouseup', stopDrag);
            });

            el.addEventListener('touchstart', (e) => {
                e.preventDefault();
                document.addEventListener('touchmove', touchMove, { passive: false });
                document.addEventListener('touchend', stopDrag);
            }, { passive: false });

            pitch.appendChild(el);
        });

        document.getElementById('formationSelect').value = FORMATION.name;
    },

    applyFormationPositions() {
        const grouped = { portero: [], defensa: [], centrocampista: [], delantero: [] };
        FORMATION.positions.forEach(pos => {
            const player = PLAYERS.find(p => p.id === pos.playerId);
            if (player) grouped[getPrimaryPosition(player.position)].push(pos);
        });

        const newPositions = [];
        Object.keys(grouped).forEach(pos => {
            grouped[pos].forEach((p, i) => {
                const autoPos = this.autoPositionPlayer(
                    PLAYERS.find(pl => pl.id === p.playerId), i
                );
                newPositions.push({ playerId: p.playerId, x: autoPos.x, y: autoPos.y });
            });
        });

        FORMATION.positions = newPositions;
    },

    // CLUB ADMIN
    async renderClubAdmin() {
        const form = document.getElementById('clubAdminForm');
        form.innerHTML = `
            <h3 class="subsection-title">Información del Club</h3>
            <form id="clubInfoForm" class="modal-form">
                <div class="form-row">
                    <div class="form-group">
                        <label>Nombre Federativo</label>
                        <input type="text" id="ciName" value="${CLUB_INFO.federationName || ''}">
                    </div>
                    <div class="form-group">
                        <label>Presidente</label>
                        <input type="text" id="ciPresident" value="${CLUB_INFO.president || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Dirección Federativa</label>
                    <input type="text" id="ciAddress" value="${CLUB_INFO.federationAddress || ''}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Estadio / Campo Local</label>
                        <input type="text" id="ciStadium" value="${CLUB_INFO.stadium || ''}">
                    </div>
                    <div class="form-group">
                        <label>Capacidad</label>
                        <input type="text" id="ciCapacity" value="${CLUB_INFO.stadiumCapacity || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Dirección del Campo</label>
                    <input type="text" id="ciStadiumAddr" value="${CLUB_INFO.stadiumAddress || ''}">
                </div>
                <div class="form-group">
                    <label>Año de Fundación</label>
                    <input type="text" id="ciFounded" value="${CLUB_INFO.founded || ''}">
                </div>
                <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Guardar Información del Club</button>
            </form>

            <h3 class="subsection-title" style="margin-top:2rem;">Cuerpo Técnico</h3>
            <div class="admin-toolbar">
                <button class="btn-primary" onclick="Admin.showAddStaffModal()"><i class="fas fa-plus"></i> Añadir Miembro</button>
            </div>
            <div class="admin-table-container">
                <table class="admin-table">
                    <thead><tr><th>Nombre</th><th>Cargo</th><th>Acciones</th></tr></thead>
                    <tbody id="staffBody">
                        ${STAFF.map(s => `
                            <tr>
                                <td data-label="Nombre"><strong>${s.name}</strong></td>
                                <td data-label="Cargo">${s.role}</td>
                                <td data-label="Acciones">
                                    <button class="btn-icon" onclick="Admin.showEditStaffModal(${s.id})"><i class="fas fa-edit"></i></button>
                                    <button class="btn-icon danger" onclick="Admin.doDeleteStaff(${s.id})"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <h3 class="subsection-title" style="margin-top:2rem;">Directiva</h3>
            <div class="admin-toolbar">
                <button class="btn-primary" onclick="Admin.showAddBoardModal()"><i class="fas fa-plus"></i> Añadir Miembro</button>
            </div>
            <div class="admin-table-container">
                <table class="admin-table">
                    <thead><tr><th>Nombre</th><th>Cargo</th><th>Acciones</th></tr></thead>
                    <tbody id="boardBody">
                        ${BOARD.map(b => `
                            <tr>
                                <td data-label="Nombre"><strong>${b.name}</strong></td>
                                <td data-label="Cargo">${b.role}</td>
                                <td data-label="Acciones">
                                    <button class="btn-icon" onclick="Admin.showEditBoardModal(${b.id})"><i class="fas fa-edit"></i></button>
                                    <button class="btn-icon danger" onclick="Admin.doDeleteBoard(${b.id})"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('clubInfoForm').onsubmit = async (e) => {
            e.preventDefault();
            const data = {
                federationName: document.getElementById('ciName').value,
                president: document.getElementById('ciPresident').value,
                federationAddress: document.getElementById('ciAddress').value,
                stadium: document.getElementById('ciStadium').value,
                stadiumCapacity: document.getElementById('ciCapacity').value,
                stadiumAddress: document.getElementById('ciStadiumAddr').value,
                founded: document.getElementById('ciFounded').value
            };
            await Api.saveClubInfo(data);
            Object.assign(CLUB_INFO, data);
            renderClubInfo();
            alert('Información del club guardada');
        };
    },

    showAddStaffModal() {
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = 'Añadir Cuerpo Técnico';
        document.getElementById('modalBody').innerHTML = `
            <form id="staffForm" class="modal-form">
                <div class="form-group"><label>Nombre</label><input type="text" id="stName" required></div>
                <div class="form-group"><label>Cargo</label><input type="text" id="stRole" required></div>
                <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Guardar</button>
            </form>
        `;
        modal.style.display = 'flex';
        document.getElementById('staffForm').onsubmit = async (e) => {
            e.preventDefault();
            const result = await Api.addStaff({ name: document.getElementById('stName').value, role: document.getElementById('stRole').value });
            STAFF.push({ id: result.id, name: document.getElementById('stName').value, role: document.getElementById('stRole').value });
            modal.style.display = 'none';
            this.renderClubAdmin();
            renderClubInfo();
        };
    },

    showEditStaffModal(id) {
        const member = STAFF.find(s => s.id === id);
        if (!member) return;
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = 'Editar Cuerpo Técnico';
        document.getElementById('modalBody').innerHTML = `
            <form id="editStaffForm" class="modal-form">
                <div class="form-group"><label>Nombre</label><input type="text" id="estName" value="${member.name}" required></div>
                <div class="form-group"><label>Cargo</label><input type="text" id="estRole" value="${member.role}" required></div>
                <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Guardar</button>
            </form>
        `;
        modal.style.display = 'flex';
        document.getElementById('editStaffForm').onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('estName').value;
            const role = document.getElementById('estRole').value;
            await Api.saveStaff(id, { name, role });
            member.name = name; member.role = role;
            modal.style.display = 'none';
            this.renderClubAdmin();
            renderClubInfo();
        };
    },

    async doDeleteStaff(id) {
        await Api.deleteStaff(id);
        const idx = STAFF.findIndex(s => s.id === id);
        if (idx !== -1) STAFF.splice(idx, 1);
        this.renderClubAdmin();
        renderClubInfo();
    },

    showAddBoardModal() {
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = 'Añadir Directiva';
        document.getElementById('modalBody').innerHTML = `
            <form id="boardForm" class="modal-form">
                <div class="form-group"><label>Nombre</label><input type="text" id="bdName" required></div>
                <div class="form-group"><label>Cargo</label><input type="text" id="bdRole" required></div>
                <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Guardar</button>
            </form>
        `;
        modal.style.display = 'flex';
        document.getElementById('boardForm').onsubmit = async (e) => {
            e.preventDefault();
            const result = await Api.addBoard({ name: document.getElementById('bdName').value, role: document.getElementById('bdRole').value });
            BOARD.push({ id: result.id, name: document.getElementById('bdName').value, role: document.getElementById('bdRole').value });
            modal.style.display = 'none';
            this.renderClubAdmin();
            renderClubInfo();
        };
    },

    showEditBoardModal(id) {
        const member = BOARD.find(b => b.id === id);
        if (!member) return;
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = 'Editar Directiva';
        document.getElementById('modalBody').innerHTML = `
            <form id="editBoardForm" class="modal-form">
                <div class="form-group"><label>Nombre</label><input type="text" id="ebdName" value="${member.name}" required></div>
                <div class="form-group"><label>Cargo</label><input type="text" id="ebdRole" value="${member.role}" required></div>
                <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Guardar</button>
            </form>
        `;
        modal.style.display = 'flex';
        document.getElementById('editBoardForm').onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('ebdName').value;
            const role = document.getElementById('ebdRole').value;
            await Api.saveBoard(id, { name, role });
            member.name = name; member.role = role;
            modal.style.display = 'none';
            this.renderClubAdmin();
            renderClubInfo();
        };
    },

    // NEWS ADMIN
    renderAdminNews() {
        const tbody = document.getElementById('adminNewsBody');
        tbody.innerHTML = NEWS.map(n => `
            <tr>
                <td data-label="Título"><strong>${n.title}</strong></td>
                <td data-label="Fecha">${n.date}</td>
                <td data-label="Etiqueta"><span class="news-tag">${n.tag || '-'}</span></td>
                <td data-label="Acciones">
                    <button class="btn-icon" onclick="Admin.showEditNewsModal(${n.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon danger" onclick="Admin.confirmDeleteNews(${n.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    },

    showAddNewsModal() {
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = 'Nueva Noticia';
        document.getElementById('modalBody').innerHTML = `
            <form id="newsForm" class="modal-form">
                <div class="form-group">
                    <label>Título</label>
                    <input type="text" id="nTitle" required>
                </div>
                <div class="form-group">
                    <label>Resumen</label>
                    <textarea id="nSummary" rows="4" required></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Fecha</label>
                        <input type="date" id="nDate" value="${new Date().toISOString().slice(0, 10)}">
                    </div>
                    <div class="form-group">
                        <label>Etiqueta</label>
                        <select id="nTag">
                            <option value="Crónica">Crónica</option>
                            <option value="Fichaje">Fichaje</option>
                            <option value="Entrenamiento">Entrenamiento</option>
                            <option value="Bajas">Bajas</option>
                            <option value="Copa">Copa</option>
                            <option value="Club">Club</option>
                            <option value="General">General</option>
                        </select>
                    </div>
                </div>
                <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Guardar</button>
            </form>
        `;
        modal.style.display = 'flex';

        document.getElementById('newsForm').onsubmit = async (e) => {
            e.preventDefault();
            const data = {
                title: document.getElementById('nTitle').value,
                summary: document.getElementById('nSummary').value,
                date: document.getElementById('nDate').value,
                tag: document.getElementById('nTag').value
            };
            const result = await Api.addNews(data);
            NEWS.unshift({ id: result.id, ...data });
            NEWS.sort((a, b) => b.date.localeCompare(a.date));
            modal.style.display = 'none';
            this.renderAdminNews();
            renderNews();
        };
    },

    showEditNewsModal(id) {
        const news = NEWS.find(n => n.id === id);
        if (!news) return;

        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = 'Editar Noticia';
        document.getElementById('modalBody').innerHTML = `
            <form id="editNewsForm" class="modal-form">
                <div class="form-group">
                    <label>Título</label>
                    <input type="text" id="enTitle" value="${news.title}" required>
                </div>
                <div class="form-group">
                    <label>Resumen</label>
                    <textarea id="enSummary" rows="4" required>${news.summary || ''}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Fecha</label>
                        <input type="date" id="enDate" value="${news.date}">
                    </div>
                    <div class="form-group">
                        <label>Etiqueta</label>
                        <select id="enTag">
                            ${['Crónica','Fichaje','Entrenamiento','Bajas','Copa','Club','General'].map(t =>
                                `<option value="${t}" ${news.tag === t ? 'selected' : ''}>${t}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Guardar</button>
            </form>
        `;
        modal.style.display = 'flex';

        document.getElementById('editNewsForm').onsubmit = async (e) => {
            e.preventDefault();
            const data = {
                title: document.getElementById('enTitle').value,
                summary: document.getElementById('enSummary').value,
                date: document.getElementById('enDate').value,
                tag: document.getElementById('enTag').value
            };
            await Api.saveNews(id, data);
            Object.assign(news, data);
            modal.style.display = 'none';
            this.renderAdminNews();
            renderNews();
        };
    },

    confirmDeleteNews(id) {
        const news = NEWS.find(n => n.id === id);
        if (!news) return;

        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = 'Confirmar Eliminación';
        document.getElementById('modalBody').innerHTML = `
            <p>¿Estás seguro de eliminar la noticia <strong>"${news.title}"</strong>?</p>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="document.getElementById('modal').style.display='none';">Cancelar</button>
                <button class="btn-danger" onclick="Admin.doDeleteNews(${id})">Eliminar</button>
            </div>
        `;
        modal.style.display = 'flex';
    },

    async doDeleteNews(id) {
        await Api.deleteNews(id);
        const idx = NEWS.findIndex(n => n.id === id);
        if (idx !== -1) NEWS.splice(idx, 1);
        document.getElementById('modal').style.display = 'none';
        this.renderAdminNews();
        renderNews();
    },

    async doDeleteBoard(id) {
        await Api.deleteBoard(id);
        const idx = BOARD.findIndex(b => b.id === id);
        if (idx !== -1) BOARD.splice(idx, 1);
        this.renderClubAdmin();
        renderClubInfo();
    },

    init() {
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('.admin-panel').forEach(p => p.style.display = 'none');
                document.getElementById(tab.dataset.tab).style.display = 'block';
                if (tab.dataset.tab === 'adminAppearance') this.renderAppearance();
                if (tab.dataset.tab === 'adminConvocatoria') this.renderAdminConvocatoria();
                if (tab.dataset.tab === 'adminClub') this.renderClubAdmin();
                if (tab.dataset.tab === 'adminNews') this.renderAdminNews();
                if (tab.dataset.tab === 'adminPhotos') this.renderAdminPhotos();
                if (tab.dataset.tab === 'adminCronica') { this.renderCronicaForm(); this.loadCronicaHistory(); }
            });
        });

        document.getElementById('addPlayerBtn').addEventListener('click', () => this.showAddPlayerModal());
        document.getElementById('addUserBtn').addEventListener('click', () => this.showAddUserModal());
        document.getElementById('addNewsBtn').addEventListener('click', () => this.showAddNewsModal());
        document.getElementById('addPhotoBtn').addEventListener('click', () => this.showUploadPhotoModal());

        document.getElementById('saveFormationBtn').addEventListener('click', async () => {
            FORMATION.name = document.getElementById('formationSelect').value;
            this.applyFormationPositions();
            await Api.saveFormation(FORMATION.name, FORMATION.positions);
            renderConvocatoria();
            alert('Formación guardada: ' + FORMATION.name);
        });

        document.getElementById('formationSelect').addEventListener('change', async (e) => {
            FORMATION.name = e.target.value;
            this.applyFormationPositions();
            await Api.saveFormation(FORMATION.name, FORMATION.positions);
            this.renderAdminPitch();
            renderConvocatoria();
        });

        document.getElementById('modalClose').addEventListener('click', () => {
            document.getElementById('modal').style.display = 'none';
        });

        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modal')) {
                document.getElementById('modal').style.display = 'none';
            }
        });

        this.loadAndApplyAppearance();
    },

    exitAdmin() {
        const sections = document.querySelectorAll(".section");
        sections.forEach(s => s.classList.remove("active"));
        document.getElementById("convocatoria").classList.add("active");
        document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
        document.querySelector('.nav-link[data-section="convocatoria"]').classList.add("active");
    },

    _currentPlayerFilter: 'todos',

    filterPlayers(filter) {
        this._currentPlayerFilter = filter;
        document.querySelectorAll('.pos-filter').forEach(b => b.classList.remove('active'));
        document.querySelector(`.pos-filter[data-filter="${filter}"]`).classList.add('active');
        this.renderAdminPlayers();
    },

    // PHOTOS ADMIN
    showUploadPhotoModal() {
        const modal = document.getElementById('modal');
        document.getElementById('modalTitle').textContent = 'Subir Foto';
        document.getElementById('modalBody').innerHTML = `
            <form id="uploadPhotoForm" class="modal-form" enctype="multipart/form-data">
                <div class="form-group">
                    <label>Título (opcional)</label>
                    <input type="text" id="photoTitle" placeholder="Título de la foto">
                </div>
                <div class="form-group">
                    <label>Descripción (opcional)</label>
                    <input type="text" id="photoDesc" placeholder="Descripción">
                </div>
                <div class="form-group">
                    <label>Archivo</label>
                    <input type="file" id="photoFile" accept="image/*" required>
                </div>
                <button type="submit" class="btn-primary"><i class="fas fa-upload"></i> Subir</button>
            </form>
        `;
        modal.style.display = 'flex';

        document.getElementById('uploadPhotoForm').onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData();
            fd.append('photo', document.getElementById('photoFile').files[0]);
            fd.append('title', document.getElementById('photoTitle').value);
            fd.append('description', document.getElementById('photoDesc').value);
            fd.append('uploadedBy', CURRENT_USER?.username || 'admin');
            await Api.uploadPhoto(fd);
            modal.style.display = 'none';
            this.renderAdminPhotos();
            renderPhotos();
        };
    },

    async renderAdminPhotos() {
        const grid = document.getElementById('adminPhotosGrid');
        if (!grid) return;
        const photos = await Api.getPhotos();
        grid.innerHTML = photos.length === 0 ? '<p style="color:var(--text-muted);">No hay fotos</p>' :
            photos.map(p => `
                <div class="photo-card admin-photo-card">
                    <div class="photo-img"><img src="/uploads/${p.filename}" alt="${p.title || ''}" loading="lazy"></div>
                    <div class="photo-info">
                        ${p.title ? `<div class="photo-title">${p.title}</div>` : ''}
                        <div class="photo-date">${p.date || ''}</div>
                    </div>
                    <button class="btn-icon danger" onclick="Admin.deletePhoto(${p.id})" title="Eliminar"><i class="fas fa-trash"></i></button>
                </div>
            `).join('');
    },

    async deletePhoto(id) {
        if (!confirm('¿Eliminar esta foto?')) return;
        await Api.deletePhoto(id);
        this.renderAdminPhotos();
        renderPhotos();
    },

    // CRÓNICA ADMIN
    renderCronicaForm() {
        const sel = document.getElementById('cronicaPlayerSelect');
        if (!sel) return;
        const opts = PLAYERS.map(p => `<option value="${p.id}">${p.number} - ${p.nickname || p.name}</option>`).join('');
        sel.innerHTML = '<option value="">Seleccionar jugador...</option>' + opts;
        sel.onchange = () => this.loadCronicaHistory();
    },

    async loadCronicaHistory() {
        const sel = document.getElementById('cronicaPlayerSelect');
        const form = document.getElementById('cronicaForm');
        const hist = document.getElementById('cronicaHistory');
        const playerId = sel.value;
        if (!playerId) { form.innerHTML = ''; hist.innerHTML = ''; return; }

        const catLabels = { technique: 'Técnica', tactics: 'Táctica', physical: 'Física', mental: 'Mental', attitude: 'Actitud' };
        const renderStars = (val) => '★'.repeat(val) + '☆'.repeat(5 - val);

        const matchOpts = MATCHES.map(m => {
            const label = m.home ? `vs ${m.rival}` : `${m.rival} (F)`;
            return `<option value="${m.id}">${m.date} - ${label}</option>`;
        }).join('');

        form.innerHTML = `
            <div class="cronica-eval-form">
                <h3>Evaluación de ${PLAYERS.find(p => p.id == playerId)?.nickname || PLAYERS.find(p => p.id == playerId)?.name}</h3>
                <div class="cronica-row">
                    <label>Partido</label>
                    <select id="cronicaMatchSelect" style="flex:1;padding:0.5rem;border:1px solid var(--border, #e5e7eb);border-radius:8px;font-size:0.85rem;">
                        <option value="">Sin partido específico</option>
                        ${matchOpts}
                    </select>
                </div>
                ${Object.entries(catLabels).map(([key, label]) => `
                    <div class="cronica-row">
                        <label>${label}</label>
                        <div class="cronica-stars" data-cat="${key}">
                            ${[1,2,3,4,5].map(n => `<span class="star-input" data-val="${n}" onclick="Admin.setStar('${key}',${n})">☆</span>`).join('')}
                        </div>
                    </div>
                `).join('')}
                <div class="cronica-row">
                    <label>Observaciones</label>
                    <textarea id="cronicaComment" rows="3" placeholder="Escribe tus observaciones..."></textarea>
                </div>
                <div class="cronica-row">
                    <label>Evaluador</label>
                    <input type="text" id="cronicaEvaluator" placeholder="Nombre del evaluador" value="${CURRENT_USER?.username || ''}">
                </div>
                <button class="btn-primary" onclick="Admin.saveEvaluation(${playerId})"><i class="fas fa-save"></i> Guardar Evaluación</button>
            </div>
        `;
        this._cronicaScores = { technique: 0, tactics: 0, physical: 0, mental: 0, attitude: 0 };

        const evals = await Api.getPlayerEvaluations(playerId);
        hist.innerHTML = evals.length === 0 ? '' : `<h3>Historial</h3>` + evals.map(ev => {
            const avg = ((ev.technique + ev.tactics + ev.physical + ev.mental + ev.attitude) / 5).toFixed(1);
            const matchInfo = ev.matchRival ? (ev.matchHome ? `vs ${ev.matchRival}` : `${ev.matchRival} (F)`) : '';
            return `
            <div class="eval-card">
                <div class="eval-header">
                    <span class="eval-date">${ev.date}</span>
                    ${matchInfo ? `<span class="eval-evaluator" style="color:var(--primary);font-weight:600;"><i class="fas fa-futbol"></i> ${matchInfo}</span>` : ''}
                    <span class="eval-evaluator">${ev.evaluator || 'Staff'}</span>
                    <span class="eval-avg">Media: <strong>${avg}</strong>/5</span>
                    <button class="btn-icon danger" onclick="Admin.deleteEvaluation(${ev.id})" title="Eliminar"><i class="fas fa-trash"></i></button>
                </div>
                <div class="eval-scores">
                    ${Object.entries(catLabels).map(([cat, label]) => `
                        <div class="eval-cat"><span class="eval-cat-label">${label}</span> <span class="eval-stars">${renderStars(ev[cat])}</span></div>
                    `).join('')}
                </div>
                ${ev.comment ? `<div class="eval-comment"><i class="fas fa-comment-dots"></i> ${ev.comment}</div>` : ''}
            </div>`;
        }).join('');
    },

    setStar(cat, val) {
        if (!this._cronicaScores) this._cronicaScores = {};
        this._cronicaScores[cat] = val;
        const stars = document.querySelectorAll(`.cronica-stars[data-cat="${cat}"] .star-input`);
        stars.forEach((s, i) => { s.textContent = i < val ? '★' : '☆'; s.classList.toggle('active', i < val); });
    },

    async saveEvaluation(playerId) {
        const scores = this._cronicaScores || {};
        if (Object.values(scores).every(v => v === 0)) { alert('Pon al menos una puntuación'); return; }
        const comment = document.getElementById('cronicaComment')?.value || '';
        const evaluator = document.getElementById('cronicaEvaluator')?.value || '';
        const matchId = document.getElementById('cronicaMatchSelect')?.value || null;
        await Api.addEvaluation({ playerId: parseInt(playerId), matchId: matchId ? parseInt(matchId) : null, ...scores, comment, evaluator });
        this.loadCronicaHistory();
    },

    async deleteEvaluation(id) {
        if (!confirm('¿Eliminar esta evaluación?')) return;
        await Api.deleteEvaluation(id);
        this.loadCronicaHistory();
    }
};
