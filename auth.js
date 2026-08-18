const Auth = {
    SESSION_KEY: 'sada_session',

    getSession() {
        const stored = sessionStorage.getItem(this.SESSION_KEY);
        return stored ? JSON.parse(stored) : null;
    },

    setSession(user) {
        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
    },

    async login(username, password) {
        try {
            const user = await Api.login(username, password);
            this.setSession(user);
            return user;
        } catch (e) {
            return null;
        }
    },

    logout() {
        sessionStorage.removeItem(this.SESSION_KEY);
    },

    isLoggedIn() {
        return this.getSession() !== null;
    },

    isAdmin() {
        const session = this.getSession();
        return session && session.type === 'admin';
    }
};
