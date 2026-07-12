/**
 * ==========================================================================
 * ORBITAL BOUND: Boss Rush - Boss 4: The Solar Phoenix (Anti-Spam Shield)
 * ==========================================================================
 */

import { Boss } from './boss.js';
import { lerp, clamp, getDistance } from '../utils.js';
import { particles, screenShake } from '../particle.js';
import { audio } from '../audio.js';

export class SolarPhoenix extends Boss {
  constructor(cx, cy) {
    super(cx, cy, 'THE SOLAR PHOENIX', '#ff3300');
    
    // Shield configuration (Anti-Spam)
    this.shieldRotation = 0;
    this.shieldSpeed = 1.2; // Rad/s rotation
    this.shieldArcLen = 1.6; // ~90 degrees each (2 shields)
    this.shieldWidth = 14;
    
    // Visual wings bobbing
    this.wingScale = 1.0;
    this.wingTimer = 0;
    
    // Solar Prominences
    this.prominences = []; // arrays of fiery loops
    
    // Ash Flares
    this.ashFlares = [];
    
    // Stellar Wind
    this.stellarWindActive = false;
    this.windStrength = 0.8; // changes player speed
    this.windDirection = 1; // 1 = CW push, -1 = CCW push
    
    // Sequences
    this.phase1Sequence = [
      'ASH_FLARES', 'RECOVERY',
      'SOLAR_PROMINENCES', 'RECOVERY',
      'STELLAR_WIND', 'RECOVERY'
    ];
    
    this.phase2Sequence = [
      'SOLAR_PROMINENCES', 'RECOVERY',
      'ASH_FLARES', 'RECOVERY',
      'STELLAR_WIND', 'RECOVERY',
      'COMBINED_WIND_FLARES', 'RECOVERY'
    ];
    
    this.finalSequence = [
      'WOW_SUPERNOVA', 'RECOVERY',
      'COMBINED_WIND_FLARES', 'RECOVERY',
      'SOLAR_PROMINENCES', 'RECOVERY'
    ];
    
    this.maxHp = 160;
    this.hp = 160;
    
    this.activeSequence = this.phase1Sequence;
    this.targetAttack = 'IDLE';
    this.recoveryDuration = 2.0;
    
    this.reset();
  }

  reset() {
    super.reset();
    this.shieldRotation = 0;
    this.shieldSpeed = 1.2;
    
    this.prominences = [];
    this.ashFlares = [];
    this.stellarWindActive = false;
    this.windDirection = 1;
    
    this.activeSequence = this.phase1Sequence;
    this.targetAttack = 'IDLE';
    this.state = 'IDLE';
    this.stateTimer = 1.5;
    this.sequenceIndex = 0;
  }

  // Override takeDamage to support Anti-Spam Shield checks
  // Called by Player when they dash-attack the center
  takeDamage(amount) {
    // Check if player hit the shield!
    // Since player coordinates are at the center (cx, cy) on impact,
    // we query the player's launch angle before they hit.
    // In src/player.js, when player handles hit, they are at the center,
    // but we can query player's launch angle (theta) from player.
    
    // To make this robust, let's find the active player instance in the game
    // and check the angle they dashed from.
    const playerEl = window.gameAppInstance?.player;
    if (playerEl) {
      const dashAngle = playerEl.theta; // the angle the player dashed from
      
      // Check if this angle falls into any of the 2 shield arcs
      // Shield 1: shieldRotation to shieldRotation + shieldArcLen
      // Shield 2: shieldRotation + PI to shieldRotation + PI + shieldArcLen
      if (this.isAngleShielded(dashAngle)) {
        // BLOCKED! Shield reflects attack, damages player, screenshakes
        playerEl.takeDamage(); // Player takes damage for brainless spamming!
        screenShake.trigger(10, 0.35);
        
        // Spawn shield spark reflections
        const hitX = this.cx + Math.cos(dashAngle) * (this.radius + 15);
        const hitY = this.cy + Math.sin(dashAngle) * (this.radius + 15);
        particles.spawnExplosion(hitX, hitY, '#ff9d00', 15, 6);
        
        // Text popup indicator
        const banner = document.getElementById('warning-banner');
        if (banner) {
          banner.textContent = "SHIELD REFLECTED";
          banner.style.color = '#ff9d00';
          banner.style.textShadow = '0 0 10px #ff9d00';
          banner.classList.add('active');
          setTimeout(() => banner.classList.remove('active'), 800);
        }
        return; // No damage applied to boss!
      }
    }
    
    // Shield not hit: apply normal damage
    super.takeDamage(amount);
  }

  isAngleShielded(angle) {
    // Normalise angles to [0, 2PI]
    const normAngle = (angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    
    const s1Start = (this.shieldRotation % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const s1End = (s1Start + this.shieldArcLen) % (Math.PI * 2);
    
    const s2Start = (s1Start + Math.PI) % (Math.PI * 2);
    const s2End = (s2Start + this.shieldArcLen) % (Math.PI * 2);
    
    const inRange = (val, start, end) => {
      if (start <= end) return val >= start && val <= end;
      return val >= start || val <= end;
    };
    
    return inRange(normAngle, s1Start, s1End) || inRange(normAngle, s2Start, s2End);
  }

  checkPhaseTransitions() {
    if (this.phase === 1 && this.hp <= 40) { // 25% of 160 maxHp
      this.triggerPhaseTransition(2, 100); // Phase 2 has 100 HP (climax!)
      this.activeSequence = this.phase2Sequence;
      this.sequenceIndex = 0;
      this.shieldSpeed = 2.0; // rotate faster!
      this.color = '#00f3ff'; // Color turns to solar supernova cyan!
    }
  }

  activeAttackCleanup() {
    this.prominences = [];
    this.ashFlares = [];
    this.stellarWindActive = false;
    const banner = document.getElementById('warning-banner');
    if (banner) banner.classList.remove('active');
  }

  update(dt, player) {
    // Temporarily expose this boss instance to global window to check angles
    if (!window.gameAppInstance) {
      window.gameAppInstance = { player: player };
    }
    
    // Tilt body to face player
    const targetTilt = Math.atan2(player.y - this.cy, player.x - this.cx) - Math.PI / 2;
    this.bodyTilt = lerp(this.bodyTilt || 0, targetTilt, 4 * dt);
    
    super.update(dt, player);
    
    // Constant rotation of anti-spam fire shields
    this.shieldRotation += this.shieldSpeed * dt;
    
    // Bobbing wing animations
    this.wingTimer += dt * 5.0;
    this.wingScale = 1.0 + Math.sin(this.wingTimer) * 0.15;
    
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
    
    // Update active projectiles
    this.updateProminences(dt, player);
    this.updateAshFlares(dt, player);
    this.updateStellarWind(dt, player);
    
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
      case 'SOLAR_PROMINENCES':
        this.stateTimer = 1.0; // 1s warning
        this.spawnProminencesWarning();
        if (banner) {
          banner.textContent = "SOLAR FLARE LOOPS DETECTED";
          banner.style.color = '#ff3300';
          banner.style.textShadow = '0 0 10px #ff3300';
          banner.classList.add('active');
        }
        break;
        
      case 'ASH_FLARES':
        this.stateTimer = 0.8;
        if (banner) {
          banner.textContent = "BURNING ASH GRID ACTIVE";
          banner.style.color = '#ff9d00';
          banner.style.textShadow = '0 0 10px #ff9d00';
          banner.classList.add('active');
        }
        break;
        
      case 'STELLAR_WIND':
        this.stateTimer = 1.0;
        this.stellarWindActive = true;
        this.windDirection = Math.random() < 0.5 ? 1 : -1;
        if (banner) {
          banner.textContent = this.windDirection > 0 ? "STELLAR WIND: CW PUSH" : "STELLAR WIND: CCW PUSH";
          banner.style.color = '#ff9d00';
          banner.style.textShadow = '0 0 10px #ff9d00';
          banner.classList.add('active');
        }
        break;
        
      case 'COMBINED_WIND_FLARES':
        this.stateTimer = 1.0;
        this.stellarWindActive = true;
        this.windDirection = Math.random() < 0.5 ? 1 : -1;
        this.spawnProminencesWarning();
        if (banner) {
          banner.textContent = "SOLAR WINDS OVERLOADING";
          banner.style.color = '#ff00ff';
          banner.style.textShadow = '0 0 10px #ff00ff';
          banner.classList.add('active');
        }
        break;

      case 'WOW_SUPERNOVA':
        this.stateTimer = 1.5; // Long telegraph warning
        if (banner) {
          banner.textContent = "⚠️ THERMONUCLEAR EXPLOSION: HIDE! ⚠️";
          banner.style.color = '#ff0000';
          banner.style.textShadow = '0 0 15px #ff0000';
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
      case 'SOLAR_PROMINENCES':
        this.stateTimer = 3.0; // active 3 seconds
        this.prominences.forEach(p => p.state = 'ACTIVE');
        break;
        
      case 'ASH_FLARES':
        this.stateTimer = 4.0;
        this.spawnAshFlaresWave(4);
        break;
        
      case 'STELLAR_WIND':
        this.stateTimer = 5.0; // wind blows 5s
        break;
        
      case 'COMBINED_WIND_FLARES':
        this.stateTimer = 4.0;
        this.prominences.forEach(p => p.state = 'ACTIVE');
        break;
        
      case 'WOW_SUPERNOVA':
        this.stateTimer = 2.0; // explode for 2s
        // Create the circular moving solar flare shields to hide behind
        this.prominences = [
          { radius: 220, angle: Math.random() * Math.PI * 2, width: 1.0, speed: 0.8, state: 'WOW_EXPLODE' }
        ];
        break;
    }
  }

  finishAttack() {
    this.prominences = [];
    this.stellarWindActive = false;
    this.state = 'RECOVERY';
    this.stateTimer = this.recoveryDuration;
  }

  spawnProminencesWarning() {
    this.prominences = [];
    // Spawn 2 flame loops blocking segments of player orbit (radius = 220)
    const angle1 = Math.random() * Math.PI * 2;
    const angle2 = angle1 + Math.PI; // opposite sides
    
    this.prominences.push({
      angle: angle1,
      width: 0.8, // ~45 degrees block
      state: 'TELEGRAPH',
      radius: 220
    });
    this.prominences.push({
      angle: angle2,
      width: 0.8,
      state: 'TELEGRAPH',
      radius: 220
    });
  }

  updateProminences(dt, player) {
    this.prominences.forEach(p => {
      if (p.state === 'WOW_EXPLODE') {
        // Wow Attack: Rotate the safety shield
        p.angle += p.speed * dt;
        
        // Supernova deals damage to player unless player is inside the safety arc!
        if (this.state === 'ATTACK' && player.state !== 'DEAD') {
          const playerAngle = Math.atan2(player.y - this.cy, player.x - this.cx);
          let diff = playerAngle - p.angle;
          
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          
          // Player must be WITHIN the safety arc (gap width = 1.0 radians)
          if (Math.abs(diff) > p.width / 2) {
            player.takeDamage();
          }
        }
      } else if (p.state === 'ACTIVE') {
        // Standard danger loop collision check
        if (player.state !== 'DEAD') {
          const playerAngle = Math.atan2(player.y - this.cy, player.x - this.cx);
          let diff = playerAngle - p.angle;
          
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          
          if (Math.abs(diff) < p.width / 2) {
            player.takeDamage();
          }
        }
      }
    });
  }

  spawnAshFlaresWave(count) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.3;
      // Fire bullet that travels outwards, then stops and deposits ash
      const speed = 2.5;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      const b = {
        x: this.cx,
        y: this.cy,
        vx: vx,
        vy: vy,
        radius: 10,
        active: true,
        type: 'PROJECTILE',
        dist: 0,
        life: 5.0
      };
      this.ashFlares.push(b);
    }
  }

  updateAshFlares(dt, player) {
    for (let i = this.ashFlares.length - 1; i >= 0; i--) {
      const f = this.ashFlares[i];
      f.life -= dt;
      
      if (f.type === 'PROJECTILE') {
        f.x += f.vx * 60 * dt;
        f.y += f.vy * 60 * dt;
        f.dist = getDistance(this.cx, this.cy, f.x, f.y);
        
        // Stop moving when reaching player orbit radius (220)
        if (f.dist >= 220) {
          f.type = 'ASH';
          f.x = this.cx + Math.cos(Math.atan2(f.y - this.cy, f.x - this.cx)) * 220;
          f.y = this.cy + Math.sin(Math.atan2(f.y - this.cy, f.x - this.cx)) * 220;
          f.radius = 14; // expand slightly as ash puddle
          f.life = 4.0; // stays on path for 4 seconds
        }
        
        // Collision with player while traveling
        if (player.state !== 'DEAD') {
          const dist = getDistance(f.x, f.y, player.x, player.y);
          if (dist < f.radius + player.radius) {
            player.takeDamage();
            f.active = false;
          }
        }
      } else {
        // Ash puddle blinking
        // Collision checks
        if (player.state !== 'DEAD') {
          const dist = getDistance(f.x, f.y, player.x, player.y);
          if (dist < f.radius + player.radius) {
            player.takeDamage();
          }
        }
      }
      
      if (f.life <= 0 || !f.active) {
        this.ashFlares.splice(i, 1);
      }
    }
  }

  updateStellarWind(dt, player) {
    if (!this.stellarWindActive || this.state !== 'ATTACK') return;
    
    // Constant wind push on player orbit angle
    if (player && player.state === 'ORBITING') {
      // Wind speed alters rotation rate
      // If player orbits CW (dir=1) and wind is CW (1), player goes faster!
      // If player orbits CCW (-1) and wind is CW (1), player goes slower!
      const force = this.windDirection * this.windStrength * dt;
      player.theta += force;
    }
  }

  draw(ctx) {
    const dynamicRadius = this.radius * this.visualScale;
    super.draw(ctx);
    
    // Draw Ash Flares (projectiles / puddles)
    this.ashFlares.forEach(f => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      ctx.fillStyle = f.type === 'PROJECTILE' ? '#ff9d00' : 'rgba(255, 60, 0, 0.7)';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = f.type === 'PROJECTILE' ? 2 : 1;
      ctx.shadowBlur = f.radius * 1.5;
      ctx.shadowColor = '#ff3300';
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    // Draw Solar Prominences / Supernova explosion
    this.prominences.forEach(p => {
      ctx.save();
      
      if (p.state === 'WOW_EXPLODE') {
        // Draw the massive supernova screen background (except the safety arc!)
        ctx.fillStyle = 'rgba(255, 60, 0, 0.15)';
        ctx.shadowBlur = 40;
        ctx.shadowColor = '#ff3300';
        
        ctx.beginPath();
        // Outer explosion ring
        ctx.arc(this.cx, this.cy, 500, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw the safety arc boundary in glowing Cyan
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 14;
        ctx.shadowColor = '#00f3ff';
        ctx.beginPath();
        const start = p.angle - p.width / 2;
        const end = p.angle + p.width / 2;
        ctx.arc(this.cx, this.cy, p.radius, start, end);
        ctx.stroke();
        
        // Draw details inside safety shield
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, p.radius, start, end);
        ctx.stroke();
        
      } else {
        // Standard loops
        ctx.strokeStyle = p.state === 'TELEGRAPH' ? 'rgba(255, 51, 0, 0.45)' : '#ff3300';
        ctx.lineWidth = p.state === 'TELEGRAPH' ? 3 : 12;
        ctx.shadowBlur = p.state === 'TELEGRAPH' ? 8 : 20;
        ctx.shadowColor = '#ff3300';
        if (p.state === 'TELEGRAPH') {
          ctx.setLineDash([4, 8]);
        }
        
        // Curved fire loop segment on orbit
        ctx.beginPath();
        const start = p.angle - p.width / 2;
        const end = p.angle + p.width / 2;
        ctx.arc(this.cx, this.cy, p.radius, start, end);
        ctx.stroke();
        ctx.restore();
      }
    });
    
    // Draw Stellar Wind particle indicator vectors
    if (this.stellarWindActive && this.state === 'ATTACK') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 90, 0, 0.15)';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 15]);
      
      ctx.beginPath();
      // Draw outer flowing particle ring in the direction of wind
      const rot = Date.now() * 0.002 * this.windDirection;
      ctx.arc(this.cx, this.cy, 240, rot, rot + Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    
    // --- Draw Anti-Spam rotating Shields ---
    if (this.state !== 'DEAD' && this.state !== 'TRANSITION') {
      ctx.save();
      ctx.lineWidth = this.shieldWidth;
      ctx.strokeStyle = '#ff9d00';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ff3300';
      
      const r = dynamicRadius + 18;
      
      // Draw 2 shield arcs (each covering shieldArcLen)
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, r, this.shieldRotation, this.shieldRotation + this.shieldArcLen);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, r, this.shieldRotation + Math.PI, this.shieldRotation + Math.PI + this.shieldArcLen);
      ctx.stroke();
      
      ctx.restore();
    }
    
    // --- Draw Main Phoenix Body Core ---
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
    
    // Tilt to face player dynamically
    ctx.translate(this.cx, this.cy);
    ctx.rotate(this.bodyTilt || 0);
    ctx.translate(-this.cx, -this.cy);
    
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
    
    // Draw glowing star center core
    ctx.fillStyle = this.phase === 2 ? '#001a1e' : '#1e0500';
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 4;
    ctx.shadowBlur = dynamicRadius * 0.7;
    ctx.shadowColor = this.color;
    
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, dynamicRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Draw Supernova Solar Corona Flare ring in Phase 2
    if (this.phase === 2) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#00f3ff';
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const angle = (Math.PI * 2 / 16) * i + Date.now() * 0.003;
        const r = dynamicRadius + 18 + Math.sin(Date.now() / 80 + i) * 6;
        const px = this.cx + Math.cos(angle) * r;
        const py = this.cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    
    // Draw Phoenix Wing Geometry (bobbing wings)
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3.5;
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.scale(this.wingScale, 1.0);
    
    // Left Wing
    ctx.beginPath();
    ctx.moveTo(-dynamicRadius, 0);
    ctx.lineTo(-dynamicRadius - 25, -15);
    ctx.lineTo(-dynamicRadius - 15, 10);
    ctx.closePath();
    ctx.stroke();
    
    // Right Wing
    ctx.beginPath();
    ctx.moveTo(dynamicRadius, 0);
    ctx.lineTo(dynamicRadius + 25, -15);
    ctx.lineTo(dynamicRadius + 15, 10);
    ctx.closePath();
    ctx.stroke();
    
    ctx.restore();
    
    // Hot central fire core
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, dynamicRadius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}
