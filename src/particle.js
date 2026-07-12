/**
 * ==========================================================================
 * ORBITAL BOUND: Boss Rush - Particles & Screen Juice Systems
 * ==========================================================================
 */

import { randomRange } from './utils.js';

class Particle {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.size = 0;
    this.color = '#fff';
    this.alpha = 1;
    this.life = 0;
    this.maxLife = 0;
    this.type = 'circle'; // 'circle', 'square', 'fragment', 'text'
    this.angle = 0;
    this.rotSpeed = 0;
    this.gravity = 0;
    this.drag = 0.98;
    this.text = '';
  }

  init(x, y, vx, vy, size, color, maxLife, type = 'circle', gravity = 0, text = '') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.size = size;
    this.color = color;
    this.alpha = 1;
    this.life = maxLife;
    this.maxLife = maxLife;
    this.type = type;
    this.angle = type === 'text' ? 0 : Math.random() * Math.PI * 2;
    this.rotSpeed = type === 'text' ? 0 : randomRange(-0.1, 0.1);
    this.gravity = gravity;
    this.text = text;
    this.active = true;
  }

  update(dt) {
    if (!this.active) return;
    
    // Apply physics
    this.vx *= this.drag;
    this.vy *= this.drag;
    this.vy += this.gravity;
    
    this.x += this.vx;
    this.y += this.vy;
    
    this.angle += this.rotSpeed;
    
    // Progress life
    this.life -= dt;
    this.alpha = Math.max(0, this.life / this.maxLife);
    
    if (this.life <= 0) {
      this.active = false;
    }
  }

  draw(ctx) {
    if (!this.active) return;
    
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = this.size * 1.5;
    ctx.shadowColor = this.color;
    
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    if (this.type === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'square') {
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    } else if (this.type === 'fragment') {
      // Angular shard triangle
      ctx.beginPath();
      ctx.moveTo(0, -this.size);
      ctx.lineTo(this.size * 0.8, this.size * 0.6);
      ctx.lineTo(-this.size * 0.8, this.size * 0.6);
      ctx.closePath();
      ctx.fill();
    } else if (this.type === 'text') {
      ctx.font = `italic bold ${this.size}px 'Outfit', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Outline
      ctx.strokeStyle = '#020204';
      ctx.lineWidth = 4;
      ctx.strokeText(this.text, 0, 0);
      ctx.fillText(this.text, 0, 0);
    }
    
    ctx.restore();
  }
}

class ParticleManager {
  constructor() {
    this.particles = [];
    this.poolSize = 400;
    
    // Populate pool
    for (let i = 0; i < this.poolSize; i++) {
      this.particles.push(new Particle());
    }
  }

  spawn(x, y, vx, vy, size, color, maxLife, type = 'circle', gravity = 0, text = '') {
    // Find inactive particle
    const p = this.particles.find(p => !p.active);
    if (p) {
      p.init(x, y, vx, vy, size, color, maxLife, type, gravity, text);
    }
  }

  spawnExplosion(x, y, color, count = 20, speed = 6) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const vel = randomRange(1, speed);
      const vx = Math.cos(angle) * vel;
      const vy = Math.sin(angle) * vel;
      const size = randomRange(2, 6);
      const life = randomRange(0.4, 0.8);
      this.spawn(x, y, vx, vy, size, color, life, 'circle');
    }
  }

  spawnShards(x, y, color, count = 10, speed = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const vel = randomRange(2, speed);
      const vx = Math.cos(angle) * vel;
      const vy = Math.sin(angle) * vel;
      const size = randomRange(4, 10);
      const life = randomRange(0.6, 1.2);
      // Spawn triangle shards that fall down under gravity
      this.spawn(x, y, vx, vy, size, color, life, 'fragment', 0.15);
    }
  }

  spawnText(x, y, text, color = '#fff', size = 16) {
    // Float upwards slowly
    const vx = randomRange(-0.8, 0.8);
    const vy = randomRange(-2.5, -1.5);
    this.spawn(x, y, vx, vy, size, color, 1.2, 'text', 0.04, text);
  }

  update(dt) {
    this.particles.forEach(p => p.update(dt));
  }

  draw(ctx) {
    ctx.save();
    // Use additive blending for glowing particles
    ctx.globalCompositeOperation = 'screen';
    this.particles.forEach(p => p.draw(ctx));
    ctx.restore();
  }

  clear() {
    this.particles.forEach(p => p.active = false);
  }
}

// --- Screen Shake & Hit Stop Managers ---

class ScreenShakeManager {
  constructor() {
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.x = 0;
    this.y = 0;
  }

  trigger(intensity, duration) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }

  update(dt) {
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      // High-frequency noise offset decreasing linearly
      const currentIntensity = this.shakeIntensity * (this.shakeDuration / 1);
      this.x = (Math.random() * 2 - 1) * currentIntensity;
      this.y = (Math.random() * 2 - 1) * currentIntensity;
      
      if (this.shakeDuration <= 0) {
        this.x = 0;
        this.y = 0;
      }
    } else {
      this.x = 0;
      this.y = 0;
    }
  }

  applyTransform(ctx) {
    if (this.x !== 0 || this.y !== 0) {
      ctx.translate(this.x, this.y);
    }
  }
}

class HitStopManager {
  constructor() {
    this.stopDuration = 0; // remaining freeze time in seconds
  }

  trigger(durationSeconds = 0.08) {
    this.stopDuration = durationSeconds;
  }

  update(dt) {
    if (this.stopDuration > 0) {
      this.stopDuration -= dt;
      return true; // We are in hit-stop (frozen)
    }
    return false; // Not frozen
  }

  isFrozen() {
    return this.stopDuration > 0;
  }
}

export const particles = new ParticleManager();
export const screenShake = new ScreenShakeManager();
export const hitStop = new HitStopManager();
