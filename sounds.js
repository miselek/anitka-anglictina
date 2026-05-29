// =====================================================
// SOUNDS.JS - Audio rewards using Web Audio API
// No external assets — sounds synthesized on the fly.
// =====================================================

const Sounds = {
  ctx: null,
  enabled: true,

  _ensureCtx() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { this.enabled = false; return null; }
      this.ctx = new Ctx();
    }
    // Resume in case it's suspended (Safari requires user gesture first).
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  // Quick "ding" for a single correct answer (used sparingly; default speech
  // covers most feedback).
  ding() {
    const ctx = this._ensureCtx(); if (!ctx) return;
    const t0 = ctx.currentTime;
    this._tone(ctx, 880, t0,        0.08, 0.18);
    this._tone(ctx, 1320, t0 + 0.06, 0.12, 0.14);
  },

  // Brief "trombone" for wrong answer. Down arpeggio.
  buzz() {
    const ctx = this._ensureCtx(); if (!ctx) return;
    const t0 = ctx.currentTime;
    this._tone(ctx, 220, t0,        0.18, 0.18, 'sawtooth');
    this._tone(ctx, 165, t0 + 0.16, 0.22, 0.14, 'sawtooth');
  },

  // Level-up sparkly arpeggio.
  levelUp() {
    const ctx = this._ensureCtx(); if (!ctx) return;
    const t0 = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => this._tone(ctx, freq, t0 + i * 0.08, 0.18, 0.20));
  },

  // BIG fanfare: triumphant chord progression + applause-like noise burst.
  // Used at end of a quiz / lesson.
  fanfare() {
    const ctx = this._ensureCtx(); if (!ctx) return;
    const t0 = ctx.currentTime;

    // Melody: ta-DA-DA-DAAA (rising arpeggio resolving to high note)
    const melody = [
      { f: 523.25, t: 0.00, d: 0.14 }, // C5
      { f: 659.25, t: 0.16, d: 0.14 }, // E5
      { f: 783.99, t: 0.32, d: 0.14 }, // G5
      { f: 1046.5, t: 0.48, d: 0.6  }, // C6 sustained
    ];
    melody.forEach(n => this._tone(ctx, n.f, t0 + n.t, n.d, 0.22));

    // Harmony layer (one octave down)
    melody.forEach(n => this._tone(ctx, n.f / 2, t0 + n.t, n.d, 0.10, 'triangle'));

    // Bell-like sparkle at the peak
    this._tone(ctx, 1568.0, t0 + 0.48, 0.8, 0.10, 'sine');
    this._tone(ctx, 2093.0, t0 + 0.60, 0.6, 0.08, 'sine');

    // Applause-like noise burst at the climax
    this._noiseBurst(ctx, t0 + 0.4, 0.9, 0.12);
  },

  _tone(ctx, freq, startAt, duration, gain, type) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, startAt);
    // ADSR-ish envelope: quick attack, exponential decay
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(gain, startAt + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
  },

  _noiseBurst(ctx, startAt, duration, gain) {
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const out = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // Pink-ish noise (random samples with envelope)
      const env = Math.min(1, i / (ctx.sampleRate * 0.08)) *
                  Math.exp(-3 * (i / bufferSize));
      out[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    // Band-pass filter to make it sound like distant applause
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2200;
    filter.Q.value = 1.5;

    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, startAt);

    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(startAt);
    src.stop(startAt + duration);
  }
};
