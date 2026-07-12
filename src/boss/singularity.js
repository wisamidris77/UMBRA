/**
 * ==========================================================================
 * ORBITAL BOUND: Boss Rush - Boss 6: The Void Singularity (Gravity Shield)
 * ==========================================================================
 */

import { Boss } from './boss.js';
import { lerp, clamp, getDistance } from '../utils.js';
import { particles, screenShake } from '../particle.js';
import { audio } from '../audio.js';

export class VoidSingularity extends Boss {
  constructor(cx, cy) {
    super(cx, cy, 'THE VOID SINGULARITY', '#00f3ff'); // Neon cyan / dark hole
    
    // Gravity shield configuration (Anti-Spam)
    // Damage only registers if player.chargePercent >= 0.95
    
    // Orbit warping gravity well
    this.gravityActive = false;
    this.gravityStrength = 80; // Pull force in pixels/sec
    
    // Spiral disk particles rotation
    this.diskRotation = 0;
    
    // Wormholes
    this.wormholes = [];
    
    // Big Bang cores
    this.coresActive = false;
    this.cores = [];
    
    // Sequences
    this.phase1Sequence = [
      'EVENT_HORIZON_SPIRAL', 'RECOVERY',
      'GRAVITY_WELL', 'RECOVERY',
      'WORMHOLES', 'RECOVERY'
    ];
    
    this.phase2Sequence = [
      'GRAVITY_WELL', 'RECOVERY',
      'EVENT_HORIZON_SPIRAL', 'RECOVERY',
      'WORMHOLES', 'RECOVERY',
      'COMBINED_GRAVITY_SPIRAL', 'RECOVERY'
    ];
    
    this.finalSequence = [
      'WOW_BIG_BANG', 'RECOVERY',
      'COMBINED_GRAVITY_SPIRAL', 'RECOVERY',
      'WORMHOLES', 'RECOVERY'
    ];
    
    this.maxHp = 200;
    this.hp = 200;
    
    this.activeSequence = this.phase1Sequence;
    this.targetAttack = 'IDLE';
    this.recoveryDuration = 2.0;
    
    this.reset();
  }

  reset() {
    super.reset();
    this.gravityActive = false;
    this.diskRotation = 0;
    this.wormholes = [];
    this.coresActive = false;
    this.cores = [];
    
    this.activeSequence = this.phase1Sequence;
    this.targetAttack = 'IDLE';
    this.state = 'IDLE';
    this.stateTimer = 1.5;
    this.sequenceIndex = 0;
  }

  // Override takeDamage to enforce gravity shield (anti-spam 100% charge lock)
  takeDamage(amount) {
    const playerEl = window.gameAppInstance?.player;
    if (playerEl) {
      // If player dashes with less than 95% charge, they get repelled!
      if (playerEl.chargePercent < 0.95 && this.state !== 'TRANSITION') {
        playerEl.takeDamage(); // brainless spamming hits the wall!
        screenShake.trigger(12, 0.4);
        
        // Particle repulsors
        particles.spawnExplosion(playerEl.x, playerEl.y, '#00f3ff', 15, 7);
        
        const banner = document.getElementById('warning-banner');
        if (banner) {
          banner.textContent = "GRAVITY DEFLECT: USE FULL CHARGE";
          banner.style.color = '#00f3ff';
          banner.style.textShadow = '0 0 10px #00f3ff';
          banner.classList.add('active');
          setTimeout(() => banner.classList.remove('active'), 1200);
        }
        return; // Boss is immune!
      }
    }
    
    // Normal damage
    super.takeDamage(amount);
  }

  checkPhaseTransitions() {
    if (this.phase === 1 && this.hp <= 50) { // 25% of 200 maxHp
      this.triggerPhaseTransition(2, 120); // Phase 2 has 120 HP
      this.activeSequence = this.phase2Sequence;
      this.sequenceIndex = 0;
      this.color = '#ff9d00'; // Color turns to active event horizon orange!
    }
  }

  activeAttackCleanup() {
    this.gravityActive = false;
    this.wormholes = [];
    const banner = document.getElementById('warning-banner');
    if (banner) banner.classList.remove('active');
  }

  update(dt, player) {
    super.update(dt, player);
    
    // Accretion disk warps towards player
    const dx = player.x - this.cx;
    const dy = player.y - this.cy;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) {
      this.warpX = (dx / dist) * 10;
      this.warpY = (dy / dist) * 10;
    } else {
      this.warpX = 0;
      this.warpY = 0;
    }
    
    // Spin swirling accretion disk
    this.diskRotation -= 1.8 * dt;
    
    if (this.state === 'DEAD') {
      this.stateTimer -= dt;
      return;
    }
    
    if (this.state === 'TRANSITION') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'IDLE';
        this.isVulnerable = true;
        this.stateTimer = 1.0;
      }
      return;
    }
    
    // Update custom items
    this.updateGravityWell(dt, player);
    this.updateWormholes(dt, player);
    this.updateCores(dt, player);
    
    this.stateTimer -= dt;
    
    switch (this.state) {
      case 'IDLE':
        if (this.stateTimer <= 0) {
          const attack = this.activeSequence[this.sequenceIndex];
          this.sequenceIndex = (this.sequenceIndex + 1) % this.activeSequence.length;
          this.initiateAttack(attack);
        }
        break;
        
      case 'TELEGRAPH':
        if (this.stateTimer <= 0) {
          this.launchAttack();
        }
        break;
        
      case 'ATTACK':
        this.processAttack(dt, player);
        if (this.stateTimer <= 0) {
          this.finishAttack();
        }
        break;
        
      case 'RECOVERY':
        if (this.stateTimer <= 0) {
          this.state = 'IDLE';
          this.stateTimer = 0.5;
        }
        break;
    }
  }

  initiateAttack(attack) {
    this.targetAttack = attack;
    const banner = document.getElementById('warning-banner');
    
    if (attack === 'RECOVERY') {
      this.state = 'RECOVERY';
      this.stateTimer = this.recoveryDuration;
      return;
    }
    
    this.state = 'TELEGRAPH';
    
    switch (attack) {
      case 'EVENT_HORIZON_SPIRAL':
        this.stateTimer = 1.0;
        if (banner) {
          banner.textContent = "GRAVITATIONAL SPIRAL DISCHARGE";
          banner.style.color = '#00f3ff';
          banner.style.textShadow = '0 0 10px #00f3ff';
          banner.classList.add('active');
        }
        break;
        
      case 'GRAVITY_WELL':
        this.stateTimer = 0.8;
        this.gravityActive = true;
        if (banner) {
          banner.textContent = "GRAVITY WELL WARNING: RADIUS CRITICAL";
          banner.style.color = '#ff9d00';
          banner.style.textShadow = '0 0 10px #ff9d00';
          banner.classList.add('active');
        }
        break;
        
      case 'WORMHOLES':
        this.stateTimer = 1.0;
        this.spawnWormholes();
        if (banner) {
          banner.textContent = "DIMENSIONAL PORTALS DETECTED";
          banner.style.color = '#9d00ff';
          banner.style.textShadow = '0 0 10px #9d00ff';
          banner.classList.add('active');
        }
        break;
        
      case 'COMBINED_GRAVITY_SPIRAL':
        this.stateTimer = 1.0;
        this.gravityActive = true;
        if (banner) {
          banner.textContent = "GRAVITATIONAL COLLAPSE DISCHARGE";
          banner.style.color = '#ff00ff';
          banner.style.textShadow = '0 0 10px #ff00ff';
          banner.classList.add('active');
        }
        break;

      case 'WOW_BIG_BANG':
        this.stateTimer = 1.2;
        this.coresActive = true;
        this.isVulnerable = false; // Immune while cores live
        this.spawnCores();
        if (banner) {
          banner.textContent = "⚠️ COLLAPSE DETECTED: DESTROY 4 CORES ⚠️";
          banner.style.color = '#ffffff';
          banner.style.textShadow = '0 0 15px #00f3ff';
          banner.classList.add('active');
        }
        break;
    }
  }

  launchAttack() {
    this.state = 'ATTACK';
    const banner = document.getElementById('warning-banner');
    if (banner) banner.classList.remove('active');
    
    switch (this.targetAttack) {
      case 'EVENT_HORIZON_SPIRAL':
        this.stateTimer = 4.0;
        this.spawnSpiralWave();
        break;
        
      case 'GRAVITY_WELL':
        this.stateTimer = 4.5;
        break;
        
      case 'WORMHOLES':
        this.stateTimer = 5.0; // active 5s
        break;
        
      case 'COMBINED_GRAVITY_SPIRAL':
        this.stateTimer = 4.0;
        this.spawnSpiralWave();
        break;
        
      case 'WOW_BIG_BANG':
        this.stateTimer = 5.0; // 5s to destroy cores before supernova!
        break;
    }
  }

  processAttack(dt, player) {
    if (this.targetAttack === 'WOW_BIG_BANG') {
      // If timer runs out and cores still live, BANG!
      if (this.stateTimer <= dt) {
        if (this.cores.length > 0) {
          // Player failed: instant damage
          player.takeDamage();
          screenShake.trigger(30, 1.2);
          particles.spawnExplosion(this.cx, this.cy, '#00f3ff', 50, 12);
        }
        this.coresActive = false;
        this.cores = [];
        this.isVulnerable = true;
      }
    }
  }

  finishAttack() {
    this.gravityActive = false;
    this.coresActive = false;
    this.cores = [];
    this.isVulnerable = true;
    this.wormholes = [];
    
    this.state = 'RECOVERY';
    this.stateTimer = this.recoveryDuration;
  }

  updateGravityWell(dt, player) {
    if (!this.gravityActive || this.state !== 'ATTACK') return;
    
    // Gravity pulls player orbit radius closer!
    if (player && player.state === 'ORBITING') {
      // Pull player in
      player.orbitRadius = Math.max(120, player.orbitRadius - this.gravityStrength * dt);
    }
  }

  // Smoothly restore player's orbit radius during recovery/other states
  updateGravityWellRecovery(dt, player) {
    if (player && player.orbitRadius !== 220) {
      player.orbitRadius = lerp(player.orbitRadius, 220, 3 * dt);
    }
  }

  spawnSpiralWave() {
    // Spawns bullets in spiral offsets
    let delay = 0;
    const bulletCount = 14;
    for (let i = 0; i < bulletCount; i++) {
      setTimeout(() => {
        if (this.state !== 'ATTACK' || this.state === 'DEAD') return;
        const angle = i * 0.45;
        const speed = 2.0;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        this.spawnBullet(this.cx, this.cy, vx, vy, 10, '#00f3ff');
      }, delay);
      delay += 180;
    }
  }

  spawnWormholes() {
    this.wormholes = [];
    // Spawns 2 portals on orbit path
    const angle1 = Math.random() * Math.PI * 2;
    const angle2 = angle1 + Math.PI; // opposite sides
    
    this.wormholes.push({
      x: this.cx + Math.cos(angle1) * 220,
      y: this.cy + Math.sin(angle1) * 220,
      radius: 20,
      angle: angle1,
      timer: 0
    });
    this.wormholes.push({
      x: this.cx + Math.cos(angle2) * 220,
      y: this.cy + Math.sin(angle2) * 220,
      radius: 20,
      angle: angle2,
      timer: 0
    });
  }

  updateWormholes(dt, player) {
    this.wormholes.forEach(w => {
      w.timer += dt * 4;
      
      // Periodically spit out slow bullets crossing the center!
      if (this.state === 'ATTACK' && Math.floor(w.timer) % 8 === 0) {
        w.timer += 1; // avoid double trigger
        
        // Shoot directly across the center to the opposite side
        const angle = w.angle + Math.PI + (Math.random() * 0.2 - 0.1);
        const speed = 1.8;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        this.spawnBullet(w.x, w.y, vx, vy, 8, '#9d00ff');
      }
    });
  }

  spawnCores() {
    this.cores = [];
    const count = 4;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI / 2) * i;
      this.cores.push({
        x: this.cx + Math.cos(angle) * 120,
        y: this.cy + Math.sin(angle) * 120,
        angle: angle,
        radius: 14,
        hp: 1 // One hit destroys it
      });
    }
  }

  updateCores(dt, player) {
    if (!this.coresActive) return;
    
    // Check if player collided (dashed) into a core to destroy it
    if (player.state === 'DASHING') {
      this.cores.forEach((c, idx) => {
        const dist = getDistance(player.x, player.y, c.x, c.y);
        if (dist < c.radius + player.radius) {
          // Core destroyed!
          particles.spawnExplosion(c.x, c.y, '#ffd700', 12, 4);
          audio.playHit();
          this.cores.splice(idx, 1);
          
          // If all cores are destroyed early, vulnerable state restores
          if (this.cores.length === 0) {
            this.coresActive = false;
            this.isVulnerable = true;
            this.finishAttack();
          }
        }
      });
    }
  }

  draw(ctx) {
    super.draw(ctx);
    
    // Draw Gravity recovery checks
    const playerEl = window.gameAppInstance?.player;
    if (playerEl && !this.gravityActive) {
      this.updateGravityWellRecovery(0.016, playerEl);
    }
    
    // Draw wormholes
    this.wormholes.forEach(w => {
      ctx.save();
      ctx.strokeStyle = '#9d00ff';
      ctx.lineWidth = 3.5;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#9d00ff';
      
      // Portal spinning oval shape
      ctx.translate(w.x, w.y);
      ctx.rotate(w.timer * 0.4);
      ctx.scale(1.0, 0.6);
      
      ctx.beginPath();
      ctx.arc(0, 0, w.radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Portal core
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.restore();
    });
    
    // Draw Big Bang cores
    if (this.coresActive) {
      this.cores.forEach(c => {
        ctx.save();
        ctx.fillStyle = '#00f3ff';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#00f3ff';
        
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw inner diamond core
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(c.x, c.y - 6);
        ctx.lineTo(c.x + 6, c.y);
        ctx.lineTo(c.x, c.y + 6);
        ctx.lineTo(c.x - 6, c.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
    }
    
    // --- Draw accretion disc (Swirling particles) ---
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(this.diskRotation);
    
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00f3ff';
    
    // Draw spiral arms
    for (let j = 0; j < 3; j++) {
      ctx.beginPath();
      const armOffset = (Math.PI * 2 / 3) * j;
      for (let i = 0; i < 40; i++) {
        const angle = i * 0.15 + armOffset;
        const r = (this.radius + 10) + i * 1.5;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    
    // --- Draw Gravity Shield Indicator Ring (if vulnerable lock active) ---
    if (this.state !== 'DEAD' && this.state !== 'TRANSITION') {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00f3ff';
      ctx.setLineDash([5, 10]);
      
      // Draw outer dashed warning boundary of gravity shield
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, this.radius + 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    
    // --- Draw Main Singularity black hole center ---
    ctx.save();
    
    // Apply phase transition or death spin/scale transformations
    ctx.translate(this.cx, this.cy);
    if (this.state === 'DEAD') {
      ctx.rotate(this.deathRotation);
      ctx.scale(this.deathScale, this.deathScale);
    } else if (this.state === 'TRANSITION') {
      ctx.rotate(this.transitionRotation);
      ctx.scale(this.transitionScale, this.transitionScale);
    }
    ctx.translate(-this.cx, -this.cy);
    
    // Accretion disk warps dynamically towards player
    ctx.translate(this.warpX || 0, this.warpY || 0);
    
    const dynamicRadius = this.radius * this.visualScale;
    
    // Hit flash translation shake
    if (this.hitFlashTimer > 0) {
      ctx.translate((Math.random() * 2 - 1) * 3, (Math.random() * 2 - 1) * 3);
    }
    
    // White hit flash
    if (this.hitFlashTimer > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, dynamicRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    
    // Swirling black hole center
    // Swirling black hole center
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 4;
    ctx.shadowBlur = dynamicRadius * 0.75;
    ctx.shadowColor = this.color;
    
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, dynamicRadius * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Draw event horizon border details
    ctx.strokeStyle = this.phase === 2 ? 'rgba(255, 157, 0, 0.6)' : 'rgba(0, 243, 255, 0.6)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, dynamicRadius * 0.95, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw Warped Event Horizon accretion disk in Phase 2 (Glow warp!)
    if (this.phase === 2) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 157, 0, 0.4)';
      ctx.lineWidth = 3.5;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ff9d00';
      ctx.beginPath();
      ctx.ellipse(this.cx, this.cy, dynamicRadius * 1.5, dynamicRadius * 0.45, Date.now() * 0.002, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    
    ctx.restore();
  }
}
