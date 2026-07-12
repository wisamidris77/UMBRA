/**
 * ==========================================================================
 * ORBITAL BOUND: Boss Rush - Boss 7: The Alchemical Cauldron (Mixer Shield)
 * ==========================================================================
 */

import { Boss } from './boss.js';
import { lerp, clamp, getDistance } from '../utils.js';
import { particles, screenShake } from '../particle.js';
import { audio } from '../audio.js';

export class AlchemicalCauldron extends Boss {
  constructor(cx, cy) {
    super(cx, cy, 'THE ALCHEMICAL CAULDRON', '#39ff14'); // Glowing green fluid
    
    // Shield configuration (Anti-Spam Mixer Paddle)
    this.paddleAngle = 0;
    this.paddleSpeed = 1.6; // rotating shield bar
    this.paddleLength = 70;
    
    // Cauldron state
    this.fluidColor = '#39ff14'; // starts green
    this.bubbles = [];
    
    // Acid pools on orbit path
    this.acidPools = [];
    
    // Chemical vapor clouds
    this.vaporActive = false;
    this.vaporProgress = 0;
    
    // Inner safety ring (WOW meltdown)
    this.meltdownActive = false;
    this.safetyRadius = 80;
    
    // Sequences
    this.phase1Sequence = [
      'ACID_SPLASH', 'RECOVERY',
      'CHEMICAL_VAPOR', 'RECOVERY',
      'ACID_SPLASH', 'RECOVERY',
      'CHEMICAL_VAPOR', 'RECOVERY'
    ];
    
    this.phase2Sequence = [
      'COLOR_SYNTHESIS', 'RECOVERY',
      'TOXIC_GEYSER', 'RECOVERY',
      'COMBINED_VAPOR_ACID', 'RECOVERY',
      'ACID_SPLASH', 'RECOVERY',
      'COLOR_SYNTHESIS', 'RECOVERY'
    ];
    
    this.phase3Sequence = [
      'WOW_CORE_MELTDOWN', 'RECOVERY',
      'PLASMA_ERUPTION', 'RECOVERY',
      'TOXIC_GEYSER', 'RECOVERY',
      'COMBINED_VAPOR_ACID', 'RECOVERY',
      'COLOR_SYNTHESIS', 'RECOVERY'
    ];
    
    this.finalSequence = [];
    
    this.maxHp = 220;
    this.hp = 220;
    
    this.activeSequence = this.phase1Sequence;
    this.targetAttack = 'IDLE';
    this.recoveryDuration = 2.0;
    
    this.reset();
  }

  reset() {
    super.reset();
    this.paddleAngle = 0;
    this.paddleSpeed = 1.6;
    this.fluidColor = '#39ff14'; // neon green plasma boil
    this.bubbles = [];
    this.acidPools = [];
    this.vaporActive = false;
    this.vaporProgress = 0;
    this.meltdownActive = false;
    this.toxicGeysers = [];
    this.plasmaEruptions = [];
    this.sloshX = 0;
    this.sloshY = 0;
    
    this.activeSequence = this.phase1Sequence;
    this.targetAttack = 'IDLE';
    this.state = 'IDLE';
    this.stateTimer = 1.5;
    this.sequenceIndex = 0;
  }

  takeDamage(amount) {
    super.takeDamage(amount);
  }

  checkPhaseTransitions() {
    if (this.phase === 1 && this.hp <= 73) { // 33% of 220
      this.triggerPhaseTransition(2, 180); // Phase 2 has 180 HP
      this.activeSequence = this.phase2Sequence;
      this.sequenceIndex = 0;
      this.paddleSpeed = 2.4; // spin paddles faster!
      this.fluidColor = '#ff00ff'; // change fluid color to magenta!
    } else if (this.phase === 2 && this.hp <= 54) { // 30% of 180
      this.triggerPhaseTransition(3, 280); // Phase 3 has 280 HP
      this.activeSequence = this.phase3Sequence;
      this.sequenceIndex = 0;
      this.paddleSpeed = 3.6; // spin paddles at MAXIMUM velocity!
      this.fluidColor = '#ff0033'; // change fluid color to neon orange-crimson!
    }
  }

  activeAttackCleanup() {
    this.acidPools = [];
    this.vaporActive = false;
    this.meltdownActive = false;
    this.toxicGeysers = [];
    this.plasmaEruptions = [];
    const banner = document.getElementById('warning-banner');
    if (banner) banner.classList.remove('active');
  }

  update(dt, player) {
    // Alchemical fluid sloshes towards the player
    const dx = player.x - this.cx;
    const dy = player.y - this.cy;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) {
      this.sloshX = lerp(this.sloshX || 0, (dx / dist) * 7, 4 * dt);
      this.sloshY = lerp(this.sloshY || 0, (dy / dist) * 7, 4 * dt);
    } else {
      this.sloshX = 0;
      this.sloshY = 0;
    }
    
    super.update(dt, player);
    
    // Rotate mixer paddle
    this.paddleAngle += this.paddleSpeed * dt;
    
    // Bubbles rising inside cauldron
    if (Math.random() < 0.25) {
      this.bubbles.push({
        x: this.cx + (Math.random() * 50 - 25),
        y: this.cy + (Math.random() * 50 - 25),
        vy: -20 - Math.random() * 20,
        radius: 2 + Math.random() * 4,
        life: 1.0
      });
    }
    
    // Update bubbles life
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) {
        this.bubbles.splice(i, 1);
      }
    }
    
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
    
    // Update subprojectiles
    this.updateAcidPools(dt, player);
    this.updateVapor(dt, player);
    this.updateMeltdown(dt, player);
    this.updateToxicGeysers(dt, player);
    this.updatePlasmaEruptions(dt, player);
    
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
      case 'ACID_SPLASH':
        this.stateTimer = 1.0;
        if (banner) {
          banner.textContent = "ACID SPLASH LOCK";
          banner.style.color = '#39ff14';
          banner.style.textShadow = '0 0 10px #39ff14';
          banner.classList.add('active');
        }
        break;
        
      case 'CHEMICAL_VAPOR':
        this.stateTimer = 1.0;
        this.vaporActive = true;
        this.vaporProgress = 0;
        if (banner) {
          banner.textContent = "EXPANDING NEON VAPOR CLOUD";
          banner.style.color = '#ff00ff';
          banner.style.textShadow = '0 0 10px #ff00ff';
          banner.classList.add('active');
        }
        break;
        
      case 'COLOR_SYNTHESIS':
        this.stateTimer = 0.8;
        // Cauldron shifts color to indicate rapid elemental bullets
        this.fluidColor = '#ff3c00'; // red/orange
        if (banner) {
          banner.textContent = "ELEMENTAL SYNTHESIS";
          banner.style.color = '#ff9d00';
          banner.style.textShadow = '0 0 10px #ff9d00';
          banner.classList.add('active');
        }
        break;
        
      case 'COMBINED_VAPOR_ACID':
        this.stateTimer = 1.0;
        this.vaporActive = true;
        this.vaporProgress = 0;
        if (banner) {
          banner.textContent = "ALCHEMICAL CORROSION GRID";
          banner.style.color = '#ff00ff';
          banner.style.textShadow = '0 0 10px #ff00ff';
          banner.classList.add('active');
        }
        break;

      case 'WOW_CORE_MELTDOWN':
        this.stateTimer = 1.5;
        this.meltdownActive = true;
        this.fluidColor = '#ff00ff'; // radioactive purple
        if (banner) {
          banner.textContent = "⚠️ CORE MELTDOWN: RETREAT INWARD ⚠️";
          banner.style.color = '#ff00ff';
          banner.style.textShadow = '0 0 15px #ff00ff';
          banner.classList.add('active');
        }
        break;

      case 'TOXIC_GEYSER':
        this.stateTimer = 1.2; // warning
        this.toxicGeysers = [];
        // Spawn 4 geyser targets along the player orbit (radius = 220)
        for (let i = 0; i < 4; i++) {
          const angle = (Math.PI / 2) * i + Math.random() * 0.4;
          this.toxicGeysers.push({
            angle: angle,
            x: this.cx + Math.cos(angle) * 220,
            y: this.cy + Math.sin(angle) * 220,
            active: false,
            radius: 35
          });
        }
        if (banner) {
          banner.textContent = "☣️ TOXIC GEYSER ERUPTION LOCK ☣️";
          banner.style.color = '#39ff14';
          banner.style.textShadow = '0 0 10px #39ff14';
          banner.classList.add('active');
        }
        break;

      case 'PLASMA_ERUPTION':
        this.stateTimer = 1.0;
        this.plasmaEruptions = [];
        if (banner) {
          banner.textContent = "☣️ THERMAL PLASMA ERUPTION ☣️";
          banner.style.color = '#ff3300';
          banner.style.textShadow = '0 0 10px #ff3300';
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
      case 'ACID_SPLASH':
        this.stateTimer = 3.5;
        this.spawnAcidPools(3);
        break;
        
      case 'CHEMICAL_VAPOR':
        this.stateTimer = 4.0;
        break;
        
      case 'COLOR_SYNTHESIS':
        this.stateTimer = 3.0;
        this.spawnSynthesisWave();
        break;
        
      case 'COMBINED_VAPOR_ACID':
        this.stateTimer = 4.0;
        this.spawnAcidPools(2);
        break;
        
      case 'WOW_CORE_MELTDOWN':
        this.stateTimer = 5.0; // Melt down lasts 5 seconds
        break;

      case 'TOXIC_GEYSER':
        this.stateTimer = 4.0;
        this.toxicGeysers.forEach(tg => tg.active = true);
        break;

      case 'PLASMA_ERUPTION':
        this.stateTimer = 4.0;
        break;
    }
  }

  finishAttack() {
    this.activeAttackCleanup();
    this.fluidColor = this.phase === 3 ? '#ff0033' : (this.phase === 2 ? '#ff00ff' : '#39ff14');
    this.state = 'RECOVERY';
    this.stateTimer = this.recoveryDuration;
  }

  spawnAcidPools(count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.acidPools.push({
        x: this.cx + Math.cos(angle) * 220,
        y: this.cy + Math.sin(angle) * 220,
        radius: 20,
        life: 5.0,
        color: '#39ff14'
      });
    }
  }

  updateAcidPools(dt, player) {
    for (let i = this.acidPools.length - 1; i >= 0; i--) {
      const p = this.acidPools[i];
      p.life -= dt;
      
      // Collision with player
      if (player.state !== 'DEAD') {
        const dist = getDistance(p.x, p.y, player.x, player.y);
        if (dist < p.radius + player.radius) {
          player.takeDamage();
        }
      }
      
      if (p.life <= 0) {
        this.acidPools.splice(i, 1);
      }
    }
  }

  updateVapor(dt, player) {
    if (!this.vaporActive || this.state !== 'ATTACK') return;
    
    // Vapor expands from center outward
    this.vaporProgress = lerp(this.vaporProgress, 1.0, 0.8 * dt);
    const maxVaporRadius = 140;
    const currentRadius = this.vaporProgress * maxVaporRadius;
    
    // Collision checking: deals damage if player gets too close to center
    if (player.state !== 'DEAD') {
      const dist = getDistance(this.cx, this.cy, player.x, player.y);
      if (dist < currentRadius + player.radius) {
        player.takeDamage();
      }
    }
  }

  spawnSynthesisWave() {
    let pAngle = 0;
    const pEl = window.gameAppInstance?.player;
    if (pEl) {
      pAngle = Math.atan2(pEl.y - this.cy, pEl.x - this.cx);
    }
    
    // Fire orange bullets crossing center, aligned with the player
    for (let i = 0; i < 8; i++) {
      const angle = pAngle + (Math.PI / 4) * i;
      const speed = 2.2;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      this.spawnBullet(this.cx, this.cy, vx, vy, 10, '#ff9d00');
    }
  }

  updateMeltdown(dt, player) {
    if (!this.meltdownActive || this.state !== 'ATTACK') return;
    
    // Radioactive outer meltdown: deals constant damage unless player is inside safety radius!
    // Player MUST orbit close to cauldron
    if (player.state !== 'DEAD' && Math.floor(Date.now() / 150) % 5 === 0) {
      const dist = getDistance(this.cx, this.cy, player.x, player.y);
      
      // If player is outside safety radius (safetyRadius = 80, player normal orbit is 220)
      // So player MUST dash in and stay near the center!
      if (dist > this.safetyRadius + player.radius + 15) {
        player.takeDamage();
      }
    }
  }

  draw(ctx) {
    super.draw(ctx);
    
    // Draw Toxic Geysers
    if (this.toxicGeysers && this.toxicGeysers.length > 0) {
      this.toxicGeysers.forEach(tg => {
        ctx.save();
        if (tg.active && this.state === 'ATTACK') {
          // Geyser erupts!
          const pulse = 1.0 + Math.sin(Date.now() * 0.02) * 0.15;
          const grad = ctx.createRadialGradient(tg.x, tg.y, 5, tg.x, tg.y, tg.radius * pulse);
          grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
          grad.addColorStop(0.3, 'rgba(57, 255, 20, 0.65)');
          grad.addColorStop(1, 'rgba(57, 255, 20, 0)');
          
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(tg.x, tg.y, tg.radius * pulse, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Warning circle
          ctx.strokeStyle = 'rgba(57, 255, 20, 0.45)';
          ctx.lineWidth = 2.5;
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#39ff14';
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.arc(tg.x, tg.y, tg.radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      });
    }
    
    // Draw Acid pools
    this.acidPools.forEach(p => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(57, 255, 20, 0.45)';
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#39ff14';
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
    
    // Draw Chemical Vapor expanding cloud
    if (this.vaporActive) {
      ctx.save();
      const currentRadius = this.vaporProgress * 140;
      ctx.fillStyle = 'rgba(255, 0, 255, 0.12)';
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ff00ff';
      
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, currentRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    
    // Draw Meltdown outer red danger zone
    if (this.meltdownActive) {
      ctx.save();
      
      // Paint danger outside safety circle
      ctx.fillStyle = 'rgba(255, 0, 85, 0.15)';
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, 500, 0, Math.PI * 2);
      ctx.arc(this.cx, this.cy, this.safetyRadius, 0, Math.PI * 2, true); // hole cut out
      ctx.fill();
      
      // Draw safety boundary circle
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#39ff14';
      
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, this.safetyRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    
    // --- Draw Mixer Paddle Shield (Mixer blade) ---
    if (this.state !== 'DEAD' && this.state !== 'TRANSITION') {
      ctx.save();
      // Translate to align with the cauldron's slosh tracking
      ctx.translate(this.sloshX || 0, this.sloshY || 0);
      
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 6;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#39ff14';
      
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.lineTo(this.cx + Math.cos(this.paddleAngle) * this.paddleLength, this.cy + Math.sin(this.paddleAngle) * this.paddleLength);
      ctx.stroke();
      
      // Node caps
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.cx + Math.cos(this.paddleAngle) * this.paddleLength, this.cy + Math.sin(this.paddleAngle) * this.paddleLength, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    
    // --- Draw Main Cauldron Core ---
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
    
    // Slosh/shift dynamically towards player
    ctx.translate(this.sloshX || 0, this.sloshY || 0);
    
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
    
    // Cauldron outer rim/structure
    ctx.fillStyle = '#0f1710';
    ctx.strokeStyle = this.fluidColor;
    ctx.lineWidth = 5;
    ctx.shadowBlur = dynamicRadius * 0.5;
    ctx.shadowColor = this.fluidColor;
    
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, dynamicRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Draw bubbling fluid level inside
    ctx.fillStyle = this.fluidColor;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, Math.max(0.1, dynamicRadius - 6), 0, Math.PI * 2);
    ctx.fill();
    
    // Draw bubbles
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#ffffff';
    this.bubbles.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    
    ctx.restore();
  }

  updateToxicGeysers(dt, player) {
    if (this.state !== 'ATTACK') return;
    this.toxicGeysers.forEach(tg => {
      if (tg.active && player.state !== 'DEAD') {
        const dist = getDistance(tg.x, tg.y, player.x, player.y);
        if (dist < tg.radius + player.radius) {
          player.takeDamage();
        }
      }
    });
  }

  updatePlasmaEruptions(dt, player) {
    if (this.targetAttack !== 'PLASMA_ERUPTION' || this.state !== 'ATTACK') return;
    
    this.plasmaTimer = (this.plasmaTimer || 0) + dt;
    if (this.plasmaTimer >= 0.58) {
      this.plasmaTimer = 0;
      let pAngle = 0;
      if (player) {
        pAngle = Math.atan2(player.y - this.cy, player.x - this.cx);
      }
      // Fire concentric ring of 6 plasma fireballs pointing at player
      for (let i = 0; i < 6; i++) {
        const angle = pAngle + (Math.PI * 2 / 6) * i;
        const speed = 2.45;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        this.spawnBullet(this.cx, this.cy, vx, vy, 8, '#ff3300');
      }
      audio.playBossShoot();
    }
  }
}
