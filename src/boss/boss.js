/**
 * ==========================================================================
 * ORBITAL BOUND: Boss Rush - Base Boss Class
 * ==========================================================================
 */

import { lerp, clamp, getDistance } from '../utils.js';
import { audio } from '../audio.js';
import { particles, screenShake } from '../particle.js';

export class Bullet {
  constructor(x, y, vx, vy, radius, color) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.color = color;
    this.active = true;
    this.life = 10.0; // Despawns after 10s
  }

  update(dt) {
    this.x += this.vx * 60 * dt; // Scale movement speed to match frame independent speed
    this.y += this.vy * 60 * dt;
    this.life -= dt;
    if (this.life <= 0) {
      this.active = false;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = this.radius * 1.5;
    ctx.shadowColor = this.color;
    ctx.fill();
    ctx.restore();
  }
}

export class Boss {
  constructor(cx, cy, name, color) {
    this.cx = cx;
    this.cy = cy;
    this.name = name;
    this.color = color;
    
    this.maxHp = 1000;
    this.hp = 1000;
    this.radius = 45;
    
    this.state = 'IDLE';
    this.phase = 1;
    
    this.stateTimer = 0;
    this.sequenceIndex = 0;
    this.sequence = [];
    
    this.hitFlashTimer = 0;
    this.recoveryDuration = 2.0;
    
    this.bullets = [];
    this.isVulnerable = true;
    this.visualScale = 1.0;
    
    this.wowAttackTriggered = false;
    this.telegraphBeepPlayed = false;

    // Animation properties
    this.deathRotation = 0;
    this.deathScale = 1.0;
    this.deathAlpha = 1.0;
    this.transitionRotation = 0;
    this.transitionScale = 1.0;
  }

  reset() {
    audio.playLaserStop();
    this.hp = this.maxHp;
    this.state = 'IDLE';
    this.phase = 1;
    this.stateTimer = 0;
    this.sequenceIndex = 0;
    this.bullets = [];
    this.isVulnerable = true;
    this.hitFlashTimer = 0;
    this.wowAttackTriggered = false;
    this.telegraphBeepPlayed = false;

    // Reset animations
    this.deathRotation = 0;
    this.deathScale = 1.0;
    this.deathAlpha = 1.0;
    this.transitionRotation = 0;
    this.transitionScale = 1.0;
    
    this.updateHpUI();
  }

  takeDamage(amount) {
    if (!this.isVulnerable || this.state === 'DEAD' || this.state === 'TRANSITION') return;
    
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlashTimer = 0.08; // Flash white for 80ms
    
    // Particles on hit
    particles.spawnExplosion(this.cx, this.cy, this.color, 10, 4);
    audio.playHit();
    
    this.updateHpUI();
    
    // Check Phase Transitions
    this.checkPhaseTransitions();
    
    if (this.hp <= 0) {
      this.die();
    }
  }

  updateHpUI() {
    const hpBar = document.getElementById('boss-hp-bar-inner');
    const bossNameEl = document.getElementById('boss-name');
    const container = document.getElementById('boss-hp-container');
    
    if (hpBar) {
      const hpPercent = (this.hp / this.maxHp) * 100;
      hpBar.style.width = `${hpPercent}%`;
      
      // Dynamic boss HP bar styling based on phase and remaining health
      if (this.phase === 2) {
        hpBar.style.background = 'linear-gradient(90deg, #ff00ff, #00f3ff)';
        hpBar.style.boxShadow = '0 0 15px #ff00ff';
      } else {
        if (hpPercent < 30) {
          hpBar.style.background = 'linear-gradient(90deg, #ff0055, #ff00ff)';
          hpBar.style.boxShadow = '0 0 15px #ff0055';
        } else {
          hpBar.style.background = 'linear-gradient(90deg, #ff3b30, #ff9d00)';
          hpBar.style.boxShadow = '0 0 10px #ff3b30';
        }
      }
    }
    
    if (container) {
      if (this.phase === 2) {
        container.style.width = '60%';
        container.style.maxWidth = '600px';
      } else {
        container.style.width = '40%';
        container.style.maxWidth = '450px';
      }
    }
    
    if (bossNameEl) {
      // Don't say "PHASE 2" in text, just show name, styled differently
      bossNameEl.textContent = this.name;
      if (this.phase === 2) {
        bossNameEl.style.color = '#ff00ff';
        bossNameEl.style.textShadow = '0 0 10px #ff00ff';
      } else {
        bossNameEl.style.color = '#ff3b30';
        bossNameEl.style.textShadow = 'var(--glow-red)';
      }
    }
  }

  checkPhaseTransitions() {
    // Abstracted: children implement exact breakpoints
  }

  activeAttackCleanup() {
    // Subclasses override to clean up active attack elements/hazards
  }

  triggerPhaseTransition(nextPhase, newMaxHp) {
    this.phase = nextPhase;
    
    // Surprise Phase 2: instant transition!
    if (nextPhase === 2) {
      // Use new custom max HP if provided, otherwise default to current maxHp
      this.maxHp = newMaxHp || this.maxHp;
      this.hp = this.maxHp;
      
      // Speed up tempo in Audio Engine
      audio.setBPM(120);
      
      // Interrupt current attack and clean up active hazards!
      this.state = 'RECOVERY';
      this.stateTimer = 1.0; // 1 second transition buffer
      this.bullets = [];
      this.activeAttackCleanup();
      
      // Visual transition effects (instant flash & shards, but NO state timer freeze)
      screenShake.trigger(25, 0.8);
      audio.playBossExplode();
      particles.spawnExplosion(this.cx, this.cy, '#ffffff', 40, 10);
      particles.spawnShards(this.cx, this.cy, this.color, 25, 7);
      
      this.updateHpUI();
    }
  }

  die() {
    this.state = 'DEAD';
    this.stateTimer = 3.0;
    this.bullets = [];
    
    screenShake.trigger(30, 2.0);
    audio.playBossExplode();
    particles.spawnExplosion(this.cx, this.cy, '#ffffff', 80, 12);
    particles.spawnShards(this.cx, this.cy, this.color, 40, 9);
  }

  spawnBullet(x, y, vx, vy, radius = 8, color = '#ff9d00') {
    if (this.bullets.length < 30) { // Slightly higher ceiling for dynamic battles
      this.bullets.push(new Bullet(x, y, vx, vy, radius, color));
    }
  }

  update(dt, player) {
    // Flash timer decay
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
    }
    
    // Beat pulse visual scaling dampener
    this.visualScale = lerp(this.visualScale, 1.0, 5 * dt);

    if (this.state === 'TRANSITION') {
      this.transitionRotation += 8 * dt;
      // oscillate size during transition
      this.transitionScale = 1.0 + Math.sin((3.0 - this.stateTimer) * Math.PI) * 0.4;
      this.visualScale = this.transitionScale;

      // Spawn extra transition particles
      if (Math.random() < 0.2) {
        const angle = Math.random() * Math.PI * 2;
        particles.spawn(this.cx, this.cy, Math.cos(angle)*5, Math.sin(angle)*5, 4, this.color, 0.8, 'fragment');
      }
      
      // Update active bullets (no player collision during phase shift)
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        b.update(dt);
        if (!b.active) {
          this.bullets.splice(i, 1);
        }
      }
      return;
    }

    if (this.state === 'DEAD') {
      this.deathRotation += 12 * dt;
      // Shrink over 3 seconds
      this.deathScale = Math.max(0, this.stateTimer / 3.0);
      this.deathAlpha = this.deathScale;
      this.visualScale = this.deathScale;

      // Spawn tiny random explosions on the boss body
      if (Math.random() < 0.25) {
        const ox = (Math.random() * 2 - 1) * this.radius * this.deathScale;
        const oy = (Math.random() * 2 - 1) * this.radius * this.deathScale;
        particles.spawnExplosion(this.cx + ox, this.cy + oy, this.color, 6, 2.5);
        if (Math.random() < 0.3) {
          audio.playHit();
        }
      }
      
      // Update active bullets
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        b.update(dt);
        if (!b.active) {
          this.bullets.splice(i, 1);
        }
      }
      return;
    }

    // Play warning sound when getting ready / telegraphing
    if (this.state === 'TELEGRAPH') {
      if (!this.telegraphBeepPlayed) {
        this.telegraphBeepPlayed = true;
        audio.playWarningBeep();
      }
    } else {
      this.telegraphBeepPlayed = false;
    }
    
    // Update active bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt);
      
      // Collision with player
      if (b.active && player.state !== 'DEAD') {
        const dist = getDistance(b.x, b.y, player.x, player.y);
        if (dist < b.radius + player.radius) {
          player.takeDamage();
          particles.spawnExplosion(b.x, b.y, b.color, 5, 3);
          b.active = false;
        }
      }
      
      if (!b.active) {
        this.bullets.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    // Draw bullets
    this.bullets.forEach(b => b.draw(ctx));
  }
}
