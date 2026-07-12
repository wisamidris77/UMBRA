/**
 * ==========================================================================
 * ORBITAL BOUND: Boss Rush - Boss 6: The Void Singularity (Gravity Shield)
 * ==========================================================================
 */

import { Boss } from './boss.js';
import { lerp, clamp, getDistance, checkCircleLineCollision } from '../utils.js';
import { particles, screenShake } from '../particle.js';
import { audio } from '../audio.js';

class GravityRipple {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 40;
    this.width = 15;
    this.speed = 180; // Expand rate
    this.active = true;
    this.life = 4.0;
    this.skipCollision = true;
  }
  update(dt) {
    this.radius += this.speed * dt;
    this.life -= dt;
    if (this.life <= 0 || this.radius > 800) {
      this.active = false;
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = `rgba(0, 243, 255, ${Math.min(1.0, this.life)})`;
    ctx.lineWidth = this.width;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00f3ff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export class VoidSingularity extends Boss {
  constructor(cx, cy) {
    super(cx, cy, 'THE VOID SINGULARITY', '#00f3ff'); // Neon cyan / dark hole
    
    // Gravity shield configuration (Anti-Spam)
    // Damage only registers if player.chargePercent >= 0.95
    
    // Orbit warping gravity well
    this.gravityActive = false;
    this.gravityStrength = 25; // Gentle pull force in pixels/sec
    this.rippleTimer = 0;
    
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
      'EVENT_HORIZON_SPIRAL', 'RECOVERY',
      'GRAVITY_WELL', 'RECOVERY'
    ];
    
    this.phase2Sequence = [
      'SINGULARITY_LASER', 'RECOVERY',
      'WORMHOLES', 'RECOVERY',
      'COMBINED_GRAVITY_SPIRAL', 'RECOVERY',
      'EVENT_HORIZON_SPIRAL', 'RECOVERY',
      'SINGULARITY_LASER', 'RECOVERY'
    ];
    
    this.phase3Sequence = [
      'WOW_BIG_BANG', 'RECOVERY',
      'GRAVITY_PULSAR', 'RECOVERY',
      'SINGULARITY_LASER', 'RECOVERY',
      'COMBINED_GRAVITY_SPIRAL', 'RECOVERY',
      'WORMHOLES', 'RECOVERY'
    ];
    
    this.finalSequence = [];
    
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
    this.singularityLaserActive = false;
    this.laserAngle = 0;
    this.gravityPulsarActive = false;
    this.pulsarTimer = 0;
    this.warpX = 0;
    this.warpY = 0;
    
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
    if (this.phase === 1 && this.hp <= 66) { // 33% of 200
      this.triggerPhaseTransition(2, 180); // Phase 2 has 180 HP
      this.activeSequence = this.phase2Sequence;
      this.sequenceIndex = 0;
      this.color = '#ff9d00'; // Color turns to active event horizon orange!
    } else if (this.phase === 2 && this.hp <= 54) { // 30% of 180
      this.triggerPhaseTransition(3, 240); // Phase 3 has 240 HP
      this.activeSequence = this.phase3Sequence;
      this.sequenceIndex = 0;
      this.color = '#ff0033'; // Color turns to collapsing void crimson!
    }
  }

  activeAttackCleanup() {
    this.gravityActive = false;
    this.wormholes = [];
    this.singularityLaserActive = false;
    this.gravityPulsarActive = false;
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
    // Process collisions for ripples
    if (player && player.state !== 'DASHING' && player.state !== 'DEAD') {
      for (let b of this.bullets) {
        if (b instanceof GravityRipple) {
          const dist = Math.hypot(player.x - b.x, player.y - b.y);
          if (Math.abs(dist - b.radius) < b.width / 2 + player.radius) {
            player.takeDamage();
          }
        }
      }
    }

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

      case 'SINGULARITY_LASER':
        this.stateTimer = 1.0; // 1s warning
        this.singularityLaserActive = false;
        
        // Target warning line at player angle
        let pAngLaser = 0;
        const playerL = window.gameAppInstance?.player;
        if (playerL) {
          pAngLaser = Math.atan2(playerL.y - this.cy, playerL.x - this.cx);
        }
        this.laserAngle = pAngLaser;
        
        if (banner) {
          banner.textContent = "🌌 VOID BEAM LOCKED 🌌";
          banner.style.color = '#ff0055';
          banner.style.textShadow = '0 0 10px #ff0055';
          banner.classList.add('active');
        }
        break;

      case 'GRAVITY_PULSAR':
        this.stateTimer = 1.0;
        this.gravityPulsarActive = false;
        this.pulsarTimer = 0;
        if (banner) {
          banner.textContent = "🌌 COSMIC PULSAR ACTIVE 🌌";
          banner.style.color = '#ff9d00';
          banner.style.textShadow = '0 0 10px #ff9d00';
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

      case 'SINGULARITY_LASER':
        this.stateTimer = 4.0;
        this.singularityLaserActive = true;
        break;

      case 'GRAVITY_PULSAR':
        this.stateTimer = 5.0;
        this.gravityPulsarActive = true;
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
    } else if (this.targetAttack === 'SINGULARITY_LASER' && this.singularityLaserActive) {
      // Sweep the giant laser beam 360 degrees (Slow and manageable)
      this.laserAngle += 0.8 * dt;
      
      // Collision check
      if (player.state !== 'DEAD') {
        const lx = this.cx + Math.cos(this.laserAngle) * 500;
        const ly = this.cy + Math.sin(this.laserAngle) * 500;
        if (checkCircleLineCollision(player.x, player.y, player.radius, this.cx, this.cy, lx, ly)) {
          player.takeDamage();
        }
      }
    } else if (this.targetAttack === 'GRAVITY_PULSAR' && this.gravityPulsarActive) {
      this.pulsarTimer += dt;
      if (this.pulsarTimer >= 0.8) {
        this.pulsarTimer = 0;
        screenShake.trigger(10, 0.25);
        particles.spawnExplosion(this.cx, this.cy, this.color, 15, 4);
        
        if (player.state !== 'DEAD') {
          const pulseDirection = Math.random() < 0.5 ? 1 : -1;
          player.orbitSpeed += pulseDirection * 0.95;
          player.orbitSpeed = Math.max(-4.5, Math.min(4.5, player.orbitSpeed));
        }
      }
    }
  }

  finishAttack() {
    this.gravityActive = false;
    this.coresActive = false;
    this.cores = [];
    this.isVulnerable = true;
    this.wormholes = [];
    this.singularityLaserActive = false;
    this.gravityPulsarActive = false;
    
    this.state = 'RECOVERY';
    this.stateTimer = this.recoveryDuration;
  }

  updateGravityWell(dt, player) {
    if (!this.gravityActive || this.state !== 'ATTACK') return;
    
    if (this.phase === 1) {
      // Gravity pulls player orbit radius closer!
      if (player && player.state === 'ORBITING') {
        player.orbitRadius = Math.max(120, player.orbitRadius - this.gravityStrength * dt);
      }
    } else {
      // Phase 2 & 3: Gravity spawns expanding ripples that players dash through
      this.rippleTimer -= dt;
      if (this.rippleTimer <= 0) {
        this.rippleTimer = 0.5;
        this.bullets.push(new GravityRipple(this.cx, this.cy));
        audio.playWaveSpawn();
      }
    }
  }

  // Smoothly restore player's orbit radius during recovery/other states
  updateGravityWellRecovery(dt, player) {
    if (player && player.orbitRadius !== player.defaultOrbitRadius) {
      player.orbitRadius = lerp(player.orbitRadius, player.defaultOrbitRadius, 3 * dt);
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
    ctx.strokeStyle = this.phase === 3 ? 'rgba(255, 0, 51, 0.6)' : (this.phase === 2 ? 'rgba(255, 157, 0, 0.6)' : 'rgba(0, 243, 255, 0.6)');
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, dynamicRadius * 0.95, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw Warped Event Horizon accretion disk in Phase 2/3 (Glow warp!)
    if (this.phase >= 2) {
      ctx.save();
      const warpColor = this.phase === 3 ? '#ff0033' : '#ff9d00';
      ctx.strokeStyle = warpColor;
      ctx.lineWidth = 3.5;
      ctx.shadowBlur = 15;
      ctx.shadowColor = warpColor;
      ctx.beginPath();
      ctx.ellipse(this.cx, this.cy, dynamicRadius * 1.5, dynamicRadius * 0.45, Date.now() * 0.002, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Draw Singularity Laser warning / active beam
    if (this.targetAttack === 'SINGULARITY_LASER') {
      ctx.save();
      if (this.state === 'TELEGRAPH') {
        ctx.strokeStyle = 'rgba(255, 0, 85, 0.45)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(this.cx, this.cy);
        ctx.lineTo(this.cx + Math.cos(this.laserAngle) * 500, this.cy + Math.sin(this.laserAngle) * 500);
        ctx.stroke();
      } else if (this.state === 'ATTACK' && this.singularityLaserActive) {
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 12;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff0055';
        ctx.beginPath();
        ctx.moveTo(this.cx, this.cy);
        ctx.lineTo(this.cx + Math.cos(this.laserAngle) * 500, this.cy + Math.sin(this.laserAngle) * 500);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(this.cx, this.cy);
        ctx.lineTo(this.cx + Math.cos(this.laserAngle) * 500, this.cy + Math.sin(this.laserAngle) * 500);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw gravity pulsar shockwave pulses
    if (this.gravityPulsarActive && this.state === 'ATTACK') {
      ctx.save();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = this.color;
      
      const pulseRadius = (Date.now() % 800 / 800) * 240;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    
    ctx.restore();
  }
}
