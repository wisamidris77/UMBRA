/**
 * ==========================================================================
 * ORBITAL BOUND: Boss Rush - Boss 3: The Clockwork Conductor
 * ==========================================================================
 */

import { Boss } from './boss.js';
import { lerp, clamp, getDistance, checkCircleLineCollision } from '../utils.js';
import { particles } from '../particle.js';

export class ClockworkConductor extends Boss {
  constructor(cx, cy) {
    super(cx, cy, 'THE CLOCKWORK CONDUCTOR', '#ffd700');
    
    // Custom Conductor visuals
    this.pendulumAngle = 0;
    this.pendulumDirection = 1;
    this.gearRotation = 0;
    
    // Metronome Sweeps (twin sweeping lasers)
    this.metronomeActive = false;
    this.metronomeBaseAngle = 0;
    this.metronomeSweeps = []; // { angle: 0, targetAngle: 0 }
    
    // Note Barrage
    this.notes = [];
    
    // Tempo Shift
    this.tempoShiftActive = false;
    this.tempoFactor = 1.0;
    
    // Grand Finale Staves
    this.stavesActive = false;
    this.staves = []; // Concentric circular staves
    
    // Sequences
    this.phase1Sequence = [
      'METRONOME_SWEEPS', 'RECOVERY',
      'NOTE_BARRAGE', 'RECOVERY',
      'TEMPO_SHIFT', 'RECOVERY'
    ];
    
    this.phase2Sequence = [
      'METRONOME_SWEEPS', 'RECOVERY',
      'NOTE_BARRAGE', 'RECOVERY',
      'TEMPO_SHIFT', 'RECOVERY',
      'COMBINED_NOTE_SWEEPS', 'RECOVERY'
    ];
    
    this.finalSequence = [
      'WOW_GRAND_FINALE', 'RECOVERY',
      'COMBINED_NOTE_SWEEPS', 'RECOVERY',
      'TEMPO_SHIFT', 'RECOVERY'
    ];
    
    this.activeSequence = this.phase1Sequence;
    this.targetAttack = 'IDLE';
    this.recoveryDuration = 2.0;
    
    this.reset();
  }

  reset() {
    super.reset();
    this.pendulumAngle = 0;
    this.pendulumDirection = 1;
    this.gearRotation = 0;
    
    this.metronomeActive = false;
    this.metronomeBaseAngle = 0;
    this.metronomeSweeps = [];
    this.notes = [];
    this.tempoShiftActive = false;
    this.tempoFactor = 1.0;
    this.stavesActive = false;
    this.staves = [];
    
    this.activeSequence = this.phase1Sequence;
    this.targetAttack = 'IDLE';
    this.state = 'IDLE';
    this.stateTimer = 1.5;
    this.sequenceIndex = 0;
  }

  checkPhaseTransitions() {
    if (this.phase === 1 && this.hp < 65) {
      this.triggerPhaseTransition(2, "GEARS OVERHEATING: PHASE 2");
      this.activeSequence = this.phase2Sequence;
      this.sequenceIndex = 0;
    } else if (this.phase === 2 && this.hp < 35) {
      this.triggerPhaseTransition(3, "ABSOLUTE TEMPO: FINAL PHASE");
      this.activeSequence = this.finalSequence;
      this.sequenceIndex = 0;
    }
  }

  update(dt, player) {
    super.update(dt, player);
    
    // Constant background gear rotation
    this.gearRotation += 0.8 * dt;
    
    // Pendulum arm swings back and forth in sync with beat
    // Standard oscillation using sine wave
    this.pendulumAngle = Math.sin(Date.now() * 0.006) * 0.6;
    
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
    
    // Update active custom sub-projectiles
    this.updateNotes(dt, player);
    this.updateStaves(dt, player);
    this.updateTempoShift(player);
    
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
      case 'METRONOME_SWEEPS':
        this.stateTimer = 1.0; // 1s warning
        this.metronomeActive = false;
        // Metronome lasers spawn pointing down-left and down-right
        this.metronomeSweeps = [
          { angle: Math.PI / 4, baseAngle: Math.PI / 4 },
          { angle: 3 * Math.PI / 4, baseAngle: 3 * Math.PI / 4 }
        ];
        if (banner) {
          banner.textContent = "METRONOME BEAM LOCK";
          banner.style.color = '#ffd700';
          banner.style.textShadow = '0 0 10px #ffd700';
          banner.classList.add('active');
        }
        break;
        
      case 'NOTE_BARRAGE':
        this.stateTimer = 0.8;
        if (banner) {
          banner.textContent = "OCTAVE RESONANCE";
          banner.style.color = '#ff9d00';
          banner.style.textShadow = '0 0 10px #ff9d00';
          banner.classList.add('active');
        }
        break;
        
      case 'TEMPO_SHIFT':
        this.stateTimer = 1.0;
        this.tempoShiftActive = true;
        // Randomly choose faster or slower
        this.tempoFactor = Math.random() < 0.5 ? 1.8 : 0.5;
        if (banner) {
          banner.textContent = this.tempoFactor > 1.0 ? "⚠️ TEMPO ACCELERANDO ⚠️" : "⚠️ TEMPO RITARDANDO ⚠️";
          banner.style.color = '#00f3ff';
          banner.style.textShadow = '0 0 10px #00f3ff';
          banner.classList.add('active');
        }
        break;
        
      case 'COMBINED_NOTE_SWEEPS':
        this.stateTimer = 1.0;
        this.metronomeSweeps = [
          { angle: Math.PI / 4, baseAngle: Math.PI / 4 },
          { angle: 3 * Math.PI / 4, baseAngle: 3 * Math.PI / 4 }
        ];
        this.spawnNoteWave(4);
        if (banner) {
          banner.textContent = "CONCERT OVERDRIVE";
          banner.style.color = '#ff00ff';
          banner.style.textShadow = '0 0 10px #ff00ff';
          banner.classList.add('active');
        }
        break;

      case 'WOW_GRAND_FINALE':
        this.stateTimer = 1.5; // Long warning
        this.stavesActive = true;
        this.staves = [
          { radius: 150, angle: 0, gapAngle: Math.random() * Math.PI * 2, speed: 0.8 },
          { radius: 230, angle: 0, gapAngle: Math.random() * Math.PI * 2, speed: -0.6 }
        ];
        if (banner) {
          banner.textContent = "🎼 GRAND FINALE: METRIC SHIFT 🎼";
          banner.style.color = '#ffd700';
          banner.style.textShadow = '0 0 15px #ffd700';
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
      case 'METRONOME_SWEEPS':
        this.stateTimer = 3.0; // sweep for 3 seconds
        this.metronomeActive = true;
        break;
        
      case 'NOTE_BARRAGE':
        this.stateTimer = 4.0;
        this.spawnNoteWave(6);
        break;
        
      case 'TEMPO_SHIFT':
        this.stateTimer = 4.0;
        break;
        
      case 'COMBINED_NOTE_SWEEPS':
        this.stateTimer = 3.5;
        this.metronomeActive = true;
        break;
        
      case 'WOW_GRAND_FINALE':
        this.stateTimer = 5.0; // Staves active for 5 seconds
        break;
    }
  }

  processAttack(dt, player) {
    switch (this.targetAttack) {
      case 'METRONOME_SWEEPS':
      case 'COMBINED_NOTE_SWEEPS':
        // Metronome lasers swing left and right in sync with time
        // angle oscillates around their base starting angles
        const timeFactor = Date.now() * 0.0035;
        this.metronomeSweeps.forEach(sweep => {
          sweep.angle = sweep.baseAngle + Math.sin(timeFactor) * 0.7;
          
          // Collision checks
          if (player.state !== 'DEAD') {
            const lx2 = this.cx + Math.cos(sweep.angle) * 500;
            const ly2 = this.cy + Math.sin(sweep.angle) * 500;
            
            if (checkCircleLineCollision(player.x, player.y, player.radius, this.cx, this.cy, lx2, ly2)) {
              player.takeDamage();
            }
          }
        });
        break;
    }
  }

  finishAttack() {
    this.metronomeActive = false;
    this.metronomeSweeps = [];
    this.stavesActive = false;
    this.staves = [];
    this.tempoShiftActive = false;
    this.tempoFactor = 1.0;
    
    this.state = 'RECOVERY';
    this.stateTimer = this.recoveryDuration;
  }

  spawnNoteWave(count) {
    this.notes = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      this.notes.push({
        angle: angle,
        dist: 40,
        targetDist: 220, // player orbit
        state: 'OUT',
        pauseTimer: 1.0, // stays at orbit path for 1 second
        radius: 12
      });
    }
  }

  updateNotes(dt, player) {
    this.notes.forEach(n => {
      if (n.state === 'OUT') {
        n.dist = lerp(n.dist, n.targetDist, 5 * dt);
        if (Math.abs(n.dist - n.targetDist) < 10) {
          n.state = 'PAUSE';
        }
      } else if (n.state === 'PAUSE') {
        n.pauseTimer -= dt;
        if (n.pauseTimer <= 0) {
          n.state = 'RETURN';
        }
      } else if (n.state === 'RETURN') {
        n.dist = lerp(n.dist, 0, 4 * dt);
        if (n.dist < 20) {
          n.state = 'DONE';
        }
      }
      
      // Collision check
      if (n.state !== 'DONE' && player.state !== 'DEAD') {
        const nx = this.cx + Math.cos(n.angle) * n.dist;
        const ny = this.cy + Math.sin(n.angle) * n.dist;
        const dist = getDistance(nx, ny, player.x, player.y);
        
        if (dist < n.radius + player.radius) {
          player.takeDamage();
          n.state = 'DONE';
          particles.spawnExplosion(nx, ny, '#ff9d00', 8, 3);
        }
      }
    });
  }

  updateTempoShift(player) {
    if (!this.tempoShiftActive || this.state !== 'ATTACK') {
      return;
    }
    // Modify player orbit speed factor dynamically!
    // This temporarily overrides player's orbit speed multipliers
    if (player && player.state === 'ORBITING') {
      // Apply tempo factor (speed up or slow down)
      player.theta += player.orbitDir * player.orbitSpeed * (this.tempoFactor - 1.0) * 0.016; // apply modifier differential
    }
  }

  updateStaves(dt, player) {
    if (!this.stavesActive) return;
    
    this.staves.forEach(st => {
      // Rotate the stave circle
      st.gapAngle += st.speed * dt;
      
      // Check collision
      if (this.state === 'ATTACK' && player.state !== 'DEAD') {
        const dist = getDistance(this.cx, this.cy, player.x, player.y);
        
        // Touch stave radius
        if (Math.abs(dist - st.radius) < 15) {
          const playerAngle = Math.atan2(player.y - this.cy, player.x - this.cx);
          let diff = playerAngle - st.gapAngle;
          
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          
          // 60-degree safe opening (1.04 rad)
          if (Math.abs(diff) > 0.52) {
            player.takeDamage();
          }
        }
      }
    });
  }

  draw(ctx) {
    super.draw(ctx);
    
    // Draw concentric staves (Grand Finale)
    if (this.stavesActive) {
      this.staves.forEach(st => {
        ctx.save();
        // Warn vs Solid
        ctx.strokeStyle = this.state === 'TELEGRAPH' ? 'rgba(255, 215, 0, 0.45)' : '#ffd700';
        ctx.lineWidth = this.state === 'TELEGRAPH' ? 3 : 8;
        ctx.shadowBlur = this.state === 'TELEGRAPH' ? 6 : 12;
        ctx.shadowColor = '#ffd700';
        if (this.state === 'TELEGRAPH') {
          ctx.setLineDash([6, 8]);
        }
        
        // Circular arc with gap
        const gapHalfAngle = 0.52;
        const start = st.gapAngle + gapHalfAngle;
        const end = st.gapAngle + (Math.PI * 2) - gapHalfAngle;
        
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, st.radius, start, end);
        ctx.stroke();
        
        // Glowing ends
        ctx.fillStyle = this.state === 'TELEGRAPH' ? '#ff9d00' : '#ffffff';
        ctx.beginPath();
        ctx.arc(this.cx + Math.cos(start) * st.radius, this.cy + Math.sin(start) * st.radius, 6, 0, Math.PI * 2);
        ctx.arc(this.cx + Math.cos(end) * st.radius, this.cy + Math.sin(end) * st.radius, 6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      });
    }
    
    // Draw Metronome warning lines / active lasers
    if (this.metronomeSweeps.length > 0) {
      this.metronomeSweeps.forEach(sweep => {
        ctx.save();
        if (this.metronomeActive) {
          // Solid laser
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 10;
          ctx.shadowBlur = 18;
          ctx.shadowColor = '#ffd700';
          ctx.beginPath();
          ctx.moveTo(this.cx, this.cy);
          ctx.lineTo(this.cx + Math.cos(sweep.angle) * 500, this.cy + Math.sin(sweep.angle) * 500);
          ctx.stroke();
          
          // White core
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(this.cx, this.cy);
          ctx.lineTo(this.cx + Math.cos(sweep.angle) * 500, this.cy + Math.sin(sweep.angle) * 500);
          ctx.stroke();
        } else {
          // Warning dashed line
          ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(this.cx, this.cy);
          ctx.lineTo(this.cx + Math.cos(sweep.angle) * 500, this.cy + Math.sin(sweep.angle) * 500);
          ctx.stroke();
        }
        ctx.restore();
      });
    }
    
    // Draw Musical Notes (eighth notes)
    this.notes.forEach(n => {
      if (n.state === 'DONE') return;
      const nx = this.cx + Math.cos(n.angle) * n.dist;
      const ny = this.cy + Math.sin(n.angle) * n.dist;
      
      ctx.save();
      ctx.translate(nx, ny);
      ctx.rotate(n.angle + Math.PI / 2);
      
      ctx.fillStyle = '#ff9d00';
      ctx.strokeStyle = '#ff9d00';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ff9d00';
      
      // Draw eighth note shape
      ctx.beginPath();
      ctx.arc(-4, 4, 6, 0, Math.PI * 2); // left circle
      ctx.arc(4, 4, 6, 0, Math.PI * 2); // right circle
      ctx.fill();
      
      // Stems
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.lineTo(-2, -12);
      ctx.moveTo(6, 0);
      ctx.lineTo(6, -12);
      // Beam
      ctx.moveTo(-2, -12);
      ctx.lineTo(6, -12);
      ctx.stroke();
      
      ctx.restore();
    });
    
    // Draw Tempo Shift Clock face reference on center
    if (this.tempoShiftActive && this.state === 'ATTACK') {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.15)';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00f3ff';
      ctx.setLineDash([5, 15]);
      
      // Draw spinning clock outline
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, 100, 0, Math.PI * 2);
      ctx.stroke();
      
      // Hand indicators
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.25)';
      ctx.setLineDash([]);
      ctx.lineWidth = 3;
      const handAngle = Date.now() * (this.tempoFactor > 1.0 ? 0.005 : 0.001);
      ctx.beginPath();
      ctx.moveTo(this.cx, this.cy);
      ctx.lineTo(this.cx + Math.cos(handAngle) * 60, this.cy + Math.sin(handAngle) * 60);
      ctx.moveTo(this.cx, this.cy);
      ctx.lineTo(this.cx + Math.cos(handAngle * 0.1) * 40, this.cy + Math.sin(handAngle * 0.1) * 40);
      ctx.stroke();
      
      ctx.restore();
    }
    
    // --- Draw Main Clockwork Conductor Core ---
    ctx.save();
    
    const dynamicRadius = this.radius * this.visualScale;
    
    // Hit flash translation shake
    if (this.hitFlashTimer > 0) {
      ctx.translate((Math.random() * 2 - 1) * 3, (Math.random() * 2 - 1) * 3);
    }
    
    // Draw Metronome Pendulum Arm (behind the core)
    ctx.save();
    ctx.strokeStyle = '#c5a300';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(this.cx, this.cy);
    // Pendulum points upwards
    const armLen = dynamicRadius + 45;
    const px = this.cx + Math.sin(this.pendulumAngle) * armLen;
    const py = this.cy - Math.cos(this.pendulumAngle) * armLen;
    ctx.lineTo(px, py);
    ctx.stroke();
    
    // Pendulum weight diamond
    ctx.fillStyle = '#ffd700';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(px, py - 8);
    ctx.lineTo(px + 8, py);
    ctx.lineTo(px, py + 8);
    ctx.lineTo(px - 8, py);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    
    // White hit flash
    if (this.hitFlashTimer > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, dynamicRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    
    // Draw Main Clockwork Gear Core
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(this.gearRotation);
    
    ctx.fillStyle = '#1a1803';
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 4;
    ctx.shadowBlur = dynamicRadius * 0.5;
    ctx.shadowColor = '#ffd700';
    
    // Draw Gear teeth
    const teethCount = 8;
    ctx.beginPath();
    for (let i = 0; i < teethCount * 2; i++) {
      const angle = (Math.PI * 2 / (teethCount * 2)) * i;
      const r = i % 2 === 0 ? dynamicRadius : dynamicRadius - 10;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Inner gear holes/rings
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, dynamicRadius - 20, 0, Math.PI * 2);
    ctx.stroke();
    
    // Gear spokes
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 2) * i;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * (dynamicRadius - 10), Math.sin(angle) * (dynamicRadius - 10));
    }
    ctx.stroke();
    
    // Inner center cap
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
    ctx.restore();
  }
}
