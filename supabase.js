// =====================================================
// SUPABASE.JS - Cloud sync for cross-device persistence
// Reads/writes a single row in `public.anitka_user_state` keyed by USER_ID.
// Local storage stays the source of truth in-session; cloud is a
// debounced backup + initial-load source if it's newer than local.
// =====================================================

const SupabaseSync = {
  URL: 'https://jknocwhxnebfqafixfcs.supabase.co',
  KEY: 'sb_publishable_R-fVeHeJaosHatrGF4DK_w_oODtfyR8',
  USER_ID: 'anitka',
  TABLE: 'anitka_user_state',
  DEBOUNCE_MS: 1500,
  enabled: true,
  saveTimer: null,
  inFlight: false,
  lastError: null,
  status: 'idle', // idle | saving | ok | error

  _headers(extra) {
    return Object.assign({
      apikey: this.KEY,
      Authorization: `Bearer ${this.KEY}`,
      'Content-Type': 'application/json'
    }, extra || {});
  },

  _setStatus(s, err) {
    this.status = s;
    this.lastError = err || null;
    if (typeof App !== 'undefined' && App && typeof App.renderHeader === 'function') {
      try { App.renderHeader(); } catch (e) { /* header may not exist yet */ }
    }
  },

  async load() {
    if (!this.enabled) return null;
    try {
      const r = await fetch(
        `${this.URL}/rest/v1/${this.TABLE}?user_id=eq.${encodeURIComponent(this.USER_ID)}&select=data,updated_at`,
        { headers: this._headers() }
      );
      if (!r.ok) {
        this._setStatus('error', `HTTP ${r.status}`);
        return null;
      }
      const rows = await r.json();
      if (!rows || rows.length === 0) {
        this._setStatus('ok');
        return null;
      }
      this._setStatus('ok');
      return rows[0]; // { data, updated_at }
    } catch (e) {
      this._setStatus('error', e.message);
      console.warn('[SupabaseSync] load failed:', e.message);
      return null;
    }
  },

  scheduleSave() {
    if (!this.enabled) return;
    clearTimeout(this.saveTimer);
    this._setStatus('saving');
    this.saveTimer = setTimeout(() => this._flush(), this.DEBOUNCE_MS);
  },

  cancelPending() {
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
  },

  async _flush() {
    if (this.inFlight) {
      this.scheduleSave();
      return;
    }
    if (typeof DataManager === 'undefined' || !DataManager.data) return;
    this.inFlight = true;
    try {
      const body = JSON.stringify({
        user_id: this.USER_ID,
        data: DataManager.data,
        updated_at: new Date().toISOString()
      });
      const r = await fetch(
        `${this.URL}/rest/v1/${this.TABLE}?on_conflict=user_id`,
        {
          method: 'POST',
          headers: this._headers({
            Prefer: 'resolution=merge-duplicates,return=minimal'
          }),
          body
        }
      );
      if (!r.ok) {
        const text = await r.text();
        this._setStatus('error', `HTTP ${r.status}: ${text.slice(0, 80)}`);
        console.warn('[SupabaseSync] save failed:', r.status, text);
      } else {
        this._setStatus('ok');
      }
    } catch (e) {
      this._setStatus('error', e.message);
      console.warn('[SupabaseSync] save error:', e.message);
    } finally {
      this.inFlight = false;
    }
  }
};
