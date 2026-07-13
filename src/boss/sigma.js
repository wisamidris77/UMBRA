import { Boss } from './boss.js';
import { audio } from '../audio.js';
import { particles, screenShake } from '../particle.js';
import { checkCircleLineCollision } from '../utils.js';

class SigmaWave {
  constructor(x, y, radius, speed, width, color) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.speed = speed;
    this.width = width;
    this.color = color;
    this.active = true;
    this.type = 'WAVE';
    
    // Create a generous 115-degree gap (2.0 radians) so the player can rotate to dodge it easily
    this.gapAngle = Math.random() * Math.PI * 2;
    this.gapSize = 2.0; 
    this.skipCollision = true; // Handled manually by Sigma class
  }
  
  update(dt) {
    this.radius += this.speed * dt;
    if (this.radius > 800) {
      this.active = false;
    }
  }
  
  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width;
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;
    
    // Draw gapped ring
    const startAngle = this.gapAngle + this.gapSize / 2;
    const endAngle = this.gapAngle + Math.PI * 2 - this.gapSize / 2;
    
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, startAngle, endAngle);
    ctx.stroke();
    
    // Draw warning end-points on the gap edges
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x + Math.cos(startAngle) * this.radius, this.y + Math.sin(startAngle) * this.radius, this.width / 2 + 2, 0, Math.PI * 2);
    ctx.arc(this.x + Math.cos(endAngle) * this.radius, this.y + Math.sin(endAngle) * this.radius, this.width / 2 + 2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}

export class Sigma extends Boss {
  constructor(cx, cy) {
    super(cx, cy, "SIGMA: THE OVERLORD", '#00ff00');
    this.phaseMaxHps = [120, 180, 200, 220, 250];
    this.maxHp = this.phaseMaxHps[0];
    this.hp = this.maxHp;
    this.baseRadius = 40;
    
    // 5 Phases configuration
    this.phaseColors = ['#00ff00', '#00ffff', '#ffd700', '#ff00ff', '#ff0000'];
    this.color = this.phaseColors[0];
    
    this.leftHand = { x: 0, y: 0, angle: 0, targetX: 0, targetY: 0 };
    this.rightHand = { x: 0, y: 0, angle: 0, targetX: 0, targetY: 0 };
    
    this.isHoldingPlayer = false;
    this.grabAngle = 0;
    
    // New mechanics variables
    this.gravityFlicker = false;
    
    // Attack A: Triple Slam Descent
    this.tripleSlamActive = false;
    this.tripleSlamCount = 0;
    this.tripleSlamLungeX = 0;
    this.tripleSlamLungeY = 0;
    this.tripleSlamAngle = 0;
    this.tripleSlamStage = 'TELEGRAPH'; // 'TELEGRAPH', 'SLAM', 'RECOVERY'
    this.tripleSlamParried = false;
    
    // Attack B: Orbital Sweep
    this.orbitalSweepActive = false;
    this.orbitalSweepAngle = 0;
    this.orbitalSweepProgress = 0;
    this.orbitalSweepLungeX = 0;
    this.orbitalSweepLungeY = 0;
    this.orbitalSweepParried = false;
    this.orbitalSweepStage = 'TELEGRAPH'; // 'TELEGRAPH', 'SWEEP'
    
    // Attack C: Giga Slam Quake
    this.gigaSlamActive = false;
    this.gigaSlamStage = 'CHARGE'; // 'CHARGE', 'SLAM', 'STUN'
    this.gigaSlamLungeY = 0;
    this.gigaSlamParried = false;
    
    // Existing attacks
    this.chinSlamAngle = 0;
    this.chinSlamStage = 'TELEGRAPH';
    this.chinSlamLungeX = 0;
    this.chinSlamLungeY = 0;
    this.chinSlamParried = false;
    
    // Pupil tracking offsets
    this.pupilX = 0;
    this.pupilY = 0;
    
    this.activeAttackCleanup = () => {
      this.isHoldingPlayer = false;
      this.gravityFlicker = false;
      this.tripleSlamActive = false;
      this.tripleSlamLungeX = 0;
      this.tripleSlamLungeY = 0;
      this.orbitalSweepActive = false;
      this.orbitalSweepLungeX = 0;
      this.orbitalSweepLungeY = 0;
      this.gigaSlamActive = false;
      this.gigaSlamLungeY = 0;
      this.chinSlamLungeX = 0;
      this.chinSlamLungeY = 0;
      this.isVulnerable = true;
      
      // Dynamic fling back player to safe outer orbit on release!
      const player = window.gameAppInstance?.player;
      if (player) {
        player.orbitRadius = player.defaultOrbitRadius + 40; // Fling to outer orbit (290)
      }
    };
    
    // Sequences
    this.phase1Sequence = ['CHIN_WAVES', 'EYE_LASER'];
    this.phase2Sequence = ['CHIN_WAVES', 'CLAP', 'TRIPLE_SLAM_DESCENT'];
    this.phase3Sequence = ['CHIN_SLAM', 'GIGA_GRASP', 'TRIPLE_SLAM_DESCENT'];
    this.phase4Sequence = ['GRAVITY_FLIP', 'ORBITAL_SWEEP', 'CHIN_SLAM'];
    this.phase5Sequence = ['GIGA_SLAM_QUAKE', 'ORBITAL_SWEEP', 'GIGA_GRASP', 'GRAVITY_FLIP'];
    
    this.activeSequence = this.phase1Sequence;
    
    // Give player a 3-second cooldown buffer at start of the match to get ready
    this.state = 'RECOVERY';
    this.stateTimer = 3.0;
  }

  reset() {
    super.reset();
    if (this.phaseMaxHps) {
      this.maxHp = this.phaseMaxHps[0];
      this.hp = this.maxHp;
    }
  }

  takeDamage(amount) {
    const wasHolding = this.isHoldingPlayer;
    super.takeDamage(amount);
    if (wasHolding && this.state !== 'DEAD' && this.state !== 'TRANSITION') {
        this.isHoldingPlayer = false;
        this.targetAttack = null;
        this.state = 'RECOVERY';
        this.stateTimer = 1.0;
        
        // Fling player back to outer orbit
        const player = window.gameAppInstance?.player;
        if (player) {
          player.orbitRadius = player.defaultOrbitRadius + 40;
          player.updatePosition();
        }
        
        screenShake.trigger(20, 0.4);
        particles.spawnExplosion(this.cx, this.cy, '#ffffff', 20, 5);
        audio.playHit();
    }
  }

  checkPhaseTransitions() {
    // Sigma has 5 phases with escalating health pools.
    if (this.hp <= 0 && this.phase < 5) {
      this.phase++;
      this.maxHp = this.phaseMaxHps[this.phase - 1];
      this.hp = this.maxHp;
      this.color = this.phaseColors[this.phase - 1];
      
      this.triggerPhaseTransition(this.phase);
      
      if (this.phase === 2) this.activeSequence = this.phase2Sequence;
      if (this.phase === 3) {
        this.activeSequence = this.phase3Sequence;
        // Crossfade to level 6 soundtrack for Phase 3! (115 BPM sync, 2.5s fade)
        audio.crossfadeTrack('soundtracks/level6.mp3', 115, 2.5);
      }
      if (this.phase === 4) {
        this.activeSequence = this.phase4Sequence;
        // Crossfade to level 7 soundtrack for Phase 4 & 5! (120 BPM sync, 2.5s fade)
        audio.crossfadeTrack('soundtracks/level7.mp3', 120, 2.5);
      }
      if (this.phase === 5) this.activeSequence = this.phase5Sequence;
      
      this.recoveryDuration = Math.max(0.8, 2.0 - (this.phase * 0.2));
    }
  }

  initiateAttack(attackName) {
    this.targetAttack = attackName;
    this.state = 'ATTACK';
    this.telegraphBeepPlayed = false;
    
    // Spawn warning text banner
    const banner = document.getElementById('warning-banner');
    if (banner) {
      banner.textContent = attackName.replace('_', ' ');
      banner.style.color = this.color;
      banner.style.textShadow = `0 0 10px ${this.color}`;
      banner.classList.add('active');
      setTimeout(() => banner.classList.remove('active'), 1000);
    }
    
    if (attackName === 'CHIN_WAVES') {
      this.maxWaves = this.phase; // 1 to 5 waves depending on phase
      this.stateTimer = 1.0 + (this.maxWaves * 0.8); // Dynamic duration
      this.waveTimer = 1.0; // 1s telegraph for the first wave
      this.wavesFired = 0;
      
      // Pre-calculate gap angles relative to player's angle (close to player for quick access)
      const playerAngle = window.gameAppInstance ? window.gameAppInstance.player.theta : 0;
      this.waveGaps = [];
      for (let i = 0; i < this.maxWaves; i++) {
        // Alternate gap left/right of the player (between 30 and 45 degrees offset)
        const shift = (i % 2 === 0 ? 0.6 : -0.6) + (Math.random() * 0.2 - 0.1);
        this.waveGaps.push(playerAngle + shift);
      }
      audio.playWarningBeep();
    } 
    else if (attackName === 'EYE_LASER') {
      this.stateTimer = 2.0;
      this.laserAngle = window.gameAppInstance ? window.gameAppInstance.player.theta : 0;
      this.laserFired = false;
    }
    else if (attackName === 'CLAP') {
      this.stateTimer = 1.5;
      this.clapAngle = window.gameAppInstance ? window.gameAppInstance.player.theta : 0; // Target angle where hands will clap
      this.hasClapped = false;
    }
    else if (attackName === 'GIGA_GRASP') {
      this.stateTimer = 4.0; // Total grasp sequence (1s reach, 3s hold)
      this.grabAngle = window.gameAppInstance ? window.gameAppInstance.player.theta : 0;
      this.isHoldingPlayer = false;
      this.grabFailed = false;
    }
    else if (attackName === 'CHIN_SLAM') {
      this.stateTimer = 2.9; // 1.5s telegraph, 0.8s lunge, 0.6s recovery
      this.chinSlamAngle = window.gameAppInstance ? window.gameAppInstance.player.theta : 0;
      this.chinSlamStage = 'TELEGRAPH';
      this.chinSlamLungeX = 0;
      this.chinSlamLungeY = 0;
      this.chinSlamParried = false;
      audio.playWarningBeep();
    }
    else if (attackName === 'TRIPLE_SLAM_DESCENT') {
      this.stateTimer = 7.0; // Longer attack sequence to cover three slams
      this.tripleSlamActive = true;
      this.tripleSlamCount = 0;
      this.tripleSlamLungeX = 0;
      this.tripleSlamLungeY = 0;
      this.tripleSlamParried = false;
      this.tripleSlamStage = 'TELEGRAPH';
      this.tripleSlamAngle = window.gameAppInstance ? window.gameAppInstance.player.theta : 0;
      this.waveTimer = 1.6; // generous warning time before first slam
      audio.playWarningBeep();
    }
    else if (attackName === 'ORBITAL_SWEEP') {
      this.stateTimer = 3.8; // warning + sweep + finish
      this.orbitalSweepActive = true;
      this.orbitalSweepAngle = window.gameAppInstance ? window.gameAppInstance.player.theta : 0;
      this.orbitalSweepProgress = 0;
      this.orbitalSweepLungeX = 0;
      this.orbitalSweepLungeY = 0;
      this.orbitalSweepParried = false;
      this.orbitalSweepStage = 'TELEGRAPH';
      this.waveTimer = 1.6; // generous warning time before sweep
      audio.playWarningBeep();
    }
    else if (attackName === 'GRAVITY_FLIP') {
      this.stateTimer = 4.5;
      this.gravityFlicker = true;
      audio.playWarningBeep();
      const banner = document.getElementById('warning-banner');
      if (banner) {
        banner.textContent = "GRAVITY DISTORTION";
        banner.style.color = '#ff00ff';
        banner.classList.add('active');
      }
    }
    else if (attackName === 'GIGA_SLAM_QUAKE') {
      this.stateTimer = 4.8;
      this.gigaSlamActive = true;
      this.gigaSlamStage = 'CHARGE';
      this.gigaSlamLungeY = 0;
      this.gigaSlamParried = false;
      this.waveTimer = 2.0; // generous warning time for center crash
      audio.playWarningBeep();
    }
  }

  finishAttack() {
    this.state = 'RECOVERY';
    this.stateTimer = this.recoveryDuration;
    this.isHoldingPlayer = false;
    
    const banner = document.getElementById('warning-banner');
    if (banner) banner.classList.remove('active');
  }

  updateAttack(dt, player) {
    if (this.targetAttack === 'CHIN_WAVES') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0 && this.wavesFired < this.maxWaves) {
        const gapAngle = this.waveGaps[this.wavesFired];
        const speed = 150 + (this.phase * 15);
        const width = 8 + (this.phase * 2);
        
        // Spawn wave with pre-calculated gap
        const wave = new SigmaWave(this.cx, this.cy, this.baseRadius, speed, width, this.color);
        wave.gapAngle = gapAngle;
        this.bullets.push(wave);
        
        this.wavesFired++;
        audio.playWaveSpawn();
        
        // Set warning delay for the next wave
        if (this.wavesFired < this.maxWaves) {
          this.waveTimer = 0.8;
          audio.playWarningBeep();
        }
      }
      
      if (this.stateTimer <= 0) {
        this.finishAttack();
      }
    } 
    else if (this.targetAttack === 'EYE_LASER') {
      // 1 second telegraph, 1 second fire
      if (this.stateTimer <= 1.0 && !this.laserFired) {
        this.laserFired = true;
        audio.playLaserStart();
        screenShake.trigger(10, 0.5);
      }
      
      if (this.laserFired) {
        // Laser hitbox
        const endX = this.cx + Math.cos(this.laserAngle) * 1000;
        const endY = this.cy + Math.sin(this.laserAngle) * 1000;
        if (checkCircleLineCollision(player, this.cx, this.cy, endX, endY, 15)) {
          player.takeDamage();
        }
      }
      
      if (this.stateTimer <= 0) {
        this.finishAttack();
      }
    }
    else if (this.targetAttack === 'CLAP') {
      if (this.stateTimer <= 0.5 && !this.hasClapped) {
        this.hasClapped = true;
        screenShake.trigger(25, 0.3);
        audio.playBossExplode(); // Heavy hit sound
        particles.spawnExplosion(
          this.cx + Math.cos(this.clapAngle) * 120, 
          this.cy + Math.sin(this.clapAngle) * 120, 
          this.color, 30, 6
        );
        
        // Clap hitbox
        const clapDist = Math.hypot(player.x - this.cx, player.y - this.cy);
        let angDiff = Math.abs(player.theta - this.clapAngle);
        while (angDiff > Math.PI) angDiff -= Math.PI * 2;
        angDiff = Math.abs(angDiff);
        
        if (angDiff < 0.4 && clapDist > 60 && clapDist < 200) {
          player.takeDamage();
        }
      }
      
      if (this.stateTimer <= 0) {
        this.finishAttack();
      }
    }
    else if (this.targetAttack === 'GIGA_GRASP') {
      if (this.stateTimer > 3.0) {
        // 1 second reach telegraph
        this.grabAngle = player.theta;
      } else if (this.stateTimer <= 3.0 && this.stateTimer > 0 && !this.grabFailed) {
        // GRASP HOLD FOR 3 SECONDS
        if (!this.isHoldingPlayer) {
          this.isHoldingPlayer = true;
          screenShake.trigger(15, 0.2);
          audio.playHit();
        }
        
        // Pin player position
        if (player.state !== 'DASHING') {
          player.theta = this.grabAngle;
          player.orbitRadius = 120; // Hold them in front of Sigma
          player.updatePosition();
          player.chargePercent = 0; // Prevent normal charge? No, let them charge to dash!
        }
        
      } else if (this.stateTimer <= 0 && !this.grabFailed) {
        // Player failed to hit in 3 seconds! FIRE THE FATAL LASER
        this.grabFailed = true;
        this.isHoldingPlayer = false;
        audio.playLaserStart();
        screenShake.trigger(40, 1.0);
        player.takeDamage();
        player.takeDamage(); // Huge damage
        this.finishAttack();
      }
    }
    else if (this.targetAttack === 'CHIN_SLAM') {
      if (this.chinSlamParried) {
        this.finishAttack();
        return;
      }
      
      if (this.stateTimer > 1.4) {
        // Telegraph phase
        this.chinSlamStage = 'TELEGRAPH';
        this.leftHand.targetX = this.cx - Math.cos(this.chinSlamAngle) * 40 - Math.sin(this.chinSlamAngle) * 50;
        this.leftHand.targetY = this.cy - Math.sin(this.chinSlamAngle) * 40 + Math.cos(this.chinSlamAngle) * 50;
        this.rightHand.targetX = this.cx - Math.cos(this.chinSlamAngle) * 40 + Math.sin(this.chinSlamAngle) * 50;
        this.rightHand.targetY = this.cy - Math.sin(this.chinSlamAngle) * 40 - Math.cos(this.chinSlamAngle) * 50;
      } 
      else if (this.stateTimer <= 1.4 && this.stateTimer > 0.6) {
        // SLAM LUNGE phase
        if (this.chinSlamStage !== 'SLAM') {
          this.chinSlamStage = 'SLAM';
          audio.playBossExplode();
        }
        
        const prog = (1.4 - this.stateTimer) / 0.8;
        const dist = 160 * Math.sin(prog * Math.PI);
        this.chinSlamLungeX = Math.cos(this.chinSlamAngle) * dist;
        this.chinSlamLungeY = Math.sin(this.chinSlamAngle) * dist;
        
        this.leftHand.targetX = this.cx + this.chinSlamLungeX + Math.cos(this.chinSlamAngle - 0.4) * 30;
        this.leftHand.targetY = this.cy + this.chinSlamLungeY + Math.sin(this.chinSlamAngle - 0.4) * 30;
        this.rightHand.targetX = this.cx + this.chinSlamLungeX + Math.cos(this.chinSlamAngle + 0.4) * 30;
        this.rightHand.targetY = this.cy + this.chinSlamLungeY + Math.sin(this.chinSlamAngle + 0.4) * 30;
        
        // Parry check
        if (player.state === 'DASHING') {
          const bossActualX = this.cx + this.chinSlamLungeX;
          const bossActualY = this.cy + this.chinSlamLungeY;
          const distance = Math.hypot(player.x - bossActualX, player.y - bossActualY);
          
          if (distance < this.baseRadius + player.radius + 15) {
            this.chinSlamParried = true;
            super.takeDamage(4);
            screenShake.trigger(35, 0.5);
            audio.playBossExplode();
            particles.spawnExplosion(bossActualX, bossActualY, '#ffffff', 40, 10);
            
            this.state = 'RECOVERY';
            this.stateTimer = 1.8;
            const banner = document.getElementById('warning-banner');
            if (banner) {
              banner.textContent = "PARRIED!";
              banner.style.color = '#39ff14';
              banner.classList.add('active');
              setTimeout(() => banner.classList.remove('active'), 1000);
            }
            return;
          }
        }
        
        // Normal hit check
        const bossActualX = this.cx + this.chinSlamLungeX;
        const bossActualY = this.cy + this.chinSlamLungeY;
        const distToPlayer = Math.hypot(player.x - bossActualX, player.y - bossActualY);
        
        if (distToPlayer < this.baseRadius + player.radius) {
          if (player.state !== 'DASHING' && player.state !== 'DEAD') {
            player.takeDamage();
          }
        }
      }
      else {
        this.chinSlamStage = 'RECOVERY';
        this.chinSlamLungeX *= 0.8;
        this.chinSlamLungeY *= 0.8;
      }
      
      if (this.stateTimer <= 0) {
        this.finishAttack();
      }
    }
    else if (this.targetAttack === 'TRIPLE_SLAM_DESCENT') {
      if (this.tripleSlamParried) {
        this.finishAttack();
        return;
      }
      
      this.waveTimer -= dt;
      if (this.tripleSlamStage === 'TELEGRAPH') {
        this.tripleSlamAngle = player.theta; // track player position during windup
        
        // Hands pull back behind boss
        this.leftHand.targetX = this.cx - Math.cos(this.tripleSlamAngle) * 30 - Math.sin(this.tripleSlamAngle) * 50;
        this.leftHand.targetY = this.cy - Math.sin(this.tripleSlamAngle) * 30 + Math.cos(this.tripleSlamAngle) * 50;
        this.rightHand.targetX = this.cx - Math.cos(this.tripleSlamAngle) * 30 + Math.sin(this.tripleSlamAngle) * 50;
        this.rightHand.targetY = this.cy - Math.sin(this.tripleSlamAngle) * 30 - Math.cos(this.tripleSlamAngle) * 50;
        
        if (this.waveTimer <= 0) {
          this.tripleSlamStage = 'SLAM';
          this.waveTimer = 0.6; // 0.6s lunge duration
          audio.playBossExplode();
        }
      }
      else if (this.tripleSlamStage === 'SLAM') {
        const prog = (0.6 - this.waveTimer) / 0.6;
        const dist = 180 * Math.sin(prog * Math.PI); // lunge forward and retract
        this.tripleSlamLungeX = Math.cos(this.tripleSlamAngle) * dist;
        this.tripleSlamLungeY = Math.sin(this.tripleSlamAngle) * dist;
        
        this.leftHand.targetX = this.cx + this.tripleSlamLungeX + Math.cos(this.tripleSlamAngle - 0.4) * 30;
        this.leftHand.targetY = this.cy + this.tripleSlamLungeY + Math.sin(this.tripleSlamAngle - 0.4) * 30;
        this.rightHand.targetX = this.cx + this.tripleSlamLungeX + Math.cos(this.tripleSlamAngle + 0.4) * 30;
        this.rightHand.targetY = this.cy + this.tripleSlamLungeY + Math.sin(this.tripleSlamAngle + 0.4) * 30;
        
        // Parry check
        if (player.state === 'DASHING') {
          const bx = this.cx + this.tripleSlamLungeX;
          const by = this.cy + this.tripleSlamLungeY;
          if (Math.hypot(player.x - bx, player.y - by) < this.baseRadius + player.radius + 15) {
            this.tripleSlamParried = true;
            super.takeDamage(3);
            audio.playBossExplode();
            screenShake.trigger(30, 0.4);
            particles.spawnExplosion(bx, by, '#ffffff', 30, 8);
            
            this.state = 'RECOVERY';
            this.stateTimer = 1.5; // Stun cooldown
            const banner = document.getElementById('warning-banner');
            if (banner) {
              banner.textContent = "PARRIED!";
              banner.style.color = '#39ff14';
              banner.classList.add('active');
              setTimeout(() => banner.classList.remove('active'), 1000);
            }
            return;
          }
        }
        
        // Hit check
        const bx = this.cx + this.tripleSlamLungeX;
        const by = this.cy + this.tripleSlamLungeY;
        if (Math.hypot(player.x - bx, player.y - by) < this.baseRadius + player.radius) {
          if (player.state !== 'DASHING' && player.state !== 'DEAD') {
            player.takeDamage();
          }
        }
        
        if (this.waveTimer <= 0) {
          this.tripleSlamCount++;
          this.tripleSlamLungeX = 0;
          this.tripleSlamLungeY = 0;
          if (this.tripleSlamCount < 3) {
            this.tripleSlamStage = 'TELEGRAPH';
            this.waveTimer = 0.5; // Next warning delay
            audio.playWarningBeep();
          } else {
            this.tripleSlamActive = false;
            this.finishAttack();
          }
        }
      }
    }
    else if (this.targetAttack === 'ORBITAL_SWEEP') {
      if (this.orbitalSweepParried) {
        this.finishAttack();
        return;
      }
      
      this.waveTimer -= dt;
      if (this.orbitalSweepStage === 'TELEGRAPH') {
        this.orbitalSweepAngle = player.theta; // aim sweep sector at player
        
        // Lunge out to outer orbit boundary
        const orbit = player ? player.defaultOrbitRadius : 220;
        const dist = (orbit - 40) * (1 - this.waveTimer / 0.8);
        this.orbitalSweepLungeX = Math.cos(this.orbitalSweepAngle) * dist;
        this.orbitalSweepLungeY = Math.sin(this.orbitalSweepAngle) * dist;
        
        if (this.waveTimer <= 0) {
          this.orbitalSweepStage = 'SWEEP';
          this.waveTimer = 1.4; // 1.4s sweep sweep
          audio.playBossExplode();
        }
      }
      else if (this.orbitalSweepStage === 'SWEEP') {
        const prog = (1.4 - this.waveTimer) / 1.4;
        // Sweep in a circular arc spanning 220 degrees relative to player starting angle
        const sweepAngle = this.orbitalSweepAngle + (prog * Math.PI * 1.2 - Math.PI * 0.6);
        const orbit = player ? player.defaultOrbitRadius : 220;
        
        this.orbitalSweepLungeX = Math.cos(sweepAngle) * (orbit - 20);
        this.orbitalSweepLungeY = Math.sin(sweepAngle) * (orbit - 20);
        
        this.leftHand.targetX = this.cx + Math.cos(sweepAngle - 0.4) * (orbit - 30);
        this.leftHand.targetY = this.cy + Math.sin(sweepAngle - 0.4) * (orbit - 30);
        this.rightHand.targetX = this.cx + Math.cos(sweepAngle + 0.4) * (orbit - 30);
        this.rightHand.targetY = this.cy + Math.sin(sweepAngle + 0.4) * (orbit - 30);
        
        // Parry check
        if (player.state === 'DASHING') {
          const bx = this.cx + this.orbitalSweepLungeX;
          const by = this.cy + this.orbitalSweepLungeY;
          if (Math.hypot(player.x - bx, player.y - by) < this.baseRadius + player.radius + 15) {
            this.orbitalSweepParried = true;
            super.takeDamage(5);
            audio.playBossExplode();
            screenShake.trigger(35, 0.5);
            particles.spawnExplosion(bx, by, '#ffffff', 45, 10);
            
            this.state = 'RECOVERY';
            this.stateTimer = 2.0; // Stun stun
            const banner = document.getElementById('warning-banner');
            if (banner) {
              banner.textContent = "SWEEP PARRIED!";
              banner.style.color = '#39ff14';
              banner.classList.add('active');
              setTimeout(() => banner.classList.remove('active'), 1000);
            }
            return;
          }
        }
        
        // Normal hit check
        const bx = this.cx + this.orbitalSweepLungeX;
        const by = this.cy + this.orbitalSweepLungeY;
        if (Math.hypot(player.x - bx, player.y - by) < this.baseRadius + player.radius) {
          if (player.state !== 'DASHING' && player.state !== 'DEAD') {
            player.takeDamage();
          }
        }
        
        if (this.waveTimer <= 0) {
          this.orbitalSweepActive = false;
          this.orbitalSweepLungeX = 0;
          this.orbitalSweepLungeY = 0;
          this.finishAttack();
        }
      }
    }
    else if (this.targetAttack === 'GRAVITY_FLIP') {
      // Hands act as homing mines tracking the player
      const targetAngle = player.theta;
      this.leftHand.targetX = this.cx + Math.cos(targetAngle - 0.5) * 160;
      this.leftHand.targetY = this.cy + Math.sin(targetAngle - 0.5) * 160;
      
      this.rightHand.targetX = this.cx + Math.cos(targetAngle + 0.5) * 160;
      this.rightHand.targetY = this.cy + Math.sin(targetAngle + 0.5) * 160;
      
      const leftDist = Math.hypot(player.x - this.leftHand.x, player.y - this.leftHand.y);
      const rightDist = Math.hypot(player.x - this.rightHand.x, player.y - this.rightHand.y);
      if (leftDist < 20 + player.radius || rightDist < 20 + player.radius) {
        if (player.state !== 'DASHING' && player.state !== 'DEAD') {
          player.takeDamage();
        }
      }
      
      if (this.stateTimer <= 0) {
        this.gravityFlicker = false;
        this.finishAttack();
      }
    }
    else if (this.targetAttack === 'GIGA_SLAM_QUAKE') {
      if (this.gigaSlamParried) {
        this.finishAttack();
        return;
      }
      
      this.waveTimer -= dt;
      if (this.gigaSlamStage === 'CHARGE') {
        // Floating to the top of screen
        this.gigaSlamLungeY = -120 * (1 - this.waveTimer / 1.2);
        
        // Hands float outward in warning pose
        this.leftHand.targetX = this.cx - 100;
        this.leftHand.targetY = this.cy + this.gigaSlamLungeY + 40;
        this.rightHand.targetX = this.cx + 100;
        this.rightHand.targetY = this.cy + this.gigaSlamLungeY + 40;
        
        if (Math.floor(this.stateTimer * 5) % 2 === 0 && !this.telegraphBeepPlayed) {
          audio.playWarningBeep();
        }
        
        if (this.waveTimer <= 0) {
          this.gigaSlamStage = 'SLAM';
          this.waveTimer = 0.4; // rapid drop slam
          audio.playLaserStart();
        }
      } 
      else if (this.gigaSlamStage === 'SLAM') {
        // Drop slam to center
        const prog = this.waveTimer / 0.4; // 1 to 0
        this.gigaSlamLungeY = -120 * prog;
        
        // Parry check (during slam drop)
        if (player.state === 'DASHING') {
          const bx = this.cx;
          const by = this.cy + this.gigaSlamLungeY;
          if (Math.hypot(player.x - bx, player.y - by) < this.baseRadius + player.radius + 20) {
            this.gigaSlamParried = true;
            super.takeDamage(6); // Parry damage
            audio.playBossExplode();
            screenShake.trigger(45, 0.6);
            particles.spawnExplosion(bx, by, '#ffffff', 50, 12);
            
            this.state = 'RECOVERY';
            this.stateTimer = 2.5; // long stun!
            const banner = document.getElementById('warning-banner');
            if (banner) {
              banner.textContent = "GIGA SLAM PARRIED!";
              banner.style.color = '#39ff14';
              banner.classList.add('active');
              setTimeout(() => banner.classList.remove('active'), 1000);
            }
            return;
          }
        }
        
        if (this.waveTimer <= 0) {
          this.gigaSlamLungeY = 0;
          this.gigaSlamStage = 'STUN';
          this.waveTimer = 1.5; // Vulnerable stun window after impact
          
          audio.playBossExplode();
          screenShake.trigger(40, 1.0);
          particles.spawnExplosion(this.cx, this.cy, this.color, 45, 10);
          
          // Fire gapped Chin Wave shockwave from center!
          const speed = 200;
          const width = 12;
          const playerAngle = player.theta;
          
          // Spawn wave with a gap right where player is!
          const wave = new SigmaWave(this.cx, this.cy, this.baseRadius, speed, width, this.color);
          wave.gapAngle = playerAngle; // Center gap on player
          wave.gapSize = 2.0; 
          this.bullets.push(wave);
        }
      } 
      else if (this.gigaSlamStage === 'STUN') {
        // Resting vulernable at center
        this.leftHand.targetX = this.cx - 60 + Math.random() * 10;
        this.leftHand.targetY = this.cy + 30;
        this.rightHand.targetX = this.cx + 60 + Math.random() * 10;
        this.rightHand.targetY = this.cy + 30;
        
        if (this.waveTimer <= 0) {
          this.gigaSlamActive = false;
          this.finishAttack();
        }
      }
    }
  }

  update(dt, player) {
    super.update(dt, player);
    
    // Smooth pupil tracking of the player position
    if (player && player.state !== 'DEAD') {
      const angle = Math.atan2(player.y - this.cy, player.x - this.cx);
      const maxOffset = 2.5; // Stay bounds inside the white socket
      this.pupilX = Math.cos(angle) * maxOffset;
      this.pupilY = Math.sin(angle) * maxOffset;
    } else {
      this.pupilX = 0;
      this.pupilY = 0;
    }
    
    // Timer decays for transition and death
    if (this.state === 'DEAD' || this.state === 'TRANSITION') {
      this.stateTimer -= dt;
      if (this.state === 'TRANSITION' && this.stateTimer <= 0) {
        this.state = 'IDLE';
        this.stateTimer = 0.5;
        this.isVulnerable = true;
      }
      
      // Interpolate hands even during transition/death to keep them fluid
      const handSpeed = 5 * dt;
      this.leftHand.x += (this.leftHand.targetX - this.leftHand.x) * handSpeed;
      this.rightHand.x += (this.rightHand.targetX - this.rightHand.x) * handSpeed;
      this.leftHand.y += (this.leftHand.targetY - this.leftHand.y) * handSpeed;
      this.rightHand.y += (this.rightHand.targetY - this.rightHand.y) * handSpeed;
      return;
    }
    
    // Decrement active state timers
    this.stateTimer -= dt;
    
    switch (this.state) {
      case 'IDLE':
        if (this.stateTimer <= 0) {
          const attack = this.activeSequence[this.sequenceIndex];
          this.sequenceIndex = (this.sequenceIndex + 1) % this.activeSequence.length;
          this.initiateAttack(attack);
        }
        break;
        
      case 'ATTACK':
        this.updateAttack(dt, player);
        break;
        
      case 'RECOVERY':
        if (this.stateTimer <= 0) {
          this.state = 'IDLE';
          this.stateTimer = 0.5;
        }
        break;
    }
    
    // Collision with wave ring is handled in custom logic, but update is handled by Boss
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      let b = this.bullets[i];
      if (b.type === 'WAVE') {
        const dist = Math.hypot(player.x - b.x, player.y - b.y);
        if (Math.abs(dist - b.radius) < b.width) {
          // Check if player is inside the safe gap zone
          const playerAngle = Math.atan2(player.y - b.y, player.x - b.x);
          let diff = playerAngle - b.gapAngle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          diff = Math.abs(diff);
          
          if (diff > b.gapSize / 2 + 0.15) {
            // Player is in the solid section of the wave!
            if (player.state !== 'DASHING' && player.state !== 'DEAD') {
              player.takeDamage();
            }
          }
        }
      }
    }
    
    // Hand positions
    if (this.state === 'ATTACK' && this.targetAttack === 'CLAP') {
      if (this.stateTimer > 0.5) {
        // Windup: move hands far apart
        const prog = (1.5 - this.stateTimer) / 1.0;
        this.leftHand.targetX = this.cx + Math.cos(this.clapAngle - 1.0) * (60 + prog * 100);
        this.leftHand.targetY = this.cy + Math.sin(this.clapAngle - 1.0) * (60 + prog * 100);
        
        this.rightHand.targetX = this.cx + Math.cos(this.clapAngle + 1.0) * (60 + prog * 100);
        this.rightHand.targetY = this.cy + Math.sin(this.clapAngle + 1.0) * (60 + prog * 100);
      } else {
        // Clap impact: slam together at clapAngle
        this.leftHand.targetX = this.cx + Math.cos(this.clapAngle) * 120;
        this.leftHand.targetY = this.cy + Math.sin(this.clapAngle) * 120;
        this.rightHand.targetX = this.cx + Math.cos(this.clapAngle) * 120;
        this.rightHand.targetY = this.cy + Math.sin(this.clapAngle) * 120;
      }
    } 
    else if (this.state === 'ATTACK' && this.targetAttack === 'GIGA_GRASP') {
      if (this.stateTimer > 3.0) {
        // Reach out
        const reach = 120;
        this.rightHand.targetX = this.cx + Math.cos(this.grabAngle) * reach;
        this.rightHand.targetY = this.cy + Math.sin(this.grabAngle) * reach;
      } else {
        // Holding player
        this.rightHand.targetX = this.cx + Math.cos(this.grabAngle) * 120;
        this.rightHand.targetY = this.cy + Math.sin(this.grabAngle) * 120;
      }
      this.leftHand.targetX = this.cx - 60;
      this.leftHand.targetY = this.cy;
    }
    else if (this.state === 'ATTACK' && this.targetAttack === 'CHIN_WAVES') {
      // Sigma Pose: Left hand points to chin/jaw, right hand floats back
      this.leftHand.targetX = this.cx - 25;
      this.leftHand.targetY = this.cy + 40;
      this.rightHand.targetX = this.cx + 65;
      this.rightHand.targetY = this.cy + 10;
    }
    else {
      // Idle floating
      const time = performance.now() * 0.002;
      this.leftHand.targetX = this.cx - 60 + Math.cos(time) * 15;
      this.leftHand.targetY = this.cy + Math.sin(time * 1.5) * 15;
      
      this.rightHand.targetX = this.cx + 60 + Math.cos(time + Math.PI) * 15;
      this.rightHand.targetY = this.cy + Math.sin(time * 1.5 + Math.PI) * 15;
    }
    
    // Lerp hands
    const handSpeed = 10 * dt;
    this.leftHand.x += (this.leftHand.targetX - this.leftHand.x) * handSpeed;
    this.leftHand.y += (this.leftHand.targetY - this.leftHand.y) * handSpeed;
    this.rightHand.x += (this.rightHand.targetX - this.rightHand.x) * handSpeed;
    this.rightHand.y += (this.rightHand.targetY - this.rightHand.y) * handSpeed;
  }

  draw(ctx) {
    super.draw(ctx); // Draws bullets like CHIN_WAVES

    ctx.save();
    
    // Apply body offset lunges dynamically for physical impact attacks
    let lx = 0;
    let ly = 0;
    if (this.targetAttack === 'CHIN_SLAM') {
      lx = this.chinSlamLungeX || 0;
      ly = this.chinSlamLungeY || 0;
    } else if (this.targetAttack === 'TRIPLE_SLAM_DESCENT') {
      lx = this.tripleSlamLungeX || 0;
      ly = this.tripleSlamLungeY || 0;
    } else if (this.targetAttack === 'ORBITAL_SWEEP') {
      lx = this.orbitalSweepLungeX || 0;
      ly = this.orbitalSweepLungeY || 0;
    } else if (this.targetAttack === 'GIGA_SLAM_QUAKE') {
      ly = this.gigaSlamLungeY || 0;
    }
    
    ctx.translate(this.cx + lx, this.cy + ly);
    
    // Apply death/transition animations if needed
    if (this.state === 'DEAD') {
      ctx.rotate(this.deathRotation);
      ctx.scale(this.deathScale, this.deathScale);
      ctx.globalAlpha = this.deathAlpha;
    } else if (this.state === 'TRANSITION') {
      ctx.rotate(this.transitionRotation);
      ctx.scale(this.transitionScale, this.transitionScale);
    }
    
    const scale = this.visualScale;
    ctx.scale(scale, scale);
    
    // ( iconic Sigma chin pose head tilt reverted due to sloppy rotation visual )
    const isChinWave = (this.state === 'ATTACK' && this.targetAttack === 'CHIN_WAVES');
    
    if (this.hitFlashTimer > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
    } else {
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = this.color;
      ctx.shadowColor = this.color;
    }
    ctx.shadowBlur = 15;
    ctx.lineWidth = 3;
    
    // Hand drawing function (Hexagon)
    const drawHand = (hx, hy) => {
      ctx.save();
      // Translate relative to the body (taking body lunging offsets into account)
      ctx.translate((hx - (this.cx + lx)) / scale, (hy - (this.cy + ly)) / scale);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = i * (Math.PI / 3);
        const rad = 15;
        if (i === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
        else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    
    drawHand(this.leftHand.x, this.leftHand.y);
    drawHand(this.rightHand.x, this.rightHand.y);
    
    // HAIR PROGRESSION (scales/evolves with phase)
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    if (this.phase === 2) {
      // Tiny single rebel spike tuft
      ctx.moveTo(-5, -38);
      ctx.lineTo(0, -50);
      ctx.lineTo(5, -38);
    } else if (this.phase === 3) {
      // Small Mohawk/trim spikes
      ctx.moveTo(-15, -35);
      ctx.lineTo(-10, -48);
      ctx.lineTo(-3, -39);
      ctx.lineTo(3, -48);
      ctx.lineTo(10, -39);
      ctx.lineTo(15, -35);
    } else if (this.phase === 4) {
      // Bigger spiky haircut
      ctx.moveTo(-25, -30);
      ctx.lineTo(-20, -52);
      ctx.lineTo(-10, -42);
      ctx.lineTo(0, -55);
      ctx.lineTo(10, -42);
      ctx.lineTo(20, -52);
      ctx.lineTo(25, -30);
    } else if (this.phase === 5) {
      // Full Chad spiky pompadour swoosh
      ctx.moveTo(-35, -20);
      ctx.quadraticCurveTo(-45, -55, -20, -45);
      ctx.quadraticCurveTo(-10, -60, 5, -45);
      ctx.quadraticCurveTo(20, -55, 30, -35);
      ctx.quadraticCurveTo(45, -45, 35, -15);
      ctx.lineTo(35, -20);
    }
    
    if (this.phase >= 2) {
      // Complete the loop around the top curve of the head
      ctx.arc(0, 0, this.baseRadius, -0.2, Math.PI + 0.2, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // CHIN PROGRESSION (scales with phase - blocky hexagons)
    ctx.save();
    ctx.beginPath();
    if (this.phase === 1) {
      // Small flat chin
      ctx.rect(-15, 20, 30, 10);
    } else if (this.phase === 2) {
      // Small blocky hexagon chin
      ctx.moveTo(-20, 20);
      ctx.lineTo(20, 20);
      ctx.lineTo(15, 40);
      ctx.lineTo(-15, 40);
    } else if (this.phase === 3) {
      // Medium blocky jawline
      ctx.moveTo(-30, 20);
      ctx.lineTo(30, 20);
      ctx.lineTo(22, 55);
      ctx.lineTo(-22, 55);
    } else if (this.phase === 4) {
      // Pronounced blocky jawline
      ctx.moveTo(-40, 20);
      ctx.lineTo(40, 20);
      ctx.lineTo(30, 70);
      ctx.lineTo(12, 85);
      ctx.lineTo(-12, 85);
      ctx.lineTo(-30, 70);
    } else if (this.phase === 5) {
      // CHAD CHIN (Extremely chiseled, strong blocky jaw, perfect size)
      ctx.moveTo(-45, 20);
      ctx.lineTo(45, 20);
      ctx.lineTo(35, 75);
      ctx.lineTo(15, 95);
      ctx.lineTo(-15, 95);
      ctx.lineTo(-35, 75);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Chiseled chin dimple / cleft details
      ctx.beginPath();
      ctx.moveTo(0, 75);
      ctx.lineTo(0, 90);
      ctx.stroke();
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    
    // Core Head
    ctx.beginPath();
    ctx.arc(0, 0, this.baseRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Sigma Boy Eyes
    const eyeShiftX = isChinWave ? -4 : 0;
    
    // Draw angry diagonal eyebrows
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    
    ctx.beginPath();
    ctx.moveTo(-28 + eyeShiftX, -16);
    ctx.lineTo(-8 + eyeShiftX, -8);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(28 + eyeShiftX, -16);
    ctx.lineTo(8 + eyeShiftX, -8);
    ctx.stroke();
    
    // Outer white eye sockets
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2.5;
    
    // Left eye socket
    ctx.beginPath();
    ctx.moveTo(-24 + eyeShiftX, -10);
    ctx.lineTo(-10 + eyeShiftX, -5);
    ctx.lineTo(-24 + eyeShiftX, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Right eye socket
    ctx.beginPath();
    ctx.moveTo(24 + eyeShiftX, -10);
    ctx.lineTo(10 + eyeShiftX, -5);
    ctx.lineTo(24 + eyeShiftX, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Glowing neon green pupils inside the eye sockets with dynamic tracking
    ctx.fillStyle = '#39ff14';
    ctx.beginPath();
    ctx.arc(-16 + eyeShiftX + this.pupilX, -5 + this.pupilY, 3, 0, Math.PI * 2);
    ctx.arc(16 + eyeShiftX + this.pupilX, -5 + this.pupilY, 3, 0, Math.PI * 2);
    ctx.fill();
    
    const player = window.gameAppInstance?.player;
    const orbit = player ? player.defaultOrbitRadius : 220;

    // Draw Chin Wave telegraph safe zones
    if (this.state === 'ATTACK' && this.targetAttack === 'CHIN_WAVES' && this.wavesFired < this.maxWaves) {
      const nextGapAngle = this.waveGaps[this.wavesFired];
      const gapSize = this.gapSize;
      
      ctx.save();
      ctx.lineWidth = 3;
      
      // Draw red dashed danger zone at orbit line
      ctx.strokeStyle = 'rgba(255, 0, 85, 0.45)';
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      const startAngle = nextGapAngle + gapSize / 2;
      const endAngle = nextGapAngle + Math.PI * 2 - gapSize / 2;
      ctx.arc(0, 0, orbit / scale, startAngle, endAngle);
      ctx.stroke();
      
      // Draw green solid safe zone at orbit line
      ctx.strokeStyle = '#39ff14';
      ctx.setLineDash([]);
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#39ff14';
      ctx.beginPath();
      ctx.arc(0, 0, orbit / scale, nextGapAngle - gapSize / 2, nextGapAngle + gapSize / 2);
      ctx.stroke();
      
      // Draw "SAFE ZONE" helper text
      ctx.fillStyle = '#39ff14';
      ctx.font = 'bold 9px Courier New';
      ctx.textAlign = 'center';
      const tx = Math.cos(nextGapAngle) * ((orbit + 20) / scale);
      const ty = Math.sin(nextGapAngle) * ((orbit + 20) / scale);
      ctx.fillText("SAFE ZONE", tx, ty);
      
      ctx.restore();
    }

    // Draw Chin Slam triangular warning area
    if (this.state === 'ATTACK' && this.targetAttack === 'CHIN_WAVES' === false && this.targetAttack === 'CHIN_SLAM' && this.chinSlamStage === 'TELEGRAPH') {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 0, 85, 0.15)';
      ctx.strokeStyle = '#ff0055';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff0055';
      ctx.setLineDash([5, 5]);
      
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const startAngle = this.chinSlamAngle - 0.52;
      const endAngle = this.chinSlamAngle + 0.52;
      ctx.arc(0, 0, orbit / scale, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Draw Triple Slam warning line
    if (this.state === 'ATTACK' && this.targetAttack === 'TRIPLE_SLAM_DESCENT' && this.tripleSlamStage === 'TELEGRAPH') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 8]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(this.tripleSlamAngle) * (orbit / scale), Math.sin(this.tripleSlamAngle) * (orbit / scale));
      ctx.stroke();
      ctx.restore();
    }

    // Draw Orbital Sweep warning arc segment
    if (this.state === 'ATTACK' && this.targetAttack === 'ORBITAL_SWEEP' && this.orbitalSweepStage === 'TELEGRAPH') {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 0, 85, 0.12)';
      ctx.strokeStyle = '#ff0055';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff0055';
      
      ctx.beginPath();
      // Draw highlighted sweep slice (spanning 220 degrees / 1.2 * PI radians)
      ctx.moveTo(0, 0);
      const startAngle = this.orbitalSweepAngle - 1.9;
      const endAngle = this.orbitalSweepAngle + 1.9;
      ctx.arc(0, 0, (orbit - 20) / scale, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Draw Giga Slam drop warning target zone on center
    if (this.state === 'ATTACK' && this.targetAttack === 'GIGA_SLAM_QUAKE') {
      ctx.save();
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      // Concentric target rings at center of orbit (translate coordinates translate lx, ly out)
      ctx.arc(-lx / scale, -ly / scale, this.baseRadius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    
    if (this.state === 'ATTACK') {
      if (this.targetAttack === 'EYE_LASER') {
        if (this.stateTimer > 1.0) {
          // Telegraph warning line
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(this.laserAngle) * 1000, Math.sin(this.laserAngle) * 1000);
          ctx.stroke();
        } else if (this.laserFired) {
          // Actual Laser
          ctx.strokeStyle = '#ffffff';
          ctx.shadowColor = this.color;
          ctx.shadowBlur = 20;
          ctx.lineWidth = 20 + Math.random() * 5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(this.laserAngle) * 1000, Math.sin(this.laserAngle) * 1000);
          ctx.stroke();
          
          ctx.lineWidth = 10;
          ctx.strokeStyle = this.color;
          ctx.stroke();
        }
      }
      else if (this.targetAttack === 'CLAP' && this.stateTimer > 0.5) {
        // Telegraph for clap
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 60;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(this.clapAngle) * 1000, Math.sin(this.clapAngle) * 1000);
        ctx.stroke();
      }
      else if (this.targetAttack === 'GIGA_GRASP') {
        if (this.stateTimer <= 3.0 && this.stateTimer > 0 && !this.grabFailed) {
          // Charging hold laser warning
          ctx.strokeStyle = (Math.floor(performance.now() / 100) % 2 === 0) ? '#ff0000' : '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(this.grabAngle) * 1000, Math.sin(this.grabAngle) * 1000);
          ctx.stroke();
          
          // Show 3 second timer on screen above boss
          ctx.save();
          ctx.font = '24px monospace';
          ctx.fillStyle = '#ff0000';
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 10;
          ctx.fillText(`ESCAPE: ${(this.stateTimer).toFixed(1)}s`, -80, -100);
          ctx.restore();
        }
      }
    }
    
    ctx.restore();
  }
}
