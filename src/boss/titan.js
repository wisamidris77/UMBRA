/**
 * ==========================================================================
 * ORBITAL BOUND: Boss Rush - Boss 2: The Crystal Titan
 * ==========================================================================
 */

import { Boss } from './boss.js';
import { lerp, clamp, getDistance } from '../utils.js';
import { particles, screenShake } from '../particle.js';

export class CrystalTitan extends Boss {
  constructor(cx, cy) {
    super(cx, cy, 'THE CRYSTAL TITAN', '#ff00ff');
    
    // Custom Titan visuals
    this.bobOffsetY = 0;
    this.bobTimer = 0;
    this.coreRotation = 0;
    this.orbitingCrystals = 6;
    
    // Slam parameters
    this.titanY = cy;
    this.slamProgress = 0; // for squash/stretch slam animation
    this.shockwaves = [];
    
    // Spears parameters
    this.spears = [];
    
    // Boomerangs
    this.boomerangs = [];
    
    // Safe Slice
    this.sliceActive = false;
    this.sliceWarning = false;
    this.sliceRotation = 0;
    this.sliceRadius = 0;
    
    // WOW Attack: Screen Crack
    this.isShattered = false;
    this.screenCracks = [];
    
    // Sequences
    this.phase1Sequence = [
      'CRYSTAL_SPEARS', 'RECOVERY',
      'SAFE_SLICE', 'RECOVERY',
      'BOOMERANGS', 'RECOVERY',
      'CRYSTAL_SLAM', 'RECOVERY'
    ];
    
    this.phase2Sequence = [
      'SAFE_SLICE', 'RECOVERY',
      'CRYSTAL_SPEARS', 'RECOVERY',
      'BOOMERANGS', 'RECOVERY',
      'CRYSTAL_SLAM', 'RECOVERY',
      'COMBINED_BOOMERANGS_SLICE', 'RECOVERY',
      'COMBINED_SPEARS_BOOMERANGS', 'RECOVERY'
    ];
    
    this.finalSequence = [
      'WOW_SHATTERED_DIMENSION', 'RECOVERY',
      'COMBINED_BOOMERANGS_SLICE', 'RECOVERY',
      'CRYSTAL_SLAM', 'RECOVERY',
      'COMBINED_SPEARS_BOOMERANGS', 'RECOVERY'
    ];
    
    this.activeSequence = this.phase1Sequence;
    this.targetAttack = 'IDLE';
    this.recoveryDuration = 2.0;
    
    this.reset();
  }

  reset() {
    super.reset();
    this.bobOffsetY = 0;
    this.bobTimer = 0;
    this.coreRotation = 0;
    this.titanY = this.cy;
    this.slamProgress = 0;
    this.shockwaves = [];
    this.spears = [];
    this.boomerangs = [];
    this.sliceActive = false;
    this.sliceWarning = false;
    this.sliceRotation = 0;
    this.sliceRadius = 0;
    this.isShattered = false;
    this.screenCracks = [];
    
    this.activeSequence = this.phase1Sequence;
    this.targetAttack = 'IDLE';
    this.state = 'IDLE';
    this.stateTimer = 1.5;
    this.sequenceIndex = 0;
    
    const cracksContainer = document.getElementById('screen-cracks');
    if (cracksContainer) cracksContainer.style.opacity = '0';
  }

  checkPhaseTransitions() {
    if (this.phase === 1 && this.hp < 60) {
      this.triggerPhaseTransition(2, "CRYSTALS SHATTERING: PHASE 2");
      this.activeSequence = this.phase2Sequence;
      this.sequenceIndex = 0;
    } else if (this.phase === 2 && this.hp < 30) {
      this.triggerPhaseTransition(3, "DIMENSIONAL CRACK: FINAL PHASE");
      this.activeSequence = this.finalSequence;
      this.sequenceIndex = 0;
    }
  }

  update(dt, player) {
    super.update(dt, player);
    
    // Slow elegant rotation of crystal core
    this.coreRotation += 0.4 * dt;
    
    // Hover bobbing effect
    if (this.state !== 'ATTACK' || (this.targetAttack !== 'CRYSTAL_SLAM' && this.targetAttack !== 'WOW_SHATTERED_DIMENSION')) {
      this.bobTimer += dt * 2.0;
      this.bobOffsetY = Math.sin(this.bobTimer) * 8;
      this.titanY = lerp(this.titanY, this.cy + this.bobOffsetY, 8 * dt);
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
    
    // Update custom attack projectiles
    this.updateSpears(dt, player);
    this.updateBoomerangs(dt, player);
    this.updateShockwaves(dt, player);
    this.updateSafeSlice(dt, player);
    
    // Attack timer decay
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
      case 'CRYSTAL_SPEARS':
        this.stateTimer = 1.0; // 1s charge
        this.spawnSpearsIndicators();
        if (banner) {
          banner.textContent = "CRYSTAL SPEARS LOCKED";
          banner.style.color = '#ff00ff';
          banner.style.textShadow = '0 0 10px #ff00ff';
          banner.classList.add('active');
        }
        break;
        
      case 'SAFE_SLICE':
        this.stateTimer = 1.0;
        this.sliceWarning = true; // Show early telegraph warning!
        this.sliceActive = false;
        this.sliceRadius = 0;
        this.sliceRotation = Math.random() * Math.PI * 2;
        if (banner) {
          banner.textContent = "SEGMENT WAVE LOCK";
          banner.style.color = '#ff00ff';
          banner.style.textShadow = '0 0 10px #ff00ff';
          banner.classList.add('active');
        }
        break;
        
      case 'BOOMERANGS':
        this.stateTimer = 0.8;
        this.spawnBoomerangs();
        if (banner) {
          banner.textContent = "CRYSTAL BOOMERANGS LOADED";
          banner.style.color = '#00f3ff';
          banner.style.textShadow = '0 0 10px #00f3ff';
          banner.classList.add('active');
        }
        break;
        
      case 'CRYSTAL_SLAM':
        this.stateTimer = 1.0; // rise up warning
        if (banner) {
          banner.textContent = "SEISMIC WAVE WARNING";
          banner.style.color = '#ff9d00';
          banner.style.textShadow = '0 0 10px #ff9d00';
          banner.classList.add('active');
        }
        break;
        
      case 'COMBINED_BOOMERANGS_SLICE':
        this.stateTimer = 1.0;
        this.spawnBoomerangs();
        this.sliceWarning = true; // Show early telegraph warning!
        this.sliceActive = false;
        this.sliceRadius = 0;
        this.sliceRotation = Math.random() * Math.PI * 2;
        if (banner) {
          banner.textContent = "BARRIER SPECTRUM OVERLOAD";
          banner.style.color = '#ff0055';
          banner.style.textShadow = '0 0 10px #ff0055';
          banner.classList.add('active');
        }
        break;
        
      case 'COMBINED_SPEARS_BOOMERANGS':
        this.stateTimer = 1.0;
        this.spawnSpearsIndicators();
        this.spawnBoomerangs();
        if (banner) {
          banner.textContent = "CRYSTAL SPLINTER FLOOD";
          banner.style.color = '#ff0055';
          banner.style.textShadow = '0 0 10px #ff0055';
          banner.classList.add('active');
        }
        break;

      case 'WOW_SHATTERED_DIMENSION':
        this.stateTimer = 1.2; // 1.2s rise up warning
        if (banner) {
          banner.textContent = "⚠️ CRYSTAL OVERLOAD: SHATTER DETECTED ⚠️";
          banner.style.color = '#ff00ff';
          banner.style.textShadow = '0 0 15px #ff00ff';
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
      case 'CRYSTAL_SPEARS':
        this.stateTimer = 1.5; // Fire spears over 1.5s
        this.spears.forEach(s => s.state = 'FIRE');
        break;
        
      case 'SAFE_SLICE':
        this.stateTimer = 3.0; // Slice active 3s
        this.sliceWarning = false;
        this.sliceActive = true;
        break;
        
      case 'BOOMERANGS':
        this.stateTimer = 3.2; // Out and back duration
        this.boomerangs.forEach(b => b.state = 'LAUNCH');
        break;
        
      case 'CRYSTAL_SLAM':
        this.stateTimer = 1.2; // slam down duration
        this.slamProgress = 0;
        break;
        
      case 'COMBINED_BOOMERANGS_SLICE':
        this.stateTimer = 3.2;
        this.boomerangs.forEach(b => b.state = 'LAUNCH');
        this.sliceWarning = false;
        this.sliceActive = true;
        break;
        
      case 'COMBINED_SPEARS_BOOMERANGS':
        this.stateTimer = 2.5;
        this.spears.forEach(s => s.state = 'FIRE');
        this.boomerangs.forEach(b => b.state = 'LAUNCH');
        break;

      case 'WOW_SHATTERED_DIMENSION':
        this.stateTimer = 2.0; // Slam and screenshake duration
        this.slamProgress = 0;
        this.isShattered = true;
        break;
    }
  }

  processAttack(dt, player) {
    switch (this.targetAttack) {
      case 'CRYSTAL_SLAM':
      case 'WOW_SHATTERED_DIMENSION':
        this.slamProgress += dt * 4;
        
        if (this.slamProgress < 1.0) {
          // Rise up
          this.titanY = lerp(this.titanY, this.cy - 70, 8 * dt);
        } else if (this.slamProgress >= 1.0 && this.slamProgress < 1.3) {
          // Slam down
          this.titanY = lerp(this.titanY, this.cy + 30, 20 * dt);
        } else {
          // Recover normal centering
          this.titanY = lerp(this.titanY, this.cy, 5 * dt);
          
          // Spawn Shockwave on impact frame
          if (this.shockwaves.length === 0) {
            screenShake.trigger(25, 0.65);
            particles.spawnExplosion(this.cx, this.cy, '#ff00ff', 20, 6);
            
            if (this.targetAttack === 'WOW_SHATTERED_DIMENSION') {
              // Trigger Screen Shatter UI overlay
              const cracks = document.getElementById('screen-cracks');
              if (cracks) {
                cracks.style.opacity = '0.95';
                setTimeout(() => cracks.style.opacity = '0', 8000); // Fades out slowly
              }
              // Generate massive shockwaves (3 concentric circles)
              this.spawnShockwave(160, 0);
              this.spawnShockwave(240, 0.4);
              this.spawnShockwave(320, 0.8);
              
              // Explode floating crystals
              particles.spawnShards(this.cx, this.cy, '#ff00ff', 30, 10);
            } else {
              // Standard shockwave with opening
              const gapAngle = Math.random() * Math.PI * 2;
              this.spawnShockwave(220, gapAngle);
            }
          }
        }
        break;
    }
  }

  finishAttack() {
    this.sliceActive = false;
    this.sliceWarning = false;
    this.spears = [];
    this.boomerangs = [];
    this.state = 'RECOVERY';
    this.stateTimer = this.recoveryDuration;
  }

  spawnSpearsIndicators() {
    this.spears = [];
    const count = 5;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      this.spears.push({
        x: this.cx + Math.cos(angle) * 70,
        y: this.cy + Math.sin(angle) * 70,
        angle: angle,
        targetAngle: angle,
        state: 'TELEGRAPH',
        timer: i * 0.15, // staggered fire delay
        radius: 12
      });
    }
  }

  updateSpears(dt, player) {
    this.spears.forEach(s => {
      if (s.state === 'TELEGRAPH') {
        // Slowly align pointing towards the player
        if (player.state !== 'DEAD') {
          const toPlayer = Math.atan2(player.y - s.y, player.x - s.x);
          s.targetAngle = toPlayer;
          s.angle = lerp(s.angle, s.targetAngle, 6 * dt);
        }
      } else if (s.state === 'FIRE') {
        s.timer -= dt;
        if (s.timer <= 0) {
          // Launch! Spawn a fast crystal bullet
          const speed = 4.0;
          const vx = Math.cos(s.angle) * speed;
          const vy = Math.sin(s.angle) * speed;
          this.spawnBullet(s.x, s.y, vx, vy, 10, '#ff00ff');
          s.state = 'DONE';
          
          // Small spark burst
          particles.spawnExplosion(s.x, s.y, '#ff00ff', 4, 2);
        }
      }
    });
  }

  spawnBoomerangs() {
    this.boomerangs = [];
    // Spawns 2 blades at opposite directions
    const angles = [0, Math.PI];
    angles.forEach(angle => {
      this.boomerangs.push({
        angle: angle,
        dist: 50,
        rot: 0,
        state: 'TELEGRAPH',
        targetDist: 225, // player orbit
        timeInOrbit: 0.8 // stays at orbit for 0.8s
      });
    });
  }

  updateBoomerangs(dt, player) {
    this.boomerangs.forEach(b => {
      b.rot += 12 * dt; // fast spinning blade
      
      if (b.state === 'LAUNCH') {
        // Move outwards
        b.dist = lerp(b.dist, b.targetDist, 6 * dt);
        
        if (Math.abs(b.dist - b.targetDist) < 15) {
          b.state = 'ORBIT_PAUSE';
        }
      } else if (b.state === 'ORBIT_PAUSE') {
        b.timeInOrbit -= dt;
        if (b.timeInOrbit <= 0) {
          b.state = 'RETURN';
        }
      } else if (b.state === 'RETURN') {
        // Pull back to center
        b.dist = lerp(b.dist, 40, 5 * dt);
        if (b.dist < 50) {
          b.state = 'DONE';
        }
      }
      
      // Calculations for damage
      if (b.state !== 'TELEGRAPH' && b.state !== 'DONE' && player.state !== 'DEAD') {
        const bx = this.cx + Math.cos(b.angle) * b.dist;
        const by = this.cy + Math.sin(b.angle) * b.dist;
        const dist = getDistance(bx, by, player.x, player.y);
        
        // Blade has a wider collision box (24px radius)
        if (dist < 20 + player.radius) {
          player.takeDamage();
        }
      }
    });
  }

  spawnShockwave(radius, gapAngle) {
    this.shockwaves.push({
      radius: 0,
      targetRadius: radius,
      gapAngle: gapAngle, // safe gap angle direction
      gapWidth: 1.1, // radians (~60 degrees)
      lineWidth: 8,
      speed: 160
    });
  }

  updateShockwaves(dt, player) {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.speed * dt * 2.2;
      
      // Collision check with player
      if (player.state !== 'DEAD') {
        const dist = getDistance(this.cx, this.cy, player.x, player.y);
        // Is player touching shockwave border
        if (Math.abs(dist - sw.radius) < 15) {
          if (sw.gapAngle === 0) {
            // WOW Attack: Shattered dimension has concentric waves with NO gap
            // The player must dash through it during invincibility (or time dash)
            // But let's leave a narrow gap or make it dashable
            player.takeDamage();
          } else {
            const playerAngle = Math.atan2(player.y - this.cy, player.x - this.cx);
            let diff = playerAngle - sw.gapAngle;
            
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            
            // If player is outside the safe gap width, hit!
            if (Math.abs(diff) > sw.gapWidth / 2) {
              player.takeDamage();
            }
          }
        }
      }
      
      if (sw.radius >= sw.targetRadius) {
        this.shockwaves.splice(i, 1);
      }
    }
  }

  updateSafeSlice(dt, player) {
    if (!this.sliceActive) return;
    
    // Expands outwards to player orbit
    this.sliceRadius = lerp(this.sliceRadius, 220, 3 * dt);
    
    // Slow heavy rotation
    this.sliceRotation += 0.3 * dt;
    
    // Collision checking
    if (this.sliceRadius > 190 && player.state !== 'DEAD' && this.state === 'ATTACK') {
      const dist = getDistance(this.cx, this.cy, player.x, player.y);
      if (Math.abs(dist - this.sliceRadius) < 20) {
        const playerAngle = Math.atan2(player.y - this.cy, player.x - this.cx);
        let diff = playerAngle - this.sliceRotation;
        
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        
        // 6 segments total (each 60 degrees = 1.047 rad)
        // Segment index [0, 5]
        const normalizedDiff = (diff + Math.PI) % (Math.PI * 2);
        const segmentIdx = Math.floor(normalizedDiff / (Math.PI / 3));
        
        // Let's declare Segment 0 as SAFE (which is opposite to rotation start)
        // If segmentIdx is not 0 (the safe slice), player takes damage!
        if (segmentIdx !== 0) {
          player.takeDamage();
        }
      }
    }
  }

  draw(ctx) {
    super.draw(ctx);
    
    // Draw shockwaves
    this.shockwaves.forEach(sw => {
      ctx.save();
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = sw.lineWidth;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ff00ff';
      
      if (sw.gapAngle === 0) {
        // Full circle shockwave
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Circle with gap
        ctx.beginPath();
        const start = sw.gapAngle + sw.gapWidth / 2;
        const end = sw.gapAngle + (Math.PI * 2) - sw.gapWidth / 2;
        ctx.arc(this.cx, this.cy, sw.radius, start, end);
        ctx.stroke();
        
        // Node markers at gap edges
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.cx + Math.cos(start) * sw.radius, this.cy + Math.sin(start) * sw.radius, 6, 0, Math.PI * 2);
        ctx.arc(this.cx + Math.cos(end) * sw.radius, this.cy + Math.sin(end) * sw.radius, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    
    // Draw Safe Slice segments (or telegraph warning)
    if (this.sliceActive || this.sliceWarning) {
      ctx.save();
      const radius = this.sliceWarning ? 220 : this.sliceRadius;
      ctx.lineWidth = this.sliceWarning ? 3 : 6;
      ctx.shadowBlur = this.sliceWarning ? 6 : 10;
      ctx.shadowColor = this.sliceWarning ? '#ff9d00' : '#ff00ff';
      
      const segmentsCount = 6;
      const arcWidth = Math.PI * 2 / segmentsCount;
      
      for (let i = 0; i < segmentsCount; i++) {
        const startAngle = this.sliceRotation + i * arcWidth;
        const endAngle = startAngle + arcWidth - 0.08; // gap spacing
        
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, radius, startAngle, endAngle);
        
        if (i === 0) {
          // Safe segment: dotted cyan helper indicator
          ctx.strokeStyle = this.sliceWarning ? 'rgba(0, 243, 255, 0.55)' : 'rgba(0, 243, 255, 0.4)';
          ctx.setLineDash([3, 6]);
          ctx.stroke();
        } else {
          // Dangerous segments
          ctx.strokeStyle = this.sliceWarning ? 'rgba(255, 157, 0, 0.45)' : '#ff00ff';
          if (this.sliceWarning) {
            ctx.setLineDash([6, 6]);
          } else {
            ctx.setLineDash([]);
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    
    // Draw Boomerangs
    this.boomerangs.forEach(b => {
      if (b.state === 'DONE') return;
      const bx = this.cx + Math.cos(b.angle) * b.dist;
      const by = this.cy + Math.sin(b.angle) * b.dist;
      
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(b.rot);
      
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00f3ff';
      
      // Draw spinning crystal cross (blades)
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(18, 0);
      ctx.moveTo(0, -18);
      ctx.lineTo(0, 18);
      ctx.stroke();
      
      // Center crystal diamond core
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    });
    
    // Draw Spears Charging indicators
    this.spears.forEach(s => {
      if (s.state === 'DONE') return;
      
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      
      // Draw indicator lines during telegraphing
      if (s.state === 'TELEGRAPH') {
        ctx.strokeStyle = 'rgba(255, 0, 255, 0.35)';
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(400, 0);
        ctx.stroke();
      }
      
      // Draw the crystal spear head
      ctx.fillStyle = '#ff00ff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff00ff';
      ctx.beginPath();
      ctx.moveTo(0, -s.radius / 2);
      ctx.lineTo(s.radius * 1.5, 0);
      ctx.lineTo(0, s.radius / 2);
      ctx.lineTo(-s.radius / 2, 0);
      ctx.closePath();
      ctx.fill();
      
      // Inner glowing core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(2, -3);
      ctx.lineTo(10, 0);
      ctx.lineTo(2, 3);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    });

    // --- Draw Screen cracks effect overlay ---
    if (this.isShattered) {
      // Shards flying screen cracks can be drawn on canvas if needed
      // (This will render directly over canvas area if cracks container exists, but adding canvas sparkles completes the vibe)
    }

    // --- Draw Main Crystal Titan Core ---
    ctx.save();
    
    const dynamicRadius = this.radius * this.visualScale;
    
    // Hit flash translate shake
    if (this.hitFlashTimer > 0) {
      ctx.translate((Math.random() * 2 - 1) * 3, (Math.random() * 2 - 1) * 3);
    }
    
    // Segmented orbiting tiny crystal shield nodes
    const orbitCount = this.orbitingCrystals;
    const time = Date.now() * 0.002;
    for (let i = 0; i < orbitCount; i++) {
      const angle = time + (Math.PI * 2 / orbitCount) * i;
      const ox = this.cx + Math.cos(angle) * (dynamicRadius + 22);
      const oy = this.titanY + Math.sin(angle) * (dynamicRadius + 22);
      
      ctx.save();
      ctx.fillStyle = '#ff00ff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff00ff';
      
      ctx.beginPath();
      ctx.moveTo(ox, oy - 6);
      ctx.lineTo(ox + 6, oy);
      ctx.lineTo(ox, oy + 6);
      ctx.lineTo(ox - 6, oy);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    
    // White flash on hit
    if (this.hitFlashTimer > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      // Draw polygonal diamond shape
      ctx.moveTo(this.cx, this.titanY - dynamicRadius);
      ctx.lineTo(this.cx + dynamicRadius * 1.1, this.titanY);
      ctx.lineTo(this.cx, this.titanY + dynamicRadius);
      ctx.lineTo(this.cx - dynamicRadius * 1.1, this.titanY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }
    
    // Draw Elegant Hexagonal Crystalline Core
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 4;
    ctx.fillStyle = '#0f0212';
    ctx.shadowBlur = dynamicRadius * 0.55;
    ctx.shadowColor = '#ff00ff';
    
    ctx.beginPath();
    // 6-sided crystal polygon shape
    for (let i = 0; i < 6; i++) {
      const angle = this.coreRotation + (Math.PI / 3) * i;
      const px = this.cx + Math.cos(angle) * dynamicRadius;
      const py = this.titanY + Math.sin(angle) * dynamicRadius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Internal geometric crystal lattice lines
    ctx.strokeStyle = 'rgba(255, 0, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = this.coreRotation + (Math.PI / 3) * i;
      const px = this.cx + Math.cos(angle) * dynamicRadius;
      const py = this.titanY + Math.sin(angle) * dynamicRadius;
      ctx.moveTo(this.cx, this.titanY);
      ctx.lineTo(px, py);
      
      // Connect to adjacent
      const nextAngle = this.coreRotation + (Math.PI / 3) * ((i + 2) % 6);
      const nx = this.cx + Math.cos(nextAngle) * dynamicRadius;
      const ny = this.titanY + Math.sin(nextAngle) * dynamicRadius;
      ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
    }
    ctx.stroke();
    
    // Inner glowing crystal shard center
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(this.cx, this.titanY - dynamicRadius * 0.35);
    ctx.lineTo(this.cx + dynamicRadius * 0.3, this.titanY);
    ctx.lineTo(this.cx, this.titanY + dynamicRadius * 0.35);
    ctx.lineTo(this.cx - dynamicRadius * 0.3, this.titanY);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }
}
