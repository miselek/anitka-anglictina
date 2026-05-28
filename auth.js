// =====================================================
// AUTH.JS - Simple PIN-based multi-user login
// User data is namespaced by user_id in both localStorage and Supabase.
// PINs are hardcoded client-side: this is a personal family app, not a
// security-critical system. The PIN just prevents accidental cross-account
// access between Anitka and her parents.
// =====================================================

const Auth = {
  CURRENT_USER_KEY: 'anitka_current_user',

  USERS: [
    { id: 'anitka', name: 'Anitka', pin: '2015', emoji: '👧', color: '#ff7eb9' },
    { id: 'tata',   name: 'Táta',   pin: '1993', emoji: '👨', color: '#5fa8ff' },
    { id: 'mama',   name: 'Máma',   pin: '1990', emoji: '👩', color: '#ffaa5f' }
  ],

  currentUserId: null,

  getCurrent() {
    if (this.currentUserId) {
      return this.USERS.find(u => u.id === this.currentUserId) || null;
    }
    try {
      const stored = localStorage.getItem(this.CURRENT_USER_KEY);
      if (stored && this.USERS.some(u => u.id === stored)) {
        this.currentUserId = stored;
        return this.USERS.find(u => u.id === stored);
      }
    } catch (e) { /* ignore */ }
    return null;
  },

  isLoggedIn() {
    return this.getCurrent() !== null;
  },

  login(userId, pin) {
    const user = this.USERS.find(u => u.id === userId);
    if (!user) return { ok: false, error: 'Uživatel neexistuje.' };
    if (user.pin !== String(pin)) return { ok: false, error: 'Špatný PIN.' };
    this.currentUserId = user.id;
    try {
      localStorage.setItem(this.CURRENT_USER_KEY, user.id);
    } catch (e) { /* ignore */ }
    return { ok: true, user };
  },

  logout() {
    this.currentUserId = null;
    try {
      localStorage.removeItem(this.CURRENT_USER_KEY);
    } catch (e) { /* ignore */ }
  }
};
