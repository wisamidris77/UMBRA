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
    
    if (hpBar) {
      const hpPercent = (this.hp / this.maxHp) * 100;
      hpBar.style.width = `${hpPercent}%`;
      
      // Dynamic boss HP bar styling based on remaining health
      if (hpPercent < 30) {
        hpBar.style.background = 'linear-gradient(90deg, #ff0055, #ff00ff)';
        hpBar.style.boxShadow = '0 0 15px #ff0055';
      } else {
        hpBar.style.background = 'linear-gradient(90deg, #ff3b30, #ff9d00)';
        hpBar.style.boxShadow = '0 0 10px #ff3b30';
      }
    }
    
    if (bossNameEl) {
      bossNameEl.textContent = `${this.name} - PHASE ${this.phase}`;
    }
  }

  checkPhaseTransitions() {
    // Abstracted: children implement exact breakpoints
  }

  triggerPhaseTransition(nextPhase, warningMessage) {
    this.state = 'TRANSITION';
    this.phase = nextPhase;
    this.stateTimer = 3.0; // 3 seconds safety window
    this.isVulnerable = false;
    this.bullets = []; // Clear current bullets
    
    // Trigger transition effects
    screenShake.trigger(20, 1.2);
    audio.playBossExplode();
    particles.spawnExplosion(this.cx, this.cy, '#ffffff', 40, 10);
    particles.spawnShards(this.cx, this.cy, this.color, 25, 7);

    // Announce Phase Transition UI
    const banner = document.getElementById('warning-banner');
    if (banner) {
      banner.textContent = warningMessage || `PHASE ${nextPhase} DETECTED`;
      banner.style.color = '#ff00ff';
      banner.style.textShadow = '0 0 10px #ff00ff';
      banner.classList.add('active');
      setTimeout(() => banner.classList.remove('active'), 2500);
    }
    
    // Speed up tempo in Audio Engine
    if (this.phase === 2) {
      audio.setBPM(120);
    } else if (this.phase === 3) {
      audio.setBPM(135);
    }
    
    this.updateHpUI();
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
