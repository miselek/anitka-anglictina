// =====================================================
// CONFETTI.JS - Reward confetti animation
// =====================================================

const Confetti = {
  canvas: null,
  ctx: null,
  particles: [],
  running: false,
  animFrame: null,

  start(duration) {
    duration = duration || 5000;
    this.canvas = document.getElementById('confetti-canvas');
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvas.style.display = 'block';
    this.particles = [];
    this.running = true;

    const colors = ['#FF4B4B', '#FFC800', '#58CC02', '#1CB0F6', '#CE82FF', '#FF9600', '#FF69B4'];

    for (let i = 0; i < 150; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height - this.canvas.height,
        w: Math.random() * 12 + 4,
        h: Math.random() * 8 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedY: Math.random() * 3 + 1.5,
        speedX: (Math.random() - 0.5) * 3,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
        opacity: 1
      });
    }

    this.animate();

    setTimeout(() => {
      this.stop();
    }, duration);
  },

  animate() {
    if (!this.running) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const p of this.particles) {
      this.ctx.save();
      this.ctx.globalAlpha = p.opacity;
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      this.ctx.restore();

      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotSpeed;

      // Recycle particles that fall off screen
      if (p.y > this.canvas.height + 20) {
        p.y = -20;
        p.x = Math.random() * this.canvas.width;
      }
    }

    this.animFrame = requestAnimationFrame(() => this.animate());
  },

  stop() {
    this.running = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
    }
    if (this.canvas) {
      this.canvas.style.display = 'none';
      if (this.ctx) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  }
};
