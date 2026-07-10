/**
 * ==========================================================================
 * ORBITAL BOUND: Boss Rush - Boss 5: The Shadow Weaver (Spider Cage Shield)
 * ==========================================================================
 */

import { Boss } from './boss.js';
import { lerp, clamp, getDistance, checkCircleLineCollision } from '../utils.js';
import { particles, screenShake } from '../particle.js';
import { audio } from '../audio.js';

export class ShadowWeaver extends Boss {
  constructor(cx, cy) {
    super(cx, cy, 'THE SHADOW WEAVER', '#800080'); // Deep purple
    
    // Shield configuration: Web cage segments
    this.cageRotation = 0;
    this.cageSpeed = 0.7; // slow rotation
    this.cageActive = true;
    this.cageRadius = 65;
    
    // Illusion Decoys
    this.decoys = [];
    this.activeDecoyIdx = 0;
    
    // Void Webs on path
    this.voidWebs = [];
    
    // Spotlight (WOW Attack)
    this.spotlightActive = false;
    this.spotlightAngle = 0;
    this.spotlightSpeed = 1.0;
    this.spotlightWidth = 0.9; // ~50 degrees safe zone
    
    // Sequences
    this.phase1Sequence = [
      'VOID_WEBS', 'RECOVERY',
      'DECOY_SPLIT', 'RECOVERY',
      'WEAVE_SHIELDS', 'RECOVERY'
    ];
    
    this.phase2Sequence = [
      'WEAVE_SHIELDS', 'RECOVERY',
      'VOID_WEBS', 'RECOVERY',
      'DECOY_SPLIT', 'RECOVERY',
      'COMBINED_WEBS_SHIELDS', 'RECOVERY'
    ];
    
    this.finalSequence = [
      'WOW_TOTAL_ECLIPSE', 'RECOVERY',
      'COMBINED_WEBS_SHIELDS', 'RECOVERY',
      'DECOY_SPLIT', 'RECOVERY'
    ];
    
    this.activeSequence = this.phase1Sequence;
    this.targetAttack = 'IDLE';
    this.recoveryDuration = 2.0;
    
    this.reset();
  }

  reset() {
    super.reset();
    this.cageRotation = 0;
    this.cageActive = true;
    this.decoys = [];
    this.voidWebs = [];
    this.spotlightActive = false;
    
    this.activeSequence = this.phase1Sequence;
    this.targetAttack = 'IDLE';
    this.state = 'IDLE';
    this.stateTimer = 1.5;
    this.sequenceIndex = 0;
  }

  // Override takeDamage to support Web Cage blocking check
  takeDamage(amount) {
    const playerEl = window.gameAppInstance?.player;
    if (playerEl) {
      // If Decoy Split is active, only hitting the real flashing core does damage
      if (this.decoys.length > 0) {
        // Find distance to decoy targets
        // Player is at (cx, cy) which is where we consolidate them,
        // but let's check which decoy was targeted.
        // During Decoy Split, player must hit the real target (which is this boss).
        // If they hit a decoy instead, they take damage and block.
        const hitAngle = playerEl.theta;
        const targetDecoy = this.decoys.find(d => !d.isReal && Math.abs(d.angle - hitAngle) < 0.4);
        if (targetDecoy) {
          // Blocked by decoy!
          playerEl.takeDamage();
          screenShake.trigger(8, 0.3);
          particles.spawnExplosion(targetDecoy.x, targetDecoy.y, '#9d00ff', 12, 4);
          
          const banner = document.getElementById('warning-banner');
          if (banner) {
            banner.textContent = "DECOY HIT: BLOCKED";
            banner.style.color = '#9d00ff';
            banner.style.textShadow = '0 0 10px #9d00ff';
            banner.classList.add('active');
            setTimeout(() => banner.classList.remove('active'), 800);
          }
          return;
        }
      }
      
      // Check Web Cage shield lines
      if (this.cageActive && this.state !== 'TRANSITION') {
        const dashAngle = playerEl.theta;
        // There are 3 threads woven around the boss.
        // Each thread forms a segment at radius 65.
        // Openings exist between segments.
        if (this.isAngleCageShielded(dashAngle)) {
          playerEl.takeDamage();
          screenShake.trigger(10, 0.35);
          particles.spawnExplosion(this.cx + Math.cos(dashAngle) * 65, this.cy + Math.sin(dashAngle) * 65, '#9d00ff', 15, 5);
          
          const banner = document.getElementById('warning-banner');
          if (banner) {
            banner.textContent = "CAGE BLOCKED";
            banner.style.color = '#9d00ff';
            banner.style.textShadow = '0 0 10px #9d00ff';
            banner.classList.add('active');
            setTimeout(() => banner.classList.remove('active'), 800);
          }
          return;
        }
      }
    }
    
    super.takeDamage(amount);
  }

  isAngleCageShielded(angle) {
    const normAngle = (angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const arcLen = 1.4; // ~80 degrees thread block (3 blocks total)
    
    for (let i = 0; i < 3; i++) {
      const start = ((this.cageRotation + (i * Math.PI * 2 / 3)) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const end = (start + arcLen) % (Math.PI * 2);
      
      const inRange = (val, s, e) => {
        if (s <= e) return val >= s && val <= e;
        return val >= s || val <= e;
      };
      
      if (inRange(normAngle, start, end)) return true;
    }
    return false;
  }

  checkPhaseTransitions() {
    if (this.phase === 1 && this.hp < 65) {
      this.triggerPhaseTransition(2, "SHADOW WEB OVERLOAD: PHASE 2");
      this.activeSequence = this.phase2Sequence;
      this.sequenceIndex = 0;
      this.cageSpeed = 1.2;
    } else if (this.phase === 2 && this.hp < 30) {
      this.triggerPhaseTransition(3, "VOID ECLIPSE TRIGGERED: FINAL PHASE");
      this.activeSequence = this.finalSequence;
      this.sequenceIndex = 0;
      this.cageSpeed = 1.6;
    }
  }

  update(dt, player) {
    super.update(dt, player);
    
    // Cage rotation
    this.cageRotation += this.cageSpeed * dt;
    
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
    this.updateDecoys(dt, player);
    this.updateVoidWebs(dt, player);
    this.updateSpotlight(dt, player);
    
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
      case 'VOID_WEBS':
        this.stateTimer = 1.0;
        if (banner) {
          banner.textContent = "VOID SPINNER DEPLOYMENT";
          banner.style.color = '#9d00ff';
          banner.style.textShadow = '0 0 10px #9d00ff';
          banner.classList.add('active');
        }
        break;
        
      case 'DECOY_SPLIT':
        this.stateTimer = 1.0;
        if (banner) {
          banner.textContent = "SHADOW SPLIT REFLECTION";
          banner.style.color = '#9d00ff';
          banner.style.textShadow = '0 0 10px #9d00ff';
          banner.classList.add('active');
        }
        break;
        
      case 'WEAVE_SHIELDS':
        this.stateTimer = 1.0;
        if (banner) {
          banner.textContent = "WEB SHIELD INTENSIFYING";
          banner.style.color = '#ffd700';
          banner.style.textShadow = '0 0 10px #ffd700';
          banner.classList.add('active');
        }
        break;
        
      case 'COMBINED_WEBS_SHIELDS':
        this.stateTimer = 1.0;
        this.cageActive = true;
        if (banner) {
          banner.textContent = "SHADOW CAGE OVERLOAD";
          banner.style.color = '#ff00ff';
          banner.style.textShadow = '0 0 10px #ff00ff';
          banner.classList.add('active');
        }
        break;

      case 'WOW_TOTAL_ECLIPSE':
        this.stateTimer = 1.5;
        this.spotlightActive = true;
        this.spotlightAngle = Math.random() * Math.PI * 2;
        this.spotlightSpeed = Math.random() < 0.5 ? 0.6 : -0.6;
        if (banner) {
          banner.textContent = "⚠️ TOTAL ECLIPSE: STAY IN LIGHT ⚠️";
          banner.style.color = '#ffffff';
          banner.style.textShadow = '0 0 15px #9d00ff';
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
      case 'VOID_WEBS':
        this.stateTimer = 4.0;
        this.spawnVoidWebs(3);
        break;
        
      case 'DECOY_SPLIT':
        this.stateTimer = 4.5;
        this.spawnDecoys();
        break;
        
      case 'WEAVE_SHIELDS':
        this.stateTimer = 4.0;
        this.cageActive = true;
        break;
        
      case 'COMBINED_WEBS_SHIELDS':
        this.stateTimer = 4.0;
        this.spawnVoidWebs(2);
        break;
        
      case 'WOW_TOTAL_ECLIPSE':
        this.stateTimer = 6.0; // Stay in light for 6s
        break;
    }
  }

  finishAttack() {
    this.decoys = [];
    this.spotlightActive = false;
    this.state = 'RECOVERY';
    this.stateTimer = this.recoveryDuration;
  }

  spawnDecoys() {
    this.decoys = [];
    // Spawns 2 decoy mirrors at 120 and 240 degrees offsets
    const angles = [0, (Math.PI * 2) / 3, (2 * Math.PI * 2) / 3];
    const realIdx = Math.floor(Math.random() * 3);
    
    angles.forEach((angle, idx) => {
      const dist = 75;
      const x = this.cx + Math.cos(angle) * dist;
      const y = this.cy + Math.sin(angle) * dist;
      
      this.decoys.push({
        x: x,
        y: y,
        angle: angle,
        isReal: idx === realIdx,
        blink: 0
      });
      
      // Move this main boss core position to match the real decoy target
      if (idx === realIdx) {
        this.cx = x;
        this.cy = y;
      }
    });
  }

  updateDecoys(dt, player) {
    this.decoys.forEach(d => {
      d.blink += dt * 5;
    });
  }

  spawnVoidWebs(count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.voidWebs.push({
        x: this.cx + Math.cos(angle) * 220,
        y: this.cy + Math.sin(angle) * 220,
        radius: 20,
        life: 5.0, // stays 5s
        color: '#800080'
      });
    }
  }

  updateVoidWebs(dt, player) {
    for (let i = this.voidWebs.length - 1; i >= 0; i--) {
      const w = this.voidWebs[i];
      w.life -= dt;
      
      // Collision slowing web check
      if (player.state !== 'DEAD') {
        const dist = getDistance(w.x, w.y, player.x, player.y);
        if (dist < w.radius + player.radius) {
          player.takeDamage();
          w.life = 0; // consumed
          particles.spawnExplosion(w.x, w.y, '#9d00ff', 6, 2);
        }
      }
      
      if (w.life <= 0) {
        this.voidWebs.splice(i, 1);
      }
    }
  }

  updateSpotlight(dt, player) {
    if (!this.spotlightActive || this.state !== 'ATTACK') return;
    
    // Rotate spotlight
    this.spotlightAngle += this.spotlightSpeed * dt;
    
    // Check spotlight collision: deals constant damage unless inside
    if (player.state !== 'DEAD' && Math.floor(Date.now() / 150) % 5 === 0) {
      const playerAngle = Math.atan2(player.y - this.cy, player.x - this.cx);
      let diff = playerAngle - this.spotlightAngle;
      
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      
      // If player is outside spotlight wedge (spotlightWidth = 0.9 rad)
      if (Math.abs(diff) > this.spotlightWidth / 2) {
        player.takeDamage();
      }
    }
  }

  draw(ctx) {
    super.draw(ctx);
    
    // Draw Void Webs
    this.voidWebs.forEach(w => {
      ctx.save();
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = w.color;
      
      // Web cross outlines
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI / 2) * i;
        ctx.moveTo(w.x, w.y);
        ctx.lineTo(w.x + Math.cos(angle) * w.radius, w.y + Math.sin(angle) * w.radius);
      }
      ctx.stroke();
      ctx.restore();
    });
    
    // Draw Decoy Splinters
    this.decoys.forEach(d => {
      if (d.isReal) return; // Core drawn by normal render
      ctx.save();
      
      // Decoys pulse slightly out of sync
      const pulse = 1.0 + Math.sin(d.blink) * 0.1;
      
      ctx.fillStyle = '#0a0010';
      ctx.strokeStyle = '#9d00ff';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#9d00ff';
      
      ctx.beginPath();
      ctx.arc(d.x, d.y, 35 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Spider eyes
      ctx.fillStyle = '#ff0055';
      ctx.beginPath();
      ctx.arc(d.x - 8, d.y - 4, 3, 0, Math.PI * 2);
      ctx.arc(d.x + 8, d.y - 4, 3, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    });
    
    // Draw Total Eclipse spotlight wedge
    if (this.spotlightActive) {
      ctx.save();
      
      // Draw dark overlay everywhere except the spotlight wedge!
      ctx.fillStyle = 'rgba(2, 3, 6, 0.85)';
      ctx.shadowBlur = 0;
      
      ctx.beginPath();
      // Draw clock wedge cut out
      const start = this.spotlightAngle - this.spotlightWidth / 2;
      const end = this.spotlightAngle + this.spotlightWidth / 2;
      
      ctx.arc(this.cx, this.cy, 500, end, start); // inverted sweep covers everything else
      ctx.lineTo(this.cx, this.cy);
      ctx.closePath();
      ctx.fill();
      
      // Draw spotlight beam borders
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00f3ff';
      
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.lineTo(this.cx + Math.cos(start) * 500, this.cy + Math.sin(start) * 500);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.lineTo(this.cx + Math.cos(end) * 500, this.cy + Math.sin(end) * 500);
      ctx.stroke();
      
      ctx.restore();
    }
    
    // --- Draw Web Cage Shields ---
    if (this.cageActive && this.state !== 'DEAD' && this.state !== 'TRANSITION') {
      ctx.save();
      // Warn vs Active
      ctx.strokeStyle = (this.state === 'TELEGRAPH' && this.targetAttack === 'WEAVE_SHIELDS') ? 'rgba(255, 215, 0, 0.45)' : '#9d00ff';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#9d00ff';
      if (this.state === 'TELEGRAPH' && this.targetAttack === 'WEAVE_SHIELDS') {
        ctx.setLineDash([4, 6]);
      }
      
      // Draw 3 curved cage segments
      const arcLen = 1.4; // rads
      for (let i = 0; i < 3; i++) {
        const start = this.cageRotation + (i * Math.PI * 2 / 3);
        const end = start + arcLen;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, this.cageRadius, start, end);
        ctx.stroke();
      }
      ctx.restore();
    }
    
    // --- Draw Main Shadow Spider Core ---
    ctx.save();
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
    
    // Draw geometric spider shape
    ctx.fillStyle = '#0a0010';
    ctx.strokeStyle = '#9d00ff';
    ctx.lineWidth = 4;
    ctx.shadowBlur = dynamicRadius * 0.55;
    ctx.shadowColor = '#9d00ff';
    
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, dynamicRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Spider legs (floating triangles)
    ctx.strokeStyle = '#9d00ff';
    ctx.lineWidth = 2.5;
    const time = Date.now() * 0.004;
    for (let i = 0; i < 6; i++) {
      const legAngle = (Math.PI / 3) * i + Math.sin(time + i) * 0.15;
      ctx.beginPath();
      ctx.moveTo(this.cx + Math.cos(legAngle) * dynamicRadius, this.cy + Math.sin(legAngle) * dynamicRadius);
      ctx.lineTo(this.cx + Math.cos(legAngle) * (dynamicRadius + 18), this.cy + Math.sin(legAngle) * (dynamicRadius + 18));
      ctx.stroke();
    }
    
    // Red spider eyes
    ctx.fillStyle = '#ff0055';
    ctx.beginPath();
    ctx.arc(this.cx - 8, this.cy - 4, 3, 0, Math.PI * 2);
    ctx.arc(this.cx + 8, this.cy - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}
