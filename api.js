const API_BASE = '';

const Api = {
  async get(url) {
    const res = await fetch(API_BASE + url);
    if (!res.ok) throw new Error(`GET ${url} failed`);
    return res.json();
  },

  async post(url, data) {
    const res = await fetch(API_BASE + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `POST ${url} failed`); }
    return res.json();
  },

  async put(url, data) {
    const res = await fetch(API_BASE + url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `PUT ${url} failed`); }
    return res.json();
  },

  async del(url) {
    const res = await fetch(API_BASE + url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE ${url} failed`);
    return res.json();
  },

  async loadAll() {
    return this.get('/api/init');
  },

  async savePlayer(id, data) { return this.put(`/api/players/${id}`, data); },
  async addPlayer(data) { return this.post('/api/players', data); },
  async deletePlayer(id) { return this.del(`/api/players/${id}`); },
  async savePlayerStats(id, stats) { return this.put(`/api/players/${id}/stats`, stats); },

  async saveConvocatoria(playerIds) { return this.put('/api/convocatoria', { playerIds }); },
  async saveFormation(name, positions) { return this.put('/api/formation', { name, positions }); },

  async saveClubInfo(data) { return this.put('/api/club-info', data); },

  async addStaff(data) { return this.post('/api/staff', data); },
  async saveStaff(id, data) { return this.put(`/api/staff/${id}`, data); },
  async deleteStaff(id) { return this.del(`/api/staff/${id}`); },

  async addBoard(data) { return this.post('/api/board', data); },
  async saveBoard(id, data) { return this.put(`/api/board/${id}`, data); },
  async deleteBoard(id) { return this.del(`/api/board/${id}`); },

  async addNews(data) { return this.post('/api/news', data); },
  async saveNews(id, data) { return this.put(`/api/news/${id}`, data); },
  async deleteNews(id) { return this.del(`/api/news/${id}`); },

  async saveAppearance(data) { return this.put('/api/appearance', data); },

  async getPhotos() { return this.get('/api/photos'); },
  async uploadPhoto(formData) {
    const res = await fetch(API_BASE + '/api/photos', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },
  async deletePhoto(id) { return this.del(`/api/photos/${id}`); },

  async getEvaluations(playerId) {
    const url = playerId ? `/api/evaluations?playerId=${playerId}` : '/api/evaluations';
    return this.get(url);
  },
  async getPlayerEvaluations(playerId) { return this.get(`/api/evaluations/player/${playerId}`); },
  async addEvaluation(data) { return this.post('/api/evaluations', data); },
  async deleteEvaluation(id) { return this.del(`/api/evaluations/${id}`); },

  async login(username, password) { return this.post('/api/auth/login', { username, password }); },
  async getUsers() { return this.get('/api/users'); },
  async addUser(data) { return this.post('/api/users', data); },
  async saveUser(id, data) { return this.put(`/api/users/${id}`, data); },
  async deleteUser(id) { return this.del(`/api/users/${id}`); },
};
