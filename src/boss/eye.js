/**
 * ==========================================================================
 * ORBITAL BOUND: Boss Rush - Boss 1: The Mechanical Eye
 * ==========================================================================
 */

import { Boss } from './boss.js';
import { lerp, clamp, getDistance, checkCircleLineCollision } from '../utils.js';
import { particles } from '../particle.js';
import { audio } from '../audio.js';

export class MechanicalEye extends Boss {
  constructor(cx, cy) {
    super(cx, cy, 'THE MECHANICAL EYE', '#ff0055');
    
    // Custom Eye visuals
    this.eyelidClose = 0; // 0 = open, 1 = closed
    this.pupilX = 0;
    this.pupilY = 0;
    this.pupilScale = 1.0;
    this.armorPlates = 4; // 4 plates that break
    this.currentLaserAngle = 0;
    this.laserSweepDirection = 1;
    this.laserActive = false;
    this.laserWarning = false;
    
    this.brokenRingActive = false;
    this.brokenRingWarning = false; // Telegraph warning flag
    this.brokenRingAngle = 0;
    this.brokenRingRadius = 0;
    this.brokenRingSpeed = 0.5; // radians per second
    
    this.mines = []; // Orbit mines
    this.minesTimer = 0;
    
    // Sequences - Simplified for beginner tutorial level
    this.phase1Sequence = ['TRIPLE_SHOT', 'RECOVERY'];
    this.phase2Sequence = ['TRIPLE_SHOT', 'RECOVERY', 'LASER_SWEEP', 'RECOVERY'];
    this.finalSequence = ['TRIPLE_SHOT', 'RECOVERY', 'LASER_SWEEP', 'RECOVERY', 'ORBIT_MINES', 'RECOVERY'];
    
    this.maxHp = 150;
    this.hp = 150;
    
    this.activeSequence = this.phase1Sequence;
    this.targetAttack = 'IDLE';
    this.blinkTimer = 2.0;
    this.laserTargetAngle = 0;
    
    this.targetingLines = []; // lines warning for triple shot
    
    this.reset();
  }

  reset() {
    super.reset();
    this.hp = this.maxHp;
    this.eyelidClose = 0;
    this.pupilX = 0;
    this.pupilY = 0;
    this.pupilScale = 1.0;
    this.armorPlates = 4;
    this.currentLaserAngle = 0;
    this.laserSweepDirection = 1;
    this.laserActive = false;
    this.laserWarning = false;
    this.brokenRingActive = false;
    this.brokenRingWarning = false;
    this.mines = [];
    this.targetingLines = [];
    
    this.activeSequence = this.phase1Sequence;
    this.targetAttack = 'IDLE';
    this.state = 'IDLE';
    this.stateTimer = 1.5; // wait 1.5s before first attack
    this.sequenceIndex = 0;
  }

  checkPhaseTransitions() {
    if (this.phase === 1 && this.hp < 70) {
      this.triggerPhaseTransition(2, "ARMOR CRACKED: ENTERING PHASE 2");
      this.activeSequence = this.phase2Sequence;
      this.sequenceIndex = 0;
      this.armorPlates = 2;
    } else if (this.phase === 2 && this.hp < 35) {
      this.triggerPhaseTransition(3, "CRITICAL DETONATION: FINAL PHASE");
      this.activeSequence = this.finalSequence;
      this.sequenceIndex = 0;
      this.armorPlates = 0;
    }
  }

  update(dt, player) {
    super.update(dt, player);
    
    // Idle blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = Math.random() * 3 + 2;
      this.eyelidClose = 1; // trigger blink
    }
    
    // Eyelid smooth return to open
    if (this.state !== 'DEAD' && this.state !== 'TRANSITION' && this.targetAttack !== 'WOW_GAZE_OF_DOOM') {
      this.eyelidClose = lerp(this.eyelidClose, 0, 10 * dt);
    }
    
    // Make pupil track player
    if (player && player.state !== 'DEAD') {
      const angle = Math.atan2(player.y - this.cy, player.x - this.cx);
      const maxOffset = 14;
      const targetPupilX = Math.cos(angle) * maxOffset;
      const targetPupilY = Math.sin(angle) * maxOffset;
      this.pupilX = lerp(this.pupilX, targetPupilX, 6 * dt);
      this.pupilY = lerp(this.pupilY, targetPupilY, 6 * dt);
    }

    // Dynamic warning text banner updating
    const banner = document.getElementById('warning-banner');
    
    if (this.state === 'DEAD') {
      this.eyelidClose = 0.8; // half closed/dying
      this.pupilScale = lerp(this.pupilScale, 0.1, 2 * dt);
      this.stateTimer -= dt;
      return;
    }
    
    if (this.state === 'TRANSITION') {
      this.eyelidClose = lerp(this.eyelidClose, 0.9, 5 * dt); // closed and vibrating
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'IDLE';
        this.isVulnerable = true;
        this.stateTimer = 1.0; // short recovery before starting sequence
      }
      return;
    }
    
    // Update active custom elements
    this.updateBrokenRing(dt, player);
    this.updateMines(dt, player);
    
    // Finite State Machine
    this.stateTimer -= dt;
    
    switch (this.state) {
      case 'IDLE':
        if (this.stateTimer <= 0) {
          // Select next attack from sequence
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
          this.stateTimer = 0.5; // breathing gap before picking next
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
    
    // Play warning sound when getting ready / telegraphing
    if (attack === 'LASER_SWEEP' || attack === 'TRIPLE_SHOT' || attack === 'BROKEN_RING' || attack === 'ORBIT_MINES' || attack === 'COMBINED_LASER_MINES' || attack === 'WOW_GAZE_OF_DOOM') {
      audio.playWarningBeep();
    }
    
    switch (attack) {
      case 'LASER_SWEEP':
        this.stateTimer = 1.0; // 1s warning
        this.laserWarning = true;
        this.laserActive = false;
        // Lock initial sweep target
        this.currentLaserAngle = Math.atan2(this.pupilY, this.pupilX);
        this.laserSweepDirection = Math.random() < 0.5 ? 1 : -1;
        
        if (banner) {
          banner.textContent = "LASER SWEEP INCOMING";
          banner.style.color = '#ff0055';
          banner.style.textShadow = '0 0 10px #ff0055';
          banner.classList.add('active');
        }
        break;
        
      case 'TRIPLE_SHOT':
        this.stateTimer = 0.8; // 0.8s warning
        this.targetingLines = [];
        if (banner) {
          banner.textContent = "TRIPLE TARGET LOCK";
          banner.style.color = '#ff9d00';
          banner.style.textShadow = '0 0 10px #ff9d00';
          banner.classList.add('active');
        }
        break;
        
      case 'BROKEN_RING':
        this.stateTimer = 1.0;
        this.brokenRingWarning = true; // Show telegraph warning early!
        this.brokenRingActive = false; // Not solid yet
        this.brokenRingRadius = 0; // Starts at center
        this.brokenRingAngle = Math.random() * Math.PI * 2; // Random rotation start
        this.brokenRingSpeed = Math.random() < 0.5 ? 0.4 : -0.4;
        if (banner) {
          banner.textContent = "RING DEPLOYMENT";
          banner.style.color = '#00f3ff';
          banner.style.textShadow = '0 0 10px #00f3ff';
          banner.classList.add('active');
        }
        break;
        
      case 'ORBIT_MINES':
        this.stateTimer = 0.8;
        if (banner) {
          banner.textContent = "ORBIT MINES DETECTED";
          banner.style.color = '#ff9d00';
          banner.style.textShadow = '0 0 10px #ff9d00';
          banner.classList.add('active');
        }
        break;
        
      case 'COMBINED_LASER_MINES':
        this.stateTimer = 1.0;
        this.laserWarning = true;
        this.currentLaserAngle = Math.random() * Math.PI * 2;
        this.laserSweepDirection = Math.random() < 0.5 ? 0.8 : -0.8;
        this.spawnOrbitMines(2); // Spawns 2 mines instantly
        if (banner) {
          banner.textContent = "CRITICAL HAZARD OVERLOAD";
          banner.style.color = '#ff00ff';
          banner.style.textShadow = '0 0 10px #ff00ff';
          banner.classList.add('active');
        }
        break;
        
      case 'COMBINED_MINES_RING':
        this.stateTimer = 0.8;
        this.spawnOrbitMines(2);
        this.brokenRingWarning = true; // Show telegraph warning early!
        this.brokenRingActive = false;
        this.brokenRingRadius = 0;
        this.brokenRingAngle = Math.random() * Math.PI * 2;
        this.brokenRingSpeed = 0.5;
        if (banner) {
          banner.textContent = "BARRIER SYSTEM INITIATED";
          banner.style.color = '#ff00ff';
          banner.style.textShadow = '0 0 10px #ff00ff';
          banner.classList.add('active');
        }
        break;

      case 'WOW_GAZE_OF_DOOM':
        this.stateTimer = 1.5; // Long visual warning
        this.eyelidClose = 1.0; // Close completely
        if (banner) {
          banner.textContent = "⚠️ GAZE OF DOOM: FIND SHELTER ⚠️";
          banner.style.color = '#ff0000';
          banner.style.textShadow = '0 0 15px #ff0000';
          banner.classList.add('active');
        }
        break;
    }
  }

  launchAttack() {
    this.state = 'ATTACK';
    
    // Hide warning banner
    const banner = document.getElementById('warning-banner');
    if (banner) banner.classList.remove('active');
    
    if (this.targetAttack === 'LASER_SWEEP' || this.targetAttack === 'COMBINED_LASER_MINES' || this.targetAttack === 'WOW_GAZE_OF_DOOM') {
      audio.playLaserStart();
    }
    
    switch (this.targetAttack) {
      case 'LASER_SWEEP':
        this.stateTimer = 2.0; // Sweep for 2s
        this.laserWarning = false;
        this.laserActive = true;
        break;
        
      case 'TRIPLE_SHOT':
        this.stateTimer = 0.2; // Quick fire state
        // Lock targets based on pupil direction (pointing at player)
        const baseAngle = Math.atan2(this.pupilY, this.pupilX);
        const offsets = [-0.25, 0, 0.25]; // Spaced targeting
        offsets.forEach(offset => {
          const angle = baseAngle + offset;
          // Shoot slow large orange bullets
          const speed = 2.2;
          const vx = Math.cos(angle) * speed;
          const vy = Math.sin(angle) * speed;
          this.spawnBullet(this.cx, this.cy, vx, vy, 12, '#ff9d00');
        });
        break;
        
      case 'BROKEN_RING':
        this.stateTimer = 4.0; // Ring active for 4s
        this.brokenRingWarning = false;
        this.brokenRingActive = true;
        break;
        
      case 'ORBIT_MINES':
        this.stateTimer = 0.2;
        this.spawnOrbitMines(3);
        break;
        
      case 'COMBINED_LASER_MINES':
        this.stateTimer = 2.0;
        this.laserWarning = false;
        this.laserActive = true;
        break;
        
      case 'COMBINED_MINES_RING':
        this.stateTimer = 4.0;
        this.brokenRingWarning = false;
        this.brokenRingActive = true;
        break;

      case 'WOW_GAZE_OF_DOOM':
        this.stateTimer = 2.0; // Fire colossal laser for 2s
        this.eyelidClose = 0; // Snap open
        this.pupilScale = 2.2; // Massive pupil
        this.laserActive = true;
        this.laserWarning = false;
        // Colossal laser targets half orbit
        this.currentLaserAngle = Math.atan2(this.pupilY, this.pupilX);
        break;
    }
  }

  processAttack(dt, player) {
    switch (this.targetAttack) {
      case 'LASER_SWEEP':
      case 'COMBINED_LASER_MINES':
        // Slow rotation of laser
        // Sweep only 90 degrees total: 45 degrees CW/CCW per sec
        this.currentLaserAngle += this.laserSweepDirection * 0.8 * dt;
        
        // Laser collision
        if (player.state !== 'DEAD') {
          const laserLength = 500;
          const lx2 = this.cx + Math.cos(this.currentLaserAngle) * laserLength;
          const ly2 = this.cy + Math.sin(this.currentLaserAngle) * laserLength;
          
          if (checkCircleLineCollision(player.x, player.y, player.radius, this.cx, this.cy, lx2, ly2)) {
            player.takeDamage();
          }
        }
        break;

      case 'WOW_GAZE_OF_DOOM':
        // Giant colossal laser (width of 180 degrees!)
        // Does not sweep, just blazes in the direction of the player
        if (player.state !== 'DEAD') {
          const angleToPlayer = Math.atan2(player.y - this.cy, player.x - this.cx);
          const diff = Math.abs(angleToPlayer - this.currentLaserAngle);
          
          // Normalize angle difference to [0, PI]
          let normDiff = diff % (Math.PI * 2);
          if (normDiff > Math.PI) normDiff = Math.PI * 2 - normDiff;
          
          // If within 90 degrees (half circle), player is hit!
          if (normDiff < Math.PI / 2) {
            player.takeDamage();
          }
        }
        break;
    }
  }

  finishAttack() {
    audio.playLaserStop();
    this.laserActive = false;
    this.laserWarning = false;
    this.brokenRingActive = false;
    this.brokenRingWarning = false;
    this.pupilScale = 1.0;
    this.eyelidClose = 0;
    
    this.state = 'RECOVERY';
    this.stateTimer = this.recoveryDuration;
    
    // Hide warning banner in case it got stuck
    const banner = document.getElementById('warning-banner');
    if (banner) banner.classList.remove('active');
  }

  spawnOrbitMines(count) {
    // Spawns mines at player orbit path (radius = 220)
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.mines.push({
        x: this.cx + Math.cos(angle) * 220,
        y: this.cy + Math.sin(angle) * 220,
        radius: 12,
        life: 8.0, // Detonates after 8s
        blink: 0,
        color: '#ff9d00'
      });
    }
  }

  updateBrokenRing(dt, player) {
    if (!this.brokenRingActive) return;
    
    // Ring slowly expands from center out to the orbit radius (220)
    this.brokenRingRadius = lerp(this.brokenRingRadius, 220, 4 * dt);
    
    // Rotate ring
    this.brokenRingAngle += this.brokenRingSpeed * dt;
    
    // Check collision if ring has reached player orbit
    if (this.brokenRingRadius > 190 && player.state !== 'DEAD' && this.state === 'ATTACK') {
      const dist = getDistance(this.cx, this.cy, player.x, player.y);
      // Ring boundary checks (margin of 15px thickness)
      if (Math.abs(dist - this.brokenRingRadius) < 15) {
        const playerAngle = Math.atan2(player.y - this.cy, player.x - this.cx);
        const relativeAngle = (playerAngle - this.brokenRingAngle) % (Math.PI * 2);
        
        // Find if player is in the 60 degree safe slice
        // Normalize relative angle to [-PI, PI]
        let diff = relativeAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        // If angle difference is greater than 30 degrees (0.52 radians), hit!
        if (Math.abs(diff) > 0.52) {
          player.takeDamage();
        }
      }
    }
  }

  updateMines(dt, player) {
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      m.life -= dt;
      m.blink += dt * 6;
      
      // Detonation blink color shift
      m.color = Math.floor(m.blink) % 2 === 0 ? '#ff0055' : '#ff9d00';
      
      // Collision with player
      if (player.state !== 'DEAD') {
        const dist = getDistance(m.x, m.y, player.x, player.y);
        if (dist < m.radius + player.radius) {
          player.takeDamage();
          m.life = 0; // force delete
          particles.spawnExplosion(m.x, m.y, '#ff0055', 15, 5);
        }
      }
      
      if (m.life <= 0) {
        // Safe fade-out/detonation sparkles
        particles.spawnExplosion(m.x, m.y, '#ff9d00', 6, 2);
        this.mines.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    super.draw(ctx);
    
    // Draw orbit mines
    this.mines.forEach(m => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      ctx.fillStyle = m.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = m.color;
      ctx.fill();
      
      // Core glowing dot
      ctx.beginPath();
      ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.restore();
    });

    // Draw broken ring (or telegraph warning)
    if (this.brokenRingActive || this.brokenRingWarning) {
      ctx.save();
      const radius = this.brokenRingWarning ? 220 : this.brokenRingRadius;
      ctx.strokeStyle = this.brokenRingWarning ? 'rgba(255, 157, 0, 0.55)' : '#00f3ff';
      ctx.lineWidth = this.brokenRingWarning ? 4 : 10;
      ctx.shadowBlur = this.brokenRingWarning ? 8 : 15;
      ctx.shadowColor = this.brokenRingWarning ? '#ff9d00' : '#00f3ff';
      if (this.brokenRingWarning) {
        ctx.setLineDash([5, 8]);
      }
      
      // Draw ring with 60-degree gap (1.04 radians)
      ctx.beginPath();
      const gapHalfAngle = 0.52;
      const startAngle = this.brokenRingAngle + gapHalfAngle;
      const endAngle = this.brokenRingAngle + (Math.PI * 2) - gapHalfAngle;
      
      ctx.arc(this.cx, this.cy, radius, startAngle, endAngle);
      ctx.stroke();
      
      // Draw glowing end nodes on the ring edges
      ctx.fillStyle = this.brokenRingWarning ? '#ff9d00' : '#ffffff';
      ctx.beginPath();
      ctx.arc(this.cx + Math.cos(startAngle) * radius, this.cy + Math.sin(startAngle) * radius, this.brokenRingWarning ? 5 : 8, 0, Math.PI * 2);
      ctx.arc(this.cx + Math.cos(endAngle) * radius, this.cy + Math.sin(endAngle) * radius, this.brokenRingWarning ? 5 : 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    
    // Draw targeting lines (for triple shot)
    if (this.state === 'TELEGRAPH' && this.targetAttack === 'TRIPLE_SHOT') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 157, 0, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#ff9d00';
      
      const baseAngle = Math.atan2(this.pupilY, this.pupilX);
      const offsets = [-0.25, 0, 0.25];
      
      offsets.forEach(offset => {
        const angle = baseAngle + offset;
        ctx.beginPath();
        ctx.moveTo(this.cx, this.cy);
        ctx.lineTo(this.cx + Math.cos(angle) * 450, this.cy + Math.sin(angle) * 450);
        ctx.stroke();
      });
      ctx.restore();
    }
    
    // Draw regular laser warnings
    if (this.laserWarning && this.targetAttack !== 'WOW_GAZE_OF_DOOM') {
      ctx.save();
      
      // Draw a wide translucent warning beam zone (width matching the active laser)
      ctx.strokeStyle = 'rgba(255, 0, 85, 0.15)';
      ctx.lineWidth = 24.0;
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.lineTo(this.cx + Math.cos(this.currentLaserAngle) * 500, this.cy + Math.sin(this.currentLaserAngle) * 500);
      ctx.stroke();
      
      // Draw a highly visible flashing/pulsing center guideline
      const pulseOpacity = 0.5 + Math.sin(Date.now() / 60) * 0.35;
      ctx.strokeStyle = `rgba(255, 0, 85, ${pulseOpacity})`;
      ctx.lineWidth = 3.5;
      ctx.setLineDash([10, 6]); // Dotted line
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.lineTo(this.cx + Math.cos(this.currentLaserAngle) * 500, this.cy + Math.sin(this.currentLaserAngle) * 500);
      ctx.stroke();
      
      ctx.restore();
    }
    
    // Draw Laser sweep / Colossal Laser
    if (this.laserActive) {
      ctx.save();
      ctx.shadowBlur = 20;
      
      if (this.targetAttack === 'WOW_GAZE_OF_DOOM') {
        // Draw giant colossal half-circle wedge
        ctx.fillStyle = 'rgba(255, 0, 85, 0.25)';
        ctx.beginPath();
        ctx.moveTo(this.cx, this.cy);
        ctx.arc(this.cx, this.cy, 500, this.currentLaserAngle - Math.PI / 2, this.currentLaserAngle + Math.PI / 2);
        ctx.closePath();
        ctx.fill();
        
        // Massive energy outlines
        ctx.strokeStyle = '#ff0055';
        ctx.lineWidth = 8;
        ctx.shadowColor = '#ff0055';
        ctx.beginPath();
        ctx.moveTo(this.cx, this.cy);
        ctx.lineTo(this.cx + Math.cos(this.currentLaserAngle - Math.PI/2) * 500, this.cy + Math.sin(this.currentLaserAngle - Math.PI/2) * 500);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(this.cx, this.cy);
        ctx.lineTo(this.cx + Math.cos(this.currentLaserAngle + Math.PI/2) * 500, this.cy + Math.sin(this.currentLaserAngle + Math.PI/2) * 500);
        ctx.stroke();
      } else {
        // Standard Laser Sweep line
        ctx.strokeStyle = '#ff0055';
        ctx.shadowColor = '#ff0055';
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(this.cx, this.cy);
        ctx.lineTo(this.cx + Math.cos(this.currentLaserAngle) * 500, this.cy + Math.sin(this.currentLaserAngle) * 500);
        ctx.stroke();
        
        // Inner white hot core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(this.cx, this.cy);
        ctx.lineTo(this.cx + Math.cos(this.currentLaserAngle) * 500, this.cy + Math.sin(this.currentLaserAngle) * 500);
        ctx.stroke();
      }
      ctx.restore();
    }
    
    // --- Draw Main Mechanical Eye ---
    ctx.save();
    
    // Pulse sizes with music beat
    const dynamicRadius = this.radius * this.visualScale;
    
    // Apply shake offset if transition/hit
    if (this.hitFlashTimer > 0) {
      ctx.translate((Math.random() * 2 - 1) * 3, (Math.random() * 2 - 1) * 3);
    }
    
    // Draw Outer Armor Plates (cracking system)
    ctx.strokeStyle = '#3a4055';
    ctx.lineWidth = 6;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#000000';
    
    // Armor counts: Phase 1 = 4 plates, Phase 2 = 2 plates, Phase 3 = 0 plates
    for (let i = 0; i < this.armorPlates; i++) {
      ctx.beginPath();
      // Draw segmented arc around the eye
      const segmentAngle = (Math.PI * 2) / 4;
      const startAngle = i * segmentAngle + 0.15;
      const endAngle = (i + 1) * segmentAngle - 0.15;
      ctx.arc(this.cx, this.cy, dynamicRadius + 15, startAngle, endAngle);
      ctx.stroke();
    }
    
    // White flash on hit
    if (this.hitFlashTimer > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, dynamicRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    
    // Draw Main Sclera (White eye background)
    ctx.fillStyle = this.phase === 3 ? '#30020d' : '#0d1017';
    ctx.strokeStyle = this.phase === 3 ? '#ff0000' : '#ff0055';
    ctx.lineWidth = 4;
    ctx.shadowBlur = dynamicRadius * 0.5;
    ctx.shadowColor = this.color;
    
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, dynamicRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Draw Iris (Glowing red ring)
    ctx.save();
    ctx.translate(this.cx + this.pupilX, this.cy + this.pupilY);
    ctx.fillStyle = this.phase === 3 ? '#ff0000' : '#ff3b30';
    ctx.beginPath();
    ctx.arc(0, 0, dynamicRadius * 0.45 * this.pupilScale, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw Pupil (Black center core)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(0, 0, dynamicRadius * 0.22 * this.pupilScale, 0, Math.PI * 2);
    ctx.fill();
    
    // Pupil reflection dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-dynamicRadius * 0.08, -dynamicRadius * 0.08, dynamicRadius * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    // Draw Eyelid (Closes on blink/charge)
    if (this.eyelidClose > 0.01) {
      ctx.fillStyle = '#1e2230';
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 3;
      
      // Upper lid arc
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, dynamicRadius + 1, Math.PI, 0, false);
      // Close to the middle line
      ctx.lineTo(this.cx + dynamicRadius, this.cy + (dynamicRadius * (this.eyelidClose - 0.5) * 2));
      ctx.arcTo(this.cx, this.cy + (dynamicRadius * (this.eyelidClose - 0.5) * 2), this.cx - dynamicRadius, this.cy + (dynamicRadius * (this.eyelidClose - 0.5) * 2), dynamicRadius);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Lower lid arc
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, dynamicRadius + 1, 0, Math.PI, false);
      ctx.lineTo(this.cx - dynamicRadius, this.cy - (dynamicRadius * (this.eyelidClose - 0.5) * 2));
      ctx.arcTo(this.cx, this.cy - (dynamicRadius * (this.eyelidClose - 0.5) * 2), this.cx + dynamicRadius, this.cy - (dynamicRadius * (this.eyelidClose - 0.5) * 2), dynamicRadius);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    
    ctx.restore();
  }
}
