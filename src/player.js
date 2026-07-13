/**
 * ==========================================================================
 * ORBITAL BOUND: Boss Rush - Player Controller (Movement & Actions)
 * ==========================================================================
 */

import { lerp, clamp, getDistance } from './utils.js';
import { audio } from './audio.js';
import { particles, screenShake, hitStop } from './particle.js';

export class Player {
  constructor(cx, cy) {
    this.cx = cx; // center X (boss position)
    this.cy = cy; // center Y (boss position)
    this.defaultOrbitRadius = 220;
    this.orbitRadius = this.defaultOrbitRadius;
    
    this.x = cx;
    this.y = cy - this.orbitRadius;
    this.radius = 12;
    
    this.theta = -Math.PI / 2; // start at top
    // 1 full revolution = 6.5s => angular speed = (2 * PI) / 6.5
    this.orbitSpeed = (Math.PI * 2) / 6.5;
    this.orbitDir = 1; // 1 = CW, -1 = CCW
    
    // Gameplay States: 'ORBITING', 'CHARGING', 'DASHING', 'RETURNING'
    this.state = 'ORBITING';
    
    // HP
    this.maxHp = 5;
    this.hp = 5;
    this.invincibilityTime = 0;
    this.flashTimer = 0;
    
    // Charge parameters
    this.chargeTime = 0;
    this.maxChargeTime = 2.0; // 2 seconds max
    this.chargePercent = 0;
    
    // Dash physics parameters
    this.dashProgress = 0; // 0 to 1
    this.dashDuration = 0.15; // 150ms dash to center
    this.returnDuration = 0.25; // 250ms return to orbit
    this.dashStartX = 0;
    this.dashStartY = 0;
    
    // Trails for motion blur
    this.trail = [];
    this.maxTrailLength = 12;

    // Upgrades
    this.bonusDamage = 0;
    this.bonusInvincibility = 0;
  }

  applyUpgrades(upgrades) {
    // Reset to base stats first
    this.maxHp = 5;
    this.orbitSpeed = (Math.PI * 2) / 6.5;
    this.maxChargeTime = 2.0;
    this.dashDuration = 0.15;
    this.bonusDamage = 0;
    this.bonusInvincibility = 0;

    if (!upgrades) {
      this.hp = this.maxHp;
      this.updateHeartsUI();
      return;
    }

    // Apply primary and synergistic secondary stats from the upgraded items
    
    // Hyper Drive (orbitSpeed): +25% Orbit Speed & +2 Dash Damage
    if (upgrades.orbitSpeed) {
      const stacks = upgrades.orbitSpeed;
      this.orbitSpeed *= (1 + 0.25 * stacks);
      this.bonusDamage += 2 * stacks;
    }
    
    // Quantum Capacitor (chargeSpeed): +30% Charge Speed & +20% Dash Speed
    if (upgrades.chargeSpeed) {
      const stacks = upgrades.chargeSpeed;
      this.maxChargeTime /= (1 + 0.30 * stacks);
      this.dashDuration /= (1 + 0.20 * stacks);
    }
    
    // Chrono Thrusters (dashSpeed): +40% Dash Speed & +1 Max HP
    if (upgrades.dashSpeed) {
      const stacks = upgrades.dashSpeed;
      this.dashDuration /= (1 + 0.40 * stacks);
      this.maxHp += 1 * stacks;
    }
    
    // Reinforced Hull (maxHp): +1 Max HP & +25% Charge Rate (Less charging time!)
    if (upgrades.maxHp) {
      const stacks = upgrades.maxHp;
      this.maxHp += 1 * stacks;
      this.maxChargeTime /= (1 + 0.25 * stacks);
    }
    
    // Vortex Matrix (bonusDamage): +5 Dash Damage & +0.4s Invincibility
    if (upgrades.bonusDamage) {
      const stacks = upgrades.bonusDamage;
      this.bonusDamage += 5 * stacks;
      this.bonusInvincibility += 0.4 * stacks;
    }
    
    // Nano Shielding (bonusInvincibility): +0.6s Invincibility & +15% Orbit Speed
    if (upgrades.bonusInvincibility) {
      const stacks = upgrades.bonusInvincibility;
      this.bonusInvincibility += 0.6 * stacks;
      this.orbitSpeed *= (1 + 0.15 * stacks);
    }

    this.hp = this.maxHp;
    this.updateHeartsUI();
  }

  reset() {
    this.hp = this.maxHp;
    this.state = 'ORBITING';
    this.orbitRadius = this.defaultOrbitRadius;
    this.theta = -Math.PI / 2;
    this.chargeTime = 0;
    this.chargePercent = 0;
    this.invincibilityTime = 0;
    this.trail = [];
    this.updatePosition();
    this.updateHeartsUI();
    audio.stopCharge();
  }

  updatePosition() {
    this.x = this.cx + Math.cos(this.theta) * this.orbitRadius;
    this.y = this.cy + Math.sin(this.theta) * this.orbitRadius;
  }

  press() {
    if (this.state !== 'ORBITING') return;
    this.state = 'CHARGING';
    this.chargeTime = 0;
    this.chargePercent = 0;
    audio.startCharge();
  }

  release(holdDuration) {
    if (this.state !== 'CHARGING') return;
    
    audio.stopCharge();
    
    if (holdDuration < 200) {
      // QUICK TAP: Reverse direction
      this.orbitDir *= -1;
      this.state = 'ORBITING';
    } else {
      // HOLD RELEASE: Initiate Dash Attack
      this.state = 'DASHING';
      this.dashProgress = 0;
      this.dashStartX = this.x;
      this.dashStartY = this.y;
      
      // Spawn initial dash puff
      particles.spawnExplosion(this.x, this.y, '#00f3ff', 8, 3);
      audio.playDash();
    }
  }

  takeDamage() {
    if (window.gameAppInstance && window.gameAppInstance.superDebugActive) return; // CHEAT CODE IMMORTALITY
    if (this.invincibilityTime > 0 || this.state === 'DEAD') return;
    
    this.hp = Math.max(0, this.hp - 1);
    this.invincibilityTime = 1.0 + (this.bonusInvincibility || 0); // i-frames including upgrades
    this.flashTimer = 0.1; // Flash red
    
    audio.playHurt();
    screenShake.trigger(15, 0.4);
    
    // Flash Screen UI Red
    const flashEl = document.getElementById('damage-flash');
    if (flashEl) {
      flashEl.classList.add('active');
      setTimeout(() => flashEl.classList.remove('active'), 150);
    }
    
    this.updateHeartsUI();
    
    if (this.hp <= 0) {
      this.state = 'DEAD';
      audio.stopCharge();
      particles.spawnExplosion(this.x, this.y, '#ff0055', 30, 8);
    }
  }

  heal(amount) {
    if (this.state === 'DEAD' || this.hp >= this.maxHp) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.updateHeartsUI();
  }

  updateHeartsUI() {
    const heartsContainer = document.getElementById('player-hearts');
    if (!heartsContainer) return;
    
    heartsContainer.innerHTML = '';
    for (let i = 0; i < this.maxHp; i++) {
      const heartSpan = document.createElement('span');
      heartSpan.className = 'heart';
      if (i < this.hp) {
        heartSpan.classList.add('active');
      } else {
        heartSpan.classList.add('inactive');
      }
      
      heartSpan.innerHTML = `
        <svg class="heart-svg" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      `;
      heartsContainer.appendChild(heartSpan);
    }
  }

  update(dt, boss) {
    if (this.state === 'DEAD') return;
    
    // Update invincibility flashes
    if (this.invincibilityTime > 0) {
      this.invincibilityTime -= dt;
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
    }
    
    // Save trail history
    if (this.state !== 'CHARGING') {
      this.trail.unshift({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrailLength) {
        this.trail.pop();
      }
    } else {
      // Decay trail slowly while frozen
      if (this.trail.length > 0) {
        this.trail.pop();
      }
    }
    
    // Main state machine
    switch (this.state) {
      case 'ORBITING': {
        const currentSpeed = (window.gameAppInstance && window.gameAppInstance.superDebugActive) 
          ? this.orbitSpeed * 4 
          : this.orbitSpeed;
        
        let speedMult = 1.0;
        const currentBoss = window.gameAppInstance?.boss;
        if (currentBoss && currentBoss.gravityFlicker) {
          // Oscillate player speed dynamically between 0.3x and 1.8x
          speedMult = 1.05 + Math.sin(performance.now() * 0.005) * 0.75;
        }
        
        // Smoothly return player to their target default orbit radius
        this.orbitRadius = lerp(this.orbitRadius, this.defaultOrbitRadius, 5 * dt);
        
        this.theta += this.orbitDir * currentSpeed * dt * speedMult;
        this.updatePosition();
        break;
      }
        
      case 'CHARGING':
        if (window.gameAppInstance && window.gameAppInstance.superDebugActive) {
          this.chargeTime = this.maxChargeTime;
        } else {
          this.chargeTime += dt;
        }
        this.chargePercent = clamp(this.chargeTime / this.maxChargeTime, 0, 1);
        audio.updateChargePitch(this.chargePercent);
        
        // Spawn charge sparkles inward
        if (Math.random() < 0.3) {
          const spawnAngle = Math.random() * Math.PI * 2;
          const dist = 30 + Math.random() * 30;
          const sx = this.x + Math.cos(spawnAngle) * dist;
          const sy = this.y + Math.sin(spawnAngle) * dist;
          const vx = (this.x - sx) * 0.1;
          const vy = (this.y - sy) * 0.1;
          particles.spawn(sx, sy, vx, vy, 2, '#00f3ff', 0.4);
        }
        break;
        
      case 'DASHING':
        // Smoothly interpolate towards the boss center (0, 0 local center, which is cx, cy)
        const currentDashDuration = (window.gameAppInstance && window.gameAppInstance.superDebugActive)
          ? this.dashDuration * 0.2
          : this.dashDuration;
        this.dashProgress += dt / currentDashDuration;
        
        if (this.dashProgress >= 1) {
          this.dashProgress = 1;
          this.x = this.cx;
          this.y = this.cy;
          
          // Collision and attack hit happens!
          this.handleHit(boss);
        } else {
          // Use cubic ease out for high speed initial burst
          const t = this.dashProgress;
          this.x = lerp(this.dashStartX, this.cx, t * t);
          this.y = lerp(this.dashStartY, this.cy, t * t);
        }
        break;
        
      case 'RETURNING':
        // Smoothly slide back out to the orbit point
        const currentReturnDuration = (window.gameAppInstance && window.gameAppInstance.superDebugActive)
          ? this.returnDuration * 0.2
          : this.returnDuration;
        this.dashProgress += dt / currentReturnDuration;
        
        // Calculate the current target orbit coordinate (which might keep rotating)
        const targetX = this.cx + Math.cos(this.theta) * this.orbitRadius;
        const targetY = this.cy + Math.sin(this.theta) * this.orbitRadius;
        
        // Rotate while returning so movement is seamless
        const returnOrbitSpeed = (window.gameAppInstance && window.gameAppInstance.superDebugActive)
          ? this.orbitSpeed * 4
          : this.orbitSpeed;
        this.theta += this.orbitDir * returnOrbitSpeed * dt;
        
        if (this.dashProgress >= 1) {
          this.state = 'ORBITING';
          this.updatePosition();
        } else {
          // Linear interpolation back to orbit
          const t = this.dashProgress;
          this.x = lerp(this.cx, targetX, t);
          this.y = lerp(this.cy, targetY, t);
        }
        break;
    }
  }

  handleHit(boss) {
    if (window.gameAppInstance && window.gameAppInstance.state === 'CHEST_LOOT') {
      window.gameAppInstance.breakChest();
      this.state = 'RETURNING';
      this.dashProgress = 0;
      return;
    }

    if (!boss || boss.hp <= 0) {
      this.state = 'RETURNING';
      this.dashProgress = 0;
      return;
    }
    
    // Calculate damage: base is 2, fully charged is 20 (quadratic scaling) + bonus upgrade damage
    const dmg = Math.round(lerp(2, 20, Math.pow(this.chargePercent, 2))) + (this.bonusDamage || 0);
    
    // Hit effects
    boss.takeDamage(dmg);
    hitStop.trigger(0.08); // 80ms freeze
    screenShake.trigger(18, 0.45); // Heavy impact shake
    
    // Spawn damage floating text
    if (this.chargePercent >= 0.95) {
      particles.spawnText(this.x, this.y - 30, `${dmg} CRITICAL!`, '#00f3ff', 22);
    } else {
      particles.spawnText(this.x, this.y - 30, `${dmg}`, '#ffffff', 16);
    }
    
    // Particle splash
    particles.spawnExplosion(this.cx, this.cy, '#ff0055', 25, 8);
    particles.spawnShards(this.cx, this.cy, '#00f3ff', 12, 6);
    
    // Set returning state
    this.state = 'RETURNING';
    this.dashProgress = 0;
  }

  draw(ctx) {
    if (this.state === 'DEAD') return;
    
    // Draw motion blur trail
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      const opacity = (1 - (i / this.trail.length)) * 0.25;
      const size = this.radius * (1 - (i / this.trail.length) * 0.5);
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 243, 255, ${opacity})`;
      ctx.shadowBlur = size;
      ctx.shadowColor = '#00f3ff';
      ctx.fill();
    }
    ctx.restore();
    
    // Determine player visual style
    ctx.save();
    
    // Blinking effect if invincible
    if (this.invincibilityTime > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
      ctx.restore();
      return;
    }
    
    // Glow Setup
    ctx.shadowBlur = this.radius * (this.state === 'CHARGING' ? 1.5 + this.chargePercent * 1.5 : 1.2);
    ctx.shadowColor = '#00f3ff';
    ctx.fillStyle = this.state === 'CHARGING' ? `rgb(${Math.floor(lerp(0, 255, this.chargePercent))}, 243, 255)` : '#00f3ff';
    
    // Apply Squash/Stretch during Dash
    ctx.translate(this.x, this.y);
    
    if (this.state === 'DASHING') {
      // Calculate travel vector
      const dx = this.cx - this.dashStartX;
      const dy = this.cy - this.dashStartY;
      const angle = Math.atan2(dy, dx);
      ctx.rotate(angle);
      
      // Squash along direction (narrow width, long height)
      // Speed makes it stretch more
      const stretch = 1.6;
      const squash = 0.6;
      ctx.scale(stretch, squash);
      
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.state === 'RETURNING') {
      // Stretch backward
      const targetX = this.cx + Math.cos(this.theta) * this.orbitRadius;
      const targetY = this.cy + Math.sin(this.theta) * this.orbitRadius;
      const angle = Math.atan2(targetY - this.cy, targetX - this.cx);
      ctx.rotate(angle);
      
      ctx.scale(0.8, 1.2);
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Normal circular player
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
    
    // Draw Charge Outer Ring (if charging)
    if (this.state === 'CHARGING') {
      ctx.save();
      ctx.beginPath();
      // Outer ring shrinks down onto the player as charge completes
      const ringRadius = this.radius + (1 - this.chargePercent) * 25;
      ctx.arc(this.x, this.y, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 243, 255, ${0.3 + this.chargePercent * 0.7})`;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00f3ff';
      ctx.stroke();
      
      // Radial progress arc
      if (this.chargePercent > 0) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 6, -Math.PI / 2, -Math.PI / 2 + (this.chargePercent * Math.PI * 2));
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
